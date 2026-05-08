// backend/src/models/Transaction.js
const mongoose = require('mongoose');

const transactionItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  productName: {
    type: String,
    required: true
  },
  quantityPacks: {
    type: Number,
    required: true,
    min: 0
  },
  quantityUnits: {
    type: Number,
    required: true,
    min: 0
  },
  packSize: {
    type: Number,
    required: true
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0
  },
  packPrice: {
    type: Number,
    required: true,
    min: 0
  },
  totalPrice: {
    type: Number,
    required: true,
    min: 0
  },
  discount: {
    type: Number,
    default: 0,
    min: 0
  },
  tax: {
    type: Number,
    default: 0,
    min: 0
  }
});

const transactionSchema = new mongoose.Schema({
  transactionId: {
    type: String,
    unique: true,
    required: true,
    index: true
  },
  receiptNumber: {
    type: String,
    unique: true,
    required: true,
    index: true
  },
  posAgentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  customer: {
    name: String,
    email: String,
    phone: String,
    address: String
  },
  items: [transactionItemSchema],
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  tax: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  discount: {
    type: Number,
    default: 0,
    min: 0
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'transfer', 'pos', 'wallet'],
    required: true
  },
  paymentReference: {
    type: String,
    default: null
  },
  paymentDetails: {
    cardLast4: String,
    bankName: String,
    accountNumber: String,
    transactionReference: String
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded', 'void'],
    default: 'completed',
    index: true
  },
  refundDetails: {
    refundedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    refundedAt: Date,
    refundReason: String,
    refundAmount: Number,
    originalTransactionId: String
  },
  verifiedByPin: {
    type: Boolean,
    default: true
  },
  notes: {
    type: String,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  metadata: {
    ipAddress: String,
    userAgent: String,
    location: String,
    deviceInfo: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ posAgentId: 1, createdAt: -1 });
transactionSchema.index({ status: 1, createdAt: -1 });
transactionSchema.index({ paymentMethod: 1 });
transactionSchema.index({ 'items.productId': 1 });
transactionSchema.index({ totalAmount: 1 });

// Virtual for item count
transactionSchema.virtual('itemCount').get(function() {
  return this.items.length;
});

// Virtual for total units sold
transactionSchema.virtual('totalUnits').get(function() {
  return this.items.reduce((sum, item) => {
    return sum + (item.quantityPacks * item.packSize) + item.quantityUnits;
  }, 0);
});

// Virtual for formatted date
transactionSchema.virtual('formattedDate').get(function() {
  return this.createdAt.toLocaleDateString('en-NG', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
});

// Method to generate transaction ID
transactionSchema.methods.generateTransactionId = function() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `TRX-${year}${month}${day}-${random}`;
};

// Method to generate receipt number
transactionSchema.methods.generateReceiptNumber = function() {
  const date = new Date();
  const timestamp = date.getTime().toString().slice(-8);
  return `RCPT-${timestamp}`;
};

// Method to calculate totals
transactionSchema.methods.calculateTotals = function() {
  this.subtotal = this.items.reduce((sum, item) => sum + item.totalPrice, 0);
  this.totalAmount = this.subtotal + this.tax - this.discount;
  return { subtotal: this.subtotal, total: this.totalAmount };
};

// Method to process refund
transactionSchema.methods.processRefund = async function(userId, reason, items = null) {
  if (this.status === 'refunded') {
    throw new Error('Transaction already refunded');
  }
  
  const Product = mongoose.model('Product');
  const Inventory = mongoose.model('Inventory');
  
  // Restore stock for each item
  for (const item of this.items) {
    const product = await Product.findById(item.productId);
    if (product) {
      // Restore stock
      await product.updateStock(item.quantityPacks, item.quantityUnits, 'add');
      
      // Log inventory movement
      await Inventory.create({
        productId: product._id,
        movementType: 'return',
        quantityPacks: item.quantityPacks,
        quantityUnits: item.quantityUnits,
        previousStock: {
          packs: product.currentStock.packs - item.quantityPacks,
          units: product.currentStock.units - item.quantityUnits
        },
        newStock: product.currentStock,
        referenceId: this.transactionId,
        referenceModel: 'Transaction',
        performedBy: userId,
        notes: `Refund of transaction ${this.transactionId}. Reason: ${reason}`
      });
    }
  }
  
  // Update transaction status
  this.status = 'refunded';
  this.refundDetails = {
    refundedBy: userId,
    refundedAt: new Date(),
    refundReason: reason,
    refundAmount: this.totalAmount,
    originalTransactionId: this.transactionId
  };
  
  await this.save();
  return this;
};

// Static method to get daily sales report
transactionSchema.statics.getDailySalesReport = async function(date) {
  const startDate = new Date(date);
  startDate.setHours(0, 0, 0, 0);
  
  const endDate = new Date(date);
  endDate.setHours(23, 59, 59, 999);
  
  const transactions = await this.find({
    createdAt: { $gte: startDate, $lte: endDate },
    status: 'completed'
  });
  
  const totalSales = transactions.reduce((sum, t) => sum + t.totalAmount, 0);
  const totalItems = transactions.reduce((sum, t) => sum + t.totalUnits, 0);
  
  // Get top products
  const productMap = new Map();
  transactions.forEach(transaction => {
    transaction.items.forEach(item => {
      const existing = productMap.get(item.productId.toString()) || {
        productId: item.productId,
        productName: item.productName,
        quantity: 0,
        revenue: 0
      };
      existing.quantity += (item.quantityPacks * item.packSize) + item.quantityUnits;
      existing.revenue += item.totalPrice;
      productMap.set(item.productId.toString(), existing);
    });
  });
  
  const topProducts = Array.from(productMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);
  
  return {
    date,
    totalTransactions: transactions.length,
    totalSales,
    averageSale: transactions.length > 0 ? totalSales / transactions.length : 0,
    totalItems,
    topProducts,
    transactions
  };
};

// Static method to get sales summary by period
transactionSchema.statics.getSalesSummary = async function(startDate, endDate, groupBy = 'day') {
  const match = {
    createdAt: { $gte: startDate, $lte: endDate },
    status: 'completed'
  };
  
  let groupFormat;
  switch (groupBy) {
    case 'hour':
      groupFormat = { $hour: '$createdAt' };
      break;
    case 'day':
      groupFormat = { $dayOfMonth: '$createdAt' };
      break;
    case 'month':
      groupFormat = { $month: '$createdAt' };
      break;
    case 'year':
      groupFormat = { $year: '$createdAt' };
      break;
    default:
      groupFormat = { $dayOfMonth: '$createdAt' };
  }
  
  const summary = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: groupFormat,
        totalSales: { $sum: '$totalAmount' },
        transactionCount: { $sum: 1 },
        averageSale: { $avg: '$totalAmount' }
      }
    },
    { $sort: { '_id': 1 } }
  ]);
  
  return summary;
};

// Pre-save middleware
transactionSchema.pre('save', async function(next) {
  if (!this.transactionId) {
    this.transactionId = this.generateTransactionId();
  }
  
  if (!this.receiptNumber) {
    this.receiptNumber = this.generateReceiptNumber();
  }
  
  next();
});

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;