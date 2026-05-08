// backend/src/models/Category.js
const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Category name is required'],
    unique: true,
    trim: true,
    minlength: [2, 'Category name must be at least 2 characters'],
    maxlength: [50, 'Category name cannot exceed 50 characters']
  },
  description: {
    type: String,
    maxlength: [200, 'Description cannot exceed 200 characters'],
    default: ''
  },
  parentCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null
  },
  icon: {
    type: String,
    default: 'Package'
  },
  color: {
    type: String,
    default: '#3B82F6'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  displayOrder: {
    type: Number,
    default: 0
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
    productCount: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
categorySchema.index({ name: 1 });
categorySchema.index({ parentCategory: 1 });
categorySchema.index({ isActive: 1 });
categorySchema.index({ displayOrder: 1 });

// Virtual for products in this category
categorySchema.virtual('products', {
  ref: 'Product',
  localField: '_id',
  foreignField: 'category',
  justOne: false
});

// Virtual for subcategories
categorySchema.virtual('subcategories', {
  ref: 'Category',
  localField: '_id',
  foreignField: 'parentCategory',
  justOne: false
});

// Virtual for full path
categorySchema.virtual('fullPath').get(async function() {
  const path = [this.name];
  let current = this;
  
  while (current.parentCategory) {
    await current.populate('parentCategory');
    current = current.parentCategory;
    path.unshift(current.name);
  }
  
  return path.join(' > ');
});

// Method to update product count
categorySchema.methods.updateProductCount = async function() {
  const Product = mongoose.model('Product');
  const count = await Product.countDocuments({ 
    category: this._id,
    isActive: true,
    isDeleted: false
  });
  
  this.metadata.productCount = count;
  await this.save();
  
  return count;
};

// Static method to get category tree
categorySchema.statics.getCategoryTree = async function() {
  const categories = await this.find({ isActive: true }).sort('displayOrder');
  const categoryMap = {};
  const roots = [];
  
  categories.forEach(category => {
    categoryMap[category._id] = { ...category.toObject(), children: [] };
  });
  
  categories.forEach(category => {
    if (category.parentCategory) {
      if (categoryMap[category.parentCategory]) {
        categoryMap[category.parentCategory].children.push(categoryMap[category._id]);
      }
    } else {
      roots.push(categoryMap[category._id]);
    }
  });
  
  return roots;
};

// Static method to get popular categories
categorySchema.statics.getPopularCategories = async function(limit = 5) {
  return await this.find({ isActive: true })
    .sort('-metadata.productCount')
    .limit(limit)
    .populate('products');
};

// Pre-remove middleware
categorySchema.pre('remove', async function(next) {
  const Product = mongoose.model('Product');
  const productsExist = await Product.exists({ category: this._id });
  
  if (productsExist) {
    next(new Error('Cannot delete category with associated products'));
  } else {
    next();
  }
});

// Post-save middleware to update product count
categorySchema.post('save', async function() {
  await this.updateProductCount();
  
  if (this.parentCategory) {
    const parent = await mongoose.model('Category').findById(this.parentCategory);
    if (parent) await parent.updateProductCount();
  }
});

const Category = mongoose.model('Category', categorySchema);

module.exports = Category;