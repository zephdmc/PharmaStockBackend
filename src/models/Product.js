// backend/src/models/Product.js
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    unique: true,
    index: true
  },
  genericName: {
    type: String,
    trim: true,
    index: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category is required']
  },
  manufacturer: {
    type: String,
    trim: true
  },
  unitType: {
    type: String,
    enum: ['tablet', 'capsule', 'sachet', 'bottle', 'pack', 'ml', 'mg'],
    default: 'tablet',
    required: true
  },
  packSize: {
    type: Number,
    required: [true, 'Pack size is required'],
    min: [1, 'Pack size must be at least 1'],
    default: 1
  },
  currentStock: {
    packs: {
      type: Number,
      default: 0,
      min: 0
    },
    units: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  pricePerUnit: {
    type: Number,
    required: [true, 'Price per unit is required'],
    min: [0, 'Price cannot be negative'],
    default: 0
  },
  pricePerPack: {
    type: Number,
    required: [true, 'Price per pack is required'],
    min: [0, 'Price cannot be negative'],
    default: 0
  },
  costPrice: {
    type: Number,
    required: [true, 'Cost price is required'],
    min: [0, 'Cost price cannot be negative'],
    default: 0
  },
  reorderLevel: {
    type: Number,
    default: 20,
    min: 0
  },
  reorderQuantity: {
    type: Number,
    default: 50,
    min: 0
  },
  batchNumber: {
    type: String,
    trim: true,
    index: true
  },
  expiryDate: {
    type: Date,
    index: true,
    validate: {
      validator: function(v) {
        return !v || v > new Date();
      },
      message: 'Expiry date must be in the future'
    }
  },
  nafdacNumber: {
    type: String,
    trim: true,
    uppercase: true
  },
  requiresPrescription: {
    type: Boolean,
    default: false
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  barcode: {
    type: String,
    unique: true,
    sparse: true
  },
  imageUrl: {
    type: String,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  taxRate: {
    type: Number,
    default: 7.5, // Nigerian VAT
    min: 0,
    max: 100
  },
  discountRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  minimumStock: {
    type: Number,
    default: 5
  },
  maximumStock: {
    type: Number,
    default: 1000
  },
  location: {
    shelf: String,
    rack: String,
    bin: String
  },
  supplier: {
    name: String,
    phone: String,
    email: String,
    address: String
  },
  metadata: {
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    notes: String,
    tags: [String]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
productSchema.index({ name: 'text', genericName: 'text' });
productSchema.index({ category: 1 });
productSchema.index({ 'currentStock.packs': 1, 'currentStock.units': 1 });
productSchema.index({ expiryDate: 1 });
productSchema.index({ batchNumber: 1 });
productSchema.index({ nafdacNumber: 1 });
productSchema.index({ requiresPrescription: 1 });
productSchema.index({ isActive: 1 });

// Virtual for total units in stock
productSchema.virtual('totalUnits').get(function() {
  return (this.currentStock.packs * this.packSize) + this.currentStock.units;
});


// backend/src/models/Product.js
// Add this method to your Product schema

// Method to update stock
productSchema.methods.updateStock = async function(packs, units, operation = 'add') {
    let newPacks = this.currentStock.packs;
    let newUnits = this.currentStock.units;
    
    if (operation === 'add') {
      newPacks += packs;
      newUnits += units;
    } else if (operation === 'remove') {
      let totalUnitsToRemove = (packs * this.packSize) + units;
      let currentTotalUnits = (newPacks * this.packSize) + newUnits;
      
      if (totalUnitsToRemove > currentTotalUnits) {
        throw new Error('Insufficient stock');
      }
      
      newPacks -= packs;
      newUnits -= units;
      
      // Handle negative units by borrowing from packs
      while (newUnits < 0 && newPacks > 0) {
        newPacks--;
        newUnits += this.packSize;
      }
    }
    
    // Ensure non-negative values
    newPacks = Math.max(0, newPacks);
    newUnits = Math.max(0, newUnits);
    
    this.currentStock = { packs: newPacks, units: newUnits };
    await this.save();
    
    return this;
  };
  
  // Static method to get low stock products
  productSchema.statics.getLowStockProducts = async function() {
    return await this.find({
      $expr: {
        $lt: [
          { $add: [
            { $multiply: ['$currentStock.packs', '$packSize'] },
            '$currentStock.units'
          ] },
          '$reorderLevel'
        ]
      },
      isActive: true,
      isDeleted: false
    }).populate('category');
  };
  
  // Static method to get expiring products
  productSchema.statics.getExpiringProducts = async function(days = 90) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    
    return await this.find({
      expiryDate: { $lte: futureDate, $gte: new Date() },
      isActive: true,
      isDeleted: false
    }).populate('category');
  };
// Virtual for total value
productSchema.virtual('totalValue').get(function() {
  const avgPrice = this.pricePerUnit || (this.pricePerPack / this.packSize);
  return this.totalUnits * avgPrice;
});

// Virtual for stock status
productSchema.virtual('stockStatus').get(function() {
  const total = this.totalUnits;
  if (total === 0) return 'out_of_stock';
  if (total < this.reorderLevel) return 'low_stock';
  if (total < this.reorderLevel * 2) return 'moderate';
  return 'good';
});

// Virtual for expiry status
productSchema.virtual('expiryStatus').get(function() {
  if (!this.expiryDate) return 'no_expiry';
  
  const today = new Date();
  const daysUntilExpiry = Math.ceil((this.expiryDate - today) / (1000 * 60 * 60 * 24));
  
  if (daysUntilExpiry < 0) return 'expired';
  if (daysUntilExpiry <= 30) return 'expiring_soon';
  if (daysUntilExpiry <= 90) return 'near_expiry';
  return 'valid';
});

// Virtual for profit margin
productSchema.virtual('profitMargin').get(function() {
  const sellingPrice = this.pricePerUnit || (this.pricePerPack / this.packSize);
  if (sellingPrice === 0) return 0;
  return ((sellingPrice - this.costPrice) / sellingPrice) * 100;
});

// Method to update stock
productSchema.methods.updateStock = async function(packs, units, operation = 'add') {
  let newPacks = this.currentStock.packs;
  let newUnits = this.currentStock.units;
  
  if (operation === 'add') {
    newPacks += packs;
    newUnits += units;
  } else if (operation === 'remove') {
    let totalUnitsToRemove = (packs * this.packSize) + units;
    let currentTotalUnits = (newPacks * this.packSize) + newUnits;
    
    if (totalUnitsToRemove > currentTotalUnits) {
      throw new Error('Insufficient stock');
    }
    
    newPacks -= packs;
    newUnits -= units;
    
    // Handle negative units by borrowing from packs
    while (newUnits < 0 && newPacks > 0) {
      newPacks--;
      newUnits += this.packSize;
    }
  }
  
  this.currentStock = { packs: newPacks, units: newUnits };
  await this.save();
  
  return this;
};

// Method to check if stock is sufficient
productSchema.methods.hasSufficientStock = function(packs, units) {
  const requestedUnits = (packs * this.packSize) + units;
  const availableUnits = this.totalUnits;
  return requestedUnits <= availableUnits;
};

// Method to calculate price for given quantity
productSchema.methods.calculatePrice = function(packs, units) {
  const packPrice = packs * this.pricePerPack;
  const unitPrice = units * this.pricePerUnit;
  const subtotal = packPrice + unitPrice;
  const tax = subtotal * (this.taxRate / 100);
  const discount = subtotal * (this.discountRate / 100);
  
  return {
    subtotal,
    tax,
    discount,
    total: subtotal + tax - discount
  };
};

// Static method to get low stock products
productSchema.statics.getLowStockProducts = async function() {
  return await this.find({
    $expr: {
      $lt: [
        { $add: [
          { $multiply: ['$currentStock.packs', '$packSize'] },
          '$currentStock.units'
        ] },
        '$reorderLevel'
      ]
    },
    isActive: true,
    isDeleted: false
  }).populate('category');
};

// Static method to get expiring products
productSchema.statics.getExpiringProducts = async function(days = 90) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  
  return await this.find({
    expiryDate: { $lte: futureDate, $gte: new Date() },
    isActive: true,
    isDeleted: false
  }).populate('category');
};

// Middleware to handle product deletion
productSchema.pre('remove', async function(next) {
  // Check if product has any transactions
  const Transaction = mongoose.model('Transaction');
  const hasTransactions = await Transaction.exists({ 'items.productId': this._id });
  
  if (hasTransactions) {
    this.isDeleted = true;
    this.isActive = false;
    await this.save();
    next(new Error('Product has transactions, marked as deleted instead'));
  } else {
    next();
  }
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;