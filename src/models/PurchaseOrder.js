// backend/src/models/PurchaseOrder.js
const mongoose = require('mongoose');

const purchaseOrderItemSchema = new mongoose.Schema({
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
    min: 1
  },
  quantityUnits: {
    type: Number,
    default: 0,
    min: 0
  },
  packSize: {
    type: Number,
    required: true
  },
  unitCost: {
    type: Number,
    required: true,
    min: 0
  },
  totalCost: {
    type: Number,
    required: true,
    min: 0
  },
  receivedQuantity: {
    packs: { type: Number, default: 0 },
    units: { type: Number, default: 0 }
  },
  batchNumber: {
    type: String,
    trim: true
  },
  expiryDate: Date
});

const purchaseOrderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true,
    required: true,
    index: true
  },
  supplier: {
    name: {
      type: String,
      required: true
    },
    phone: String,
    email: String,
    address: String,
    contactPerson: String
  },
  items: [purchaseOrderItemSchema],
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  tax: {
    type: Number,
    default: 0,
    min: 0
  },
  shippingCost: {
    type: Number,
    default: 0,
    min: 0
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['draft', 'submitted', 'approved', 'shipped', 'partially_received', 'completed', 'cancelled'],
    default: 'draft',
    index: true
  },
  orderDate: {
    type: Date,
    default: Date.now
  },
  expectedDeliveryDate: Date,
  actualDeliveryDate: Date,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  receivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  paymentTerms: {
    type: String,
    enum: ['cash_on_delivery', 'net_30', 'net_60', 'prepaid'],
    default: 'cash_on_delivery'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'partial', 'paid'],
    default: 'pending'
  },
  notes: String,
  attachments: [{
    filename: String,
    url: String,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Indexes
purchaseOrderSchema.index({ orderNumber: 1 });
purchaseOrderSchema.index({ supplier: 1 });
purchaseOrderSchema.index({ status: 1, orderDate: -1 });
purchaseOrderSchema.index({ createdBy: 1 });

// Virtual for total items
purchaseOrderSchema.virtual('totalItems').get(function() {
  return this.items.length;
});

// Virtual for total units ordered
purchaseOrderSchema.virtual('totalUnits').get(function() {
  return this.items.reduce((sum, item) => {
    return sum + (item.quantityPacks * item.packSize) + item.quantityUnits;
  }, 0);
});

// Method to generate order number
purchaseOrderSchema.methods.generateOrderNumber = function() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `PO-${year}${month}-${random}`;
};

// Method to receive items
purchaseOrderSchema.methods.receiveItems = async function(items, receivedBy) {
  const Product = mongoose.model('Product');
  const Inventory = mongoose.model('Inventory');
  const StockAdjustment = mongoose.model('StockAdjustment');
  
  for (const receivedItem of items) {
    const orderItem = this.items.find(item => 
      item.productId.toString() === receivedItem.productId
    );
    
    if (!orderItem) {
      throw new Error(`Product ${receivedItem.productId} not found in order`);
    }
    
    // Update received quantities
    orderItem.receivedQuantity.packs = receivedItem.quantityPacks;
    orderItem.receivedQuantity.units = receivedItem.quantityUnits;
    orderItem.batchNumber = receivedItem.batchNumber;
    orderItem.expiryDate = receivedItem.expiryDate;
    
    // Update product stock
    const product = await Product.findById(orderItem.productId);
    if (product) {
      await product.updateStock(
        receivedItem.quantityPacks,
        receivedItem.quantityUnits,
        'add'
      );
      
      // Create stock adjustment record
      await StockAdjustment.create({
        productId: product._id,
        adjustmentType: 'add',
        category: 'restock',
        quantityPacks: receivedItem.quantityPacks,
        quantityUnits: receivedItem.quantityUnits,
        previousStock: {
          packs: product.currentStock.packs - receivedItem.quantityPacks,
          units: product.currentStock.units - receivedItem.quantityUnits
        },
        newStock: product.currentStock,
        reason: `Purchase Order ${this.orderNumber} received`,
        batchNumber: receivedItem.batchNumber,
        expiryDate: receivedItem.expiryDate,
        costPerUnit: orderItem.unitCost,
        totalCost: orderItem.unitCost * ((receivedItem.quantityPacks * orderItem.packSize) + receivedItem.quantityUnits),
        performedBy: receivedBy,
        approvedBy: receivedBy,
        verificationStatus: 'verified'
      });
      
      // Log inventory movement
      await Inventory.create({
        productId: product._id,
        movementType: 'restock',
        quantityPacks: receivedItem.quantityPacks,
        quantityUnits: receivedItem.quantityUnits,
        previousStock: {
          packs: product.currentStock.packs - receivedItem.quantityPacks,
          units: product.currentStock.units - receivedItem.quantityUnits
        },
        newStock: product.currentStock,
        referenceId: this.orderNumber,
        referenceModel: 'PurchaseOrder',
        performedBy: receivedBy,
        notes: `Restock from PO ${this.orderNumber}`,
        batchNumber: receivedItem.batchNumber
      });
    }
  }
  
  // Update order status
  const allReceived = this.items.every(item => 
    item.receivedQuantity.packs >= item.quantityPacks &&
    item.receivedQuantity.units >= item.quantityUnits
  );
  
  const anyReceived = this.items.some(item => 
    item.receivedQuantity.packs > 0 || item.receivedQuantity.units > 0
  );
  
  if (allReceived) {
    this.status = 'completed';
  } else if (anyReceived) {
    this.status = 'partially_received';
  }
  
  this.actualDeliveryDate = new Date();
  this.receivedBy = receivedBy;
  
  await this.save();
  return this;
};

// Pre-save middleware
purchaseOrderSchema.pre('save', async function(next) {
  if (!this.orderNumber) {
    this.orderNumber = this.generateOrderNumber();
  }
  
  // Calculate totals
  this.subtotal = this.items.reduce((sum, item) => sum + item.totalCost, 0);
  this.totalAmount = this.subtotal + this.tax + this.shippingCost;
  
  next();
});

const PurchaseOrder = mongoose.model('PurchaseOrder', purchaseOrderSchema);

module.exports = PurchaseOrder;