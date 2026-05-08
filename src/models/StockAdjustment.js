// backend/src/models/StockAdjustment.js
const mongoose = require('mongoose');

const stockAdjustmentSchema = new mongoose.Schema({
  adjustmentId: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },
  adjustmentType: {
    type: String,
    enum: ['add', 'remove', 'count_correction', 'damage', 'expiry'],
    required: true,
    index: true
  },
  quantityPacks: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  quantityUnits: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  previousStock: {
    packs: { type: Number, required: true, default: 0 },
    units: { type: Number, required: true, default: 0 }
  },
  newStock: {
    packs: { type: Number, required: true, default: 0 },
    units: { type: Number, required: true, default: 0 }
  },
  reason: {
    type: String,
    required: [true, 'Reason for adjustment is required'],
    trim: true,
    maxlength: [500, 'Reason cannot exceed 500 characters']
  },
  category: {
    type: String,
    enum: ['restock', 'theft', 'damage', 'expiry', 'inventory_count', 'return', 'other'],
    required: true,
    default: 'restock'
  },
  batchNumber: {
    type: String,
    trim: true
  },
  expiryDate: {
    type: Date
  },
  costPerUnit: {
    type: Number,
    min: 0,
    default: 0
  },
  totalCost: {
    type: Number,
    min: 0,
    default: 0
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'verified'
  },
  verificationNotes: {
    type: String,
    maxlength: [500, 'Verification notes cannot exceed 500 characters']
  },
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
  }],
  notes: {
    type: String,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  },
  metadata: {
    ipAddress: String,
    userAgent: String,
    location: String,
    department: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
stockAdjustmentSchema.index({ adjustmentId: 1 });
stockAdjustmentSchema.index({ productId: 1, createdAt: -1 });
stockAdjustmentSchema.index({ adjustmentType: 1, createdAt: -1 });
stockAdjustmentSchema.index({ performedBy: 1, createdAt: -1 });
stockAdjustmentSchema.index({ verificationStatus: 1 });
stockAdjustmentSchema.index({ category: 1 });
stockAdjustmentSchema.index({ batchNumber: 1 });
stockAdjustmentSchema.index({ createdAt: -1 });

// Virtual for total quantity in units
stockAdjustmentSchema.virtual('totalUnits').get(function() {
  return (this.quantityPacks * (this.packSize || 1)) + this.quantityUnits;
});

// Virtual for net change
stockAdjustmentSchema.virtual('netChange').get(function() {
  const oldTotal = (this.previousStock.packs * (this.packSize || 1)) + this.previousStock.units;
  const newTotal = (this.newStock.packs * (this.packSize || 1)) + this.newStock.units;
  return newTotal - oldTotal;
});

// Virtual for adjustment direction
stockAdjustmentSchema.virtual('direction').get(function() {
  if (this.adjustmentType === 'add') return 'increase';
  if (this.adjustmentType === 'remove') return 'decrease';
  return this.netChange > 0 ? 'increase' : (this.netChange < 0 ? 'decrease' : 'no_change');
});

// Method to generate adjustment ID
stockAdjustmentSchema.methods.generateAdjustmentId = function() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `ADJ-${year}${month}${day}-${random}`;
};

// Method to verify adjustment
stockAdjustmentSchema.methods.verify = async function(verifierId, status, notes = '') {
  if (this.verificationStatus !== 'pending') {
    throw new Error('Adjustment already verified');
  }
  
  this.verificationStatus = status;
  this.verifiedBy = verifierId;
  this.verificationNotes = notes;
  
  if (status === 'verified') {
    const Product = mongoose.model('Product');
    const product = await Product.findById(this.productId);
    
    if (!product) {
      throw new Error('Product not found');
    }
    
    if (this.adjustmentType === 'add') {
      await product.updateStock(this.quantityPacks, this.quantityUnits, 'add');
    } else if (this.adjustmentType === 'remove') {
      await product.updateStock(this.quantityPacks, this.quantityUnits, 'remove');
    } else {
      product.currentStock = this.newStock;
      await product.save();
    }
    
    const Inventory = mongoose.model('Inventory');
    await Inventory.create({
      productId: this.productId,
      movementType: 'adjustment',
      quantityPacks: this.quantityPacks,
      quantityUnits: this.quantityUnits,
      previousStock: this.previousStock,
      newStock: this.newStock,
      referenceId: this.adjustmentId,
      referenceModel: 'StockAdjustment',
      performedBy: this.performedBy,
      notes: this.reason,
      batchNumber: this.batchNumber
    });
  }
  
  await this.save();
  return this;
};

// Method to get adjustment summary
stockAdjustmentSchema.methods.getSummary = async function() {
  await this.populate('productId', 'name genericName unitType packSize');
  await this.populate('performedBy', 'name email');
  await this.populate('approvedBy', 'name email');
  await this.populate('verifiedBy', 'name email');
  
  return {
    id: this._id,
    adjustmentId: this.adjustmentId,
    product: this.productId,
    adjustmentType: this.adjustmentType,
    category: this.category,
    quantity: {
      packs: this.quantityPacks,
      units: this.quantityUnits,
      totalUnits: this.totalUnits
    },
    previousStock: this.previousStock,
    newStock: this.newStock,
    netChange: this.netChange,
    direction: this.direction,
    reason: this.reason,
    performedBy: this.performedBy,
    approvedBy: this.approvedBy,
    verifiedBy: this.verifiedBy,
    verificationStatus: this.verificationStatus,
    createdAt: this.createdAt,
    batchNumber: this.batchNumber,
    expiryDate: this.expiryDate,
    cost: {
      perUnit: this.costPerUnit,
      total: this.totalCost
    }
  };
};

// Static method to get pending verifications
stockAdjustmentSchema.statics.getPendingVerifications = async function(limit = 50) {
  return await this.find({ verificationStatus: 'pending' })
    .sort({ createdAt: 1 })
    .limit(limit)
    .populate('productId', 'name genericName')
    .populate('performedBy', 'name email');
};

// Static method to get adjustments by date range
stockAdjustmentSchema.statics.getAdjustmentsByDateRange = async function(startDate, endDate, filters = {}) {
  const query = {
    createdAt: { $gte: startDate, $lte: endDate },
    ...filters
  };
  
  const adjustments = await this.find(query)
    .sort({ createdAt: -1 })
    .populate('productId', 'name genericName unitType')
    .populate('performedBy', 'name email')
    .populate('verifiedBy', 'name email');
  
  const summary = {
    totalAdjustments: adjustments.length,
    totalAdded: 0,
    totalRemoved: 0,
    totalValue: 0,
    byType: {},
    byCategory: {}
  };
  
  adjustments.forEach(adj => {
    const totalValue = adj.totalCost;
    summary.totalValue += totalValue;
    
    if (adj.adjustmentType === 'add') {
      summary.totalAdded += adj.totalUnits;
    } else if (adj.adjustmentType === 'remove') {
      summary.totalRemoved += adj.totalUnits;
    }
    
    if (!summary.byType[adj.adjustmentType]) {
      summary.byType[adj.adjustmentType] = { count: 0, totalUnits: 0, totalValue: 0 };
    }
    summary.byType[adj.adjustmentType].count++;
    summary.byType[adj.adjustmentType].totalUnits += adj.totalUnits;
    summary.byType[adj.adjustmentType].totalValue += totalValue;
    
    if (adj.category) {
      if (!summary.byCategory[adj.category]) {
        summary.byCategory[adj.category] = { count: 0, totalUnits: 0 };
      }
      summary.byCategory[adj.category].count++;
      summary.byCategory[adj.category].totalUnits += adj.totalUnits;
    }
  });
  
  return { adjustments, summary };
};

// Static method to get adjustment trends
stockAdjustmentSchema.statics.getAdjustmentTrends = async function(days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const adjustments = await this.find({
    createdAt: { $gte: startDate },
    verificationStatus: 'verified'
  });
  
  const trends = [];
  for (let i = 0; i <= days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);
    
    const dayAdjustments = adjustments.filter(adj => 
      adj.createdAt >= date && adj.createdAt < nextDate
    );
    
    trends.unshift({
      date: date.toISOString().split('T')[0],
      totalAdjustments: dayAdjustments.length,
      totalAdded: dayAdjustments.filter(a => a.adjustmentType === 'add').reduce((s, a) => s + a.totalUnits, 0),
      totalRemoved: dayAdjustments.filter(a => a.adjustmentType === 'remove').reduce((s, a) => s + a.totalUnits, 0),
      totalValue: dayAdjustments.reduce((s, a) => s + a.totalCost, 0)
    });
  }
  
  return trends;
};

// ============ FIXED MIDDLEWARE ============
// Pre-save middleware
stockAdjustmentSchema.pre('save', async function(next) {
  if (!this.adjustmentId) {
    this.adjustmentId = this.generateAdjustmentId();
  }
  
  // Calculate total cost
  if (this.costPerUnit > 0) {
    this.totalCost = this.totalUnits * this.costPerUnit;
  }
  
  // Ensure pack size is available for calculation
  if (!this.packSize && this.productId) {
    const Product = mongoose.model('Product');
    const product = await Product.findById(this.productId);
    if (product) {
      this.packSize = product.packSize;
    }
  }
  
  next();
});

// FIXED: Middleware to prevent modification after verification
// This only applies to UPDATES, not new documents
stockAdjustmentSchema.pre('save', async function(next) {
  // Skip this validation for new documents
  if (this.isNew) {
    return next();
  }
  
  // Only check for existing documents being modified
  if (this.isModified('verificationStatus') && this.verificationStatus !== 'pending') {
    // Check if more than just verificationStatus is being modified
    const modifiedFields = Object.keys(this.modifiedPaths());
    const onlyVerificationStatus = modifiedFields.length === 1 && modifiedFields[0] === 'verificationStatus';
    
    if (!onlyVerificationStatus) {
      next(new Error('Cannot modify verified adjustment. Only verification status can be changed.'));
    }
  }
  next();
});

const StockAdjustment = mongoose.model('StockAdjustment', stockAdjustmentSchema);

module.exports = StockAdjustment;