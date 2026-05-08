// backend/src/controllers/productController.js
const Product = require('../models/Product');
const Category = require('../models/Category');
const Inventory = require('../models/Inventory');
const mongoose = require('mongoose');

// @desc    Get all products
// @route   GET /api/products
// @access  Private
// backend/src/controllers/productController.js
// Update the getProducts function

exports.getProducts = async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;
      
      // Build filter object
      const filter = { isDeleted: false };
      
      // Handle category filtering - accept both ID and name
      if (req.query.category) {
        const Category = require('../models/Category');
        
        // Check if the category is a valid MongoDB ObjectId
        const mongoose = require('mongoose');
        const isValidObjectId = mongoose.Types.ObjectId.isValid(req.query.category);
        
        if (isValidObjectId) {
          // If it's a valid ObjectId, use it directly
          filter.category = req.query.category;
        } else {
          // If it's not an ObjectId, treat it as a category name and find the ID
          const category = await Category.findOne({ 
            name: { $regex: new RegExp(`^${req.query.category}$`, 'i') } 
          });
          if (category) {
            filter.category = category._id;
          } else {
            // If category not found, return empty results
            return res.status(200).json({
              success: true,
              products: [],
              total: 0,
              page,
              totalPages: 0,
              currentPage: page
            });
          }
        }
      }
      
      if (req.query.isActive) {
        filter.isActive = req.query.isActive === 'true';
      }
      
      if (req.query.requiresPrescription) {
        filter.requiresPrescription = req.query.requiresPrescription === 'true';
      }
      
      if (req.query.lowStock === 'true') {
        filter.$expr = {
          $lt: [
            { $add: [
              { $multiply: ['$currentStock.packs', '$packSize'] },
              '$currentStock.units'
            ] },
            '$reorderLevel'
          ]
        };
      }
      
      if (req.query.search) {
        filter.$or = [
          { name: { $regex: req.query.search, $options: 'i' } },
          { genericName: { $regex: req.query.search, $options: 'i' } },
          { batchNumber: { $regex: req.query.search, $options: 'i' } }
        ];
      }
  
      const products = await Product.find(filter)
        .populate('category', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
  
      const total = await Product.countDocuments(filter);
  
      res.status(200).json({
        success: true,
        products,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        currentPage: page
      });
    } catch (error) {
      console.error('Get products error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching products',
        error: error.message
      });
    }
  };

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Private
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('category', 'name description');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.status(200).json({
      success: true,
      product
    });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching product'
    });
  }
};

// @desc    Create new product
// @route   POST /api/products
// @access  Private (Admin only)
exports.createProduct = async (req, res) => {
  try {
    const {
      name,
      genericName,
      category,
      manufacturer,
      unitType,
      packSize,
      currentStock,
      pricePerUnit,
      pricePerPack,
      costPrice,
      reorderLevel,
      reorderQuantity,
      batchNumber,
      expiryDate,
      nafdacNumber,
      requiresPrescription,
      description,
      taxRate,
      discountRate
    } = req.body;

    // Check if product already exists
    const existingProduct = await Product.findOne({ name });
    if (existingProduct) {
      return res.status(400).json({
        success: false,
        message: 'Product with this name already exists'
      });
    }

    // Verify category exists
    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category'
      });
    }

    // Create product
    const product = await Product.create({
      name,
      genericName,
      category,
      manufacturer,
      unitType,
      packSize: packSize || 1,
      currentStock: currentStock || { packs: 0, units: 0 },
      pricePerUnit,
      pricePerPack,
      costPrice,
      reorderLevel,
      reorderQuantity,
      batchNumber,
      expiryDate,
      nafdacNumber,
      requiresPrescription: requiresPrescription || false,
      description,
      taxRate: taxRate || 7.5,
      discountRate: discountRate || 0,
      'metadata.createdBy': req.user.id
    });

    // Create initial inventory record if stock > 0
    if (currentStock && (currentStock.packs > 0 || currentStock.units > 0)) {
      await Inventory.create({
        productId: product._id,
        movementType: 'restock',
        quantityPacks: currentStock.packs || 0,
        quantityUnits: currentStock.units || 0,
        previousStock: { packs: 0, units: 0 },
        newStock: currentStock,
        performedBy: req.user.id,
        notes: 'Initial stock setup'
      });
    }

    res.status(201).json({
      success: true,
      product,
      message: 'Product created successfully'
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating product'
    });
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private (Admin only)
exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Update fields
    const allowedUpdates = [
      'name', 'genericName', 'category', 'manufacturer', 'unitType',
      'packSize', 'pricePerUnit', 'pricePerPack', 'costPrice', 'reorderLevel',
      'reorderQuantity', 'batchNumber', 'expiryDate', 'nafdacNumber',
      'requiresPrescription', 'description', 'isActive', 'taxRate', 'discountRate'
    ];
    
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        product[field] = req.body[field];
      }
    });

    product.metadata.updatedBy = req.user.id;
    await product.save();

    res.status(200).json({
      success: true,
      product,
      message: 'Product updated successfully'
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating product'
    });
  }
};

// @desc    Delete product (soft delete)
// @route   DELETE /api/products/:id
// @access  Private (Admin only)
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if product has any transactions
    const Transaction = mongoose.model('Transaction');
    const hasTransactions = await Transaction.exists({ 'items.productId': product._id });
    
    if (hasTransactions) {
      // Soft delete
      product.isDeleted = true;
      product.isActive = false;
      await product.save();
      
      return res.status(200).json({
        success: true,
        message: 'Product marked as deleted (has transaction history)'
      });
    } else {
      // Hard delete
      await product.remove();
      
      return res.status(200).json({
        success: true,
        message: 'Product deleted permanently'
      });
    }
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting product'
    });
  }
};

// backend/src/controllers/productController.js
// Add this function after your other exports

// @desc    Get all categories
// @route   GET /api/products/categories
// @access  Private
exports.getCategories = async (req, res) => {
    try {
      const categories = await Category.find({ isActive: true }).sort('displayOrder name');
      
      res.status(200).json({
        success: true,
        categories: categories,
        count: categories.length
      });
    } catch (error) {
      console.error('Get categories error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching categories',
        categories: []
      });
    }
  };
  
  // @desc    Create new category
  // @route   POST /api/products/categories
  // @access  Private (Admin only)
  exports.createCategory = async (req, res) => {
    try {
      const { name, description, parentCategory, icon, color, displayOrder } = req.body;
      
      // Check if category already exists
      const existingCategory = await Category.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
      if (existingCategory) {
        return res.status(400).json({
          success: false,
          message: 'Category with this name already exists'
        });
      }
      
      const category = await Category.create({
        name,
        description,
        parentCategory: parentCategory || null,
        icon: icon || 'Package',
        color: color || '#3B82F6',
        displayOrder: displayOrder || 0,
        isActive: true,
        'metadata.createdBy': req.user.id
      });
      
      res.status(201).json({
        success: true,
        category,
        message: 'Category created successfully'
      });
    } catch (error) {
      console.error('Create category error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error creating category'
      });
    }
  };
  
  // @desc    Update category
  // @route   PUT /api/products/categories/:id
  // @access  Private (Admin only)
 // @desc    Update category
// @route   PUT /api/products/categories/:id
// @access  Private (Admin only)
exports.updateCategory = async (req, res) => {
    try {
      const { name, description, parentCategory, icon, color, displayOrder, isActive } = req.body;
  
      // Check category exists first
      const exists = await Category.exists({ _id: req.params.id });
      if (!exists) {
        return res.status(404).json({
          success: false,
          message: 'Category not found'
        });
      }
  
      // Build update object
      const updateFields = { 'metadata.updatedBy': req.user.id };
      if (name !== undefined)             updateFields.name = name;
      if (description !== undefined)      updateFields.description = description;
      if (parentCategory !== undefined)   updateFields.parentCategory = parentCategory;
      if (icon !== undefined)             updateFields.icon = icon;
      if (color !== undefined)            updateFields.color = color;
      if (displayOrder !== undefined)     updateFields.displayOrder = displayOrder;
      if (isActive !== undefined)         updateFields.isActive = isActive;
  
      // Use findByIdAndUpdate to bypass any slow pre/post save middleware
      const category = await Category.findByIdAndUpdate(
        req.params.id,
        { $set: updateFields },
        { new: true, runValidators: true }
      );
  
      res.status(200).json({
        success: true,
        category,
        message: 'Category updated successfully'
      });
    } catch (error) {
      console.error('Update category error:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating category'
      });
    }
  };
  
  // @desc    Delete category
  // @route   DELETE /api/products/categories/:id
  // @access  Private (Admin only)
// @desc    Delete category
// @route   DELETE /api/products/categories/:id
// @access  Private (Admin only)
exports.deleteCategory = async (req, res) => {
    try {
      const category = await Category.findById(req.params.id);
  
      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Category not found'
        });
      }
  
      // Check if category has products
      const Product = require('../models/Product');
      const productsCount = await Product.countDocuments({ category: category._id });
  
      if (productsCount > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot delete category with ${productsCount} products. Please reassign or delete products first.`
        });
      }
  
      // Use findByIdAndDelete instead of the deprecated category.remove()
      await Category.findByIdAndDelete(req.params.id);
  
      res.status(200).json({
        success: true,
        message: 'Category deleted successfully'
      });
    } catch (error) {
      console.error('Delete category error:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting category'
      });
    }
  };

// @desc    Search products
// @route   GET /api/products/search
// @access  Private
exports.searchProducts = async (req, res) => {
  try {
    const { q, category, limit = 20 } = req.query;
    
    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const filter = {
      isActive: true,
      isDeleted: false,
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { genericName: { $regex: q, $options: 'i' } },
        { batchNumber: { $regex: q, $options: 'i' } }
      ]
    };
    
    if (category && category !== 'all') {
      filter.category = category;
    }

    const products = await Product.find(filter)
      .populate('category', 'name')
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      products,
      count: products.length
    });
  } catch (error) {
    console.error('Search products error:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching products'
    });
  }
};

// @desc    Get low stock products
// @route   GET /api/products/low-stock
// @access  Private
exports.getLowStockProducts = async (req, res) => {
  try {
    const products = await Product.getLowStockProducts();
    
    res.status(200).json({
      success: true,
      products,
      count: products.length
    });
  } catch (error) {
    console.error('Get low stock error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching low stock products'
    });
  }
};

// @desc    Get expiring products
// @route   GET /api/products/expiring
// @access  Private
exports.getExpiringProducts = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 90;
    const products = await Product.getExpiringProducts(days);
    
    res.status(200).json({
      success: true,
      products,
      count: products.length
    });
  } catch (error) {
    console.error('Get expiring products error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching expiring products'
    });
  }
};

// @desc    Update product stock
// @route   PUT /api/products/:id/stock
// @access  Private (Admin only)
exports.updateStock = async (req, res) => {
  try {
    const { packs, units, type, reason } = req.body;
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const previousStock = { ...product.currentStock };
    
    if (type === 'add') {
      await product.updateStock(packs, units, 'add');
    } else if (type === 'remove') {
      await product.updateStock(packs, units, 'remove');
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid stock update type'
      });
    }

    // Create inventory record
    await Inventory.create({
      productId: product._id,
      movementType: 'adjustment',
      quantityPacks: packs,
      quantityUnits: units,
      previousStock,
      newStock: product.currentStock,
      performedBy: req.user.id,
      notes: reason || 'Manual stock adjustment'
    });

    res.status(200).json({
      success: true,
      product,
      message: 'Stock updated successfully'
    });
  } catch (error) {
    console.error('Update stock error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating stock'
    });
  }
};

// @desc    Bulk import products
// @route   POST /api/products/bulk-import
// @access  Private (Admin only)
exports.bulkImportProducts = async (req, res) => {
  try {
    const { products } = req.body;
    
    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of products'
      });
    }

    const results = {
      total: products.length,
      imported: 0,
      failed: 0,
      errors: []
    };

    for (const productData of products) {
      try {
        // Check if product exists
        const existing = await Product.findOne({ name: productData.name });
        if (existing) {
          results.failed++;
          results.errors.push({
            name: productData.name,
            error: 'Product already exists'
          });
          continue;
        }

        // Create product
        await Product.create({
          ...productData,
          'metadata.createdBy': req.user.id
        });
        
        results.imported++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          name: productData.name,
          error: error.message
        });
      }
    }

    res.status(200).json({
      success: true,
      results,
      message: `Imported ${results.imported} of ${results.total} products`
    });
  } catch (error) {
    console.error('Bulk import error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during bulk import'
    });
  }
};