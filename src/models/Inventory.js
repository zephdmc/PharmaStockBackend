// backend/src/models/Inventory.js
const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },
  movementType: {
    type: String,
    enum: ['restock', 'sale', 'adjustment', 'return', 'damage', 'expired'],
    required: true,
    index: true
  },
  quantityPacks: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  quantityUnits: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  previousStock: {
    packs: { type: Number, required: true },
    units: { type: Number, required: true }
  },
  newStock: {
    packs: { type: Number, required: true },
    units: { type: Number, required: true }
  },
  referenceId: {
    type: String,
    index: true,
    default: null
  },
  // FIXED: removed enum validation
  referenceModel: {
    type: String,
    default: null
  },
  costPerUnit: {
    type: Number,
    default: 0,
    min: 0
  },
  totalCost: {
    type: Number,
    default: 0,
    min: 0
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  notes: {
    type: String,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  batchNumber: {
    type: String,
    trim: true
  },
  location: {
    from: String,
    to: String
  },
  metadata: {
    ipAddress: String,
    userAgent: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
inventorySchema.index({ productId: 1, createdAt: -1 });
inventorySchema.index({ movementType: 1, createdAt: -1 });
inventorySchema.index({ performedBy: 1 });
inventorySchema.index({ referenceId: 1 });
inventorySchema.index({ batchNumber: 1 });
inventorySchema.index({ createdAt: -1 });

// Virtual for total quantity in units
inventorySchema.virtual('totalUnits').get(function() {
  return (this.quantityPacks * (this.productId?.packSize || 1)) + this.quantityUnits;
});

// Virtual for stock change direction
inventorySchema.virtual('direction').get(function() {
  const oldTotal = (this.previousStock.packs * (this.productId?.packSize || 1)) + this.previousStock.units;
  const newTotal = (this.newStock.packs * (this.productId?.packSize || 1)) + this.newStock.units;
  
  if (newTotal > oldTotal) return 'increase';
  if (newTotal < oldTotal) return 'decrease';
  return 'no_change';
});

// Method to get movement details
inventorySchema.methods.getMovementDetails = async function() {
  await this.populate('productId', 'name genericName packSize unitType');
  await this.populate('performedBy', 'name email');
  
  let reference = null;
  if (this.referenceId && this.referenceModel) {
    try {
      const ReferenceModel = mongoose.model(this.referenceModel);
      reference = await ReferenceModel.findById(this.referenceId);
    } catch (err) {
      // Model doesn't exist, ignore
    }
  }
  
  return {
    id: this._id,
    product: this.productId,
    movementType: this.movementType,
    quantity: {
      packs: this.quantityPacks,
      units: this.quantityUnits,
      totalUnits: this.totalUnits
    },
    previousStock: this.previousStock,
    newStock: this.newStock,
    direction: this.direction,
    performedBy: this.performedBy,
    timestamp: this.createdAt,
    reference,
    notes: this.notes,
    batchNumber: this.batchNumber
  };
};

// Static method to get inventory summary by product
inventorySchema.statics.getProductInventorySummary = async function(productId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const movements = await this.find({
    productId,
    createdAt: { $gte: startDate }
  }).sort('createdAt');
  
  const summary = {
    productId,
    period: days,
    totalRestocked: 0,
    totalSold: 0,
    totalAdjusted: 0,
    totalDamaged: 0,
    totalExpired: 0,
    dailyMovements: []
  };
  
  movements.forEach(movement => {
    switch (movement.movementType) {
      case 'restock':
        summary.totalRestocked += movement.totalUnits;
        break;
      case 'sale':
        summary.totalSold += movement.totalUnits;
        break;
      case 'adjustment':
        summary.totalAdjusted += movement.totalUnits;
        break;
      case 'damage':
        summary.totalDamaged += movement.totalUnits;
        break;
      case 'expired':
        summary.totalExpired += movement.totalUnits;
        break;
    }
  });
  
  return summary;
};

// Static method to get inventory valuation
inventorySchema.statics.getInventoryValuation = async function() {
  const Product = mongoose.model('Product');
  const products = await Product.find({ isActive: true, isDeleted: false });
  
  let totalValue = 0;
  const byCategory = {};
  
  for (const product of products) {
    const totalUnits = (product.currentStock.packs * product.packSize) + product.currentStock.units;
    const avgPrice = product.pricePerUnit || (product.pricePerPack / product.packSize);
    const value = totalUnits * avgPrice;
    totalValue += value;
    
    const categoryId = product.category?.toString() || 'uncategorized';
    if (!byCategory[categoryId]) {
      byCategory[categoryId] = {
        category: product.category,
        value: 0,
        count: 0
      };
    }
    
    byCategory[categoryId].value += value;
    byCategory[categoryId].count += 1;
  }
  
  return {
    totalValue,
    totalProducts: products.length,
    byCategory: Object.values(byCategory),
    generatedAt: new Date()
  };
};

// Static method to get turnover rate
inventorySchema.statics.getTurnoverRate = async function(productId, days = 365) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const Product = mongoose.model('Product');
  const product = await Product.findById(productId);
  
  if (!product) throw new Error('Product not found');
  
  const soldMovements = await this.find({
    productId,
    movementType: 'sale',
    createdAt: { $gte: startDate }
  });
  
  const totalSold = soldMovements.reduce((sum, m) => sum + (m.quantityPacks * product.packSize + m.quantityUnits), 0);
  const averageInventory = (product.totalUnits + product.totalUnits) / 2;
  
  return {
    productId,
    productName: product.name,
    period: days,
    totalSold,
    averageInventory,
    turnoverRate: averageInventory > 0 ? totalSold / averageInventory : 0
  };
};

// Pre-save middleware to validate stock levels
inventorySchema.pre('save', async function(next) {
  const Product = mongoose.model('Product');
  const product = await Product.findById(this.productId);
  
  if (!product) {
    next(new Error('Product not found'));
  }
  
  // Validate that new stock is not negative
  if (this.newStock.packs < 0 || this.newStock.units < 0) {
    next(new Error('Stock cannot be negative'));
  }
  
  next();
});

const Inventory = mongoose.model('Inventory', inventorySchema);

module.exports = Inventory;