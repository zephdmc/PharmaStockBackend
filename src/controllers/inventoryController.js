// backend/src/controllers/inventoryController.js
const Inventory = require('../models/Inventory');
const Product = require('../models/Product');
const StockAdjustment = require('../models/StockAdjustment');

// @desc    Get inventory movements
// @route   GET /api/inventory/movements
// @access  Private
exports.getInventoryMovements = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    
    const filter = {};
    
    if (req.query.productId) {
      filter.productId = req.query.productId;
    }
    
    if (req.query.movementType) {
      filter.movementType = req.query.movementType;
    }
    
    if (req.query.startDate && req.query.endDate) {
      filter.createdAt = {
        $gte: new Date(req.query.startDate),
        $lte: new Date(req.query.endDate)
      };
    }

    const movements = await Inventory.find(filter)
      .populate('productId', 'name genericName unitType packSize')
      .populate('performedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Inventory.countDocuments(filter);

    res.status(200).json({
      success: true,
      movements,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Get movements error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching inventory movements'
    });
  }
};

// @desc    Add stock (restock)
// @route   POST /api/inventory/add-stock
// @access  Private (Admin only)
// backend/src/controllers/inventoryController.js
// Update your addStock function

exports.addStock = async (req, res) => {
    try {
      const { 
        productId, 
        packs, 
        units, 
        batchNumber, 
        expiryDate, 
        costPerUnit,
        note 
      } = req.body;
  
      const product = await Product.findById(productId);
      
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }
  
      const previousStock = { ...product.currentStock };
      
      // Update stock
      await product.updateStock(packs, units, 'add');
      
      // Create inventory record - DON'T include referenceModel if null
      const inventoryData = {
        productId: product._id,
        movementType: 'restock',
        quantityPacks: packs || 0,
        quantityUnits: units || 0,
        previousStock,
        newStock: product.currentStock,
        performedBy: req.user.id,
        notes: note || 'Restock',
        batchNumber: batchNumber || null,
        costPerUnit: costPerUnit || product.costPrice,
        totalCost: ((packs || 0) * (product.packSize || 1) + (units || 0)) * (costPerUnit || product.costPrice || 0)
      };
      
      // Only add referenceId if it exists
      if (req.body.referenceId) {
        inventoryData.referenceId = req.body.referenceId;
      }
      
      const inventory = await Inventory.create(inventoryData);
  
      // Create stock adjustment record - handle null values properly
      const adjustmentData = {
        productId: product._id,
        adjustmentType: 'add',
        category: 'restock',
        quantityPacks: packs || 0,
        quantityUnits: units || 0,
        previousStock,
        newStock: product.currentStock,
        reason: note || 'Restock from supplier',
        performedBy: req.user.id,
        approvedBy: req.user.id,
        verificationStatus: 'verified'
      };
      
      // Add optional fields only if they exist
      if (batchNumber) adjustmentData.batchNumber = batchNumber;
      if (expiryDate) adjustmentData.expiryDate = expiryDate;
      if (costPerUnit) {
        adjustmentData.costPerUnit = costPerUnit;
        adjustmentData.totalCost = ((packs || 0) * (product.packSize || 1) + (units || 0)) * costPerUnit;
      }
      
      await StockAdjustment.create(adjustmentData);
  
      res.status(200).json({
        success: true,
        inventory,
        product: {
          _id: product._id,
          name: product.name,
          currentStock: product.currentStock,
          totalUnits: (product.currentStock.packs * product.packSize) + product.currentStock.units
        },
        message: 'Stock added successfully'
      });
    } catch (error) {
      console.error('Add stock error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error adding stock'
      });
    }
  };

// @desc    Remove stock (adjustment)
// @route   POST /api/inventory/remove-stock
// @access  Private (Admin only)
// backend/src/controllers/inventoryController.js
// Update your removeStock function

exports.removeStock = async (req, res) => {
    try {
      const { productId, packs, units, reason, note } = req.body;
  
      const product = await Product.findById(productId);
      
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }
  
      // Check if enough stock
      const currentTotal = (product.currentStock.packs || 0) * (product.packSize || 1) + (product.currentStock.units || 0);
      const removeTotal = (packs || 0) * (product.packSize || 1) + (units || 0);
      
      if (removeTotal > currentTotal) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock. Available: ${currentTotal} units, Requested to remove: ${removeTotal} units`
        });
      }
  
      const previousStock = { ...product.currentStock };
      
      // Update stock
      await product.updateStock(packs, units, 'remove');
      
      // Create inventory record - DON'T include referenceModel if null
      const inventoryData = {
        productId: product._id,
        movementType: 'adjustment',
        quantityPacks: packs || 0,
        quantityUnits: units || 0,
        previousStock,
        newStock: product.currentStock,
        performedBy: req.user.id,
        notes: note || reason || 'Stock removal'
      };
      
      const inventory = await Inventory.create(inventoryData);
  
      // Create stock adjustment record
      const adjustmentData = {
        productId: product._id,
        adjustmentType: 'remove',
        category: reason || 'adjustment',
        quantityPacks: packs || 0,
        quantityUnits: units || 0,
        previousStock,
        newStock: product.currentStock,
        reason: note || reason || 'Stock removal',
        performedBy: req.user.id,
        approvedBy: req.user.id,
        verificationStatus: 'verified'
      };
      
      await StockAdjustment.create(adjustmentData);
  
      res.status(200).json({
        success: true,
        inventory,
        product: {
          _id: product._id,
          name: product.name,
          currentStock: product.currentStock,
          totalUnits: (product.currentStock.packs * product.packSize) + product.currentStock.units
        },
        message: 'Stock removed successfully'
      });
    } catch (error) {
      console.error('Remove stock error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error removing stock'
      });
    }
  };

// @desc    Get inventory valuation
// @route   GET /api/inventory/valuation
// @access  Private
exports.getInventoryValuation = async (req, res) => {
  try {
    const valuation = await Inventory.getInventoryValuation();
    
    res.status(200).json({
      success: true,
      valuation
    });
  } catch (error) {
    console.error('Get valuation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching inventory valuation'
    });
  }
};

// @desc    Get stock turnover rate
// @route   GET /api/inventory/turnover
// @access  Private
exports.getStockTurnover = async (req, res) => {
  try {
    const { productId, days } = req.query;
    
    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
    }

    const turnover = await Inventory.getTurnoverRate(productId, parseInt(days) || 365);
    
    res.status(200).json({
      success: true,
      turnover
    });
  } catch (error) {
    console.error('Get turnover error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching stock turnover'
    });
  }
};

// @desc    Get low stock items
// @route   GET /api/inventory/low-stock
// @access  Private
exports.getLowStockItems = async (req, res) => {
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
      message: 'Error fetching low stock items'
    });
  }
};

// @desc    Get expiring items
// @route   GET /api/inventory/expiring
// @access  Private
exports.getExpiringItems = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 90;
    const products = await Product.getExpiringProducts(days);
    
    res.status(200).json({
      success: true,
      products,
      count: products.length,
      days
    });
  } catch (error) {
    console.error('Get expiring items error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching expiring items'
    });
  }
};

// @desc    Get inventory summary
// @route   GET /api/inventory/summary
// @access  Private
exports.getInventorySummary = async (req, res) => {
  try {
    const totalProducts = await Product.countDocuments({ isActive: true, isDeleted: false });
    const lowStock = await Product.countDocuments({
      $expr: {
        $lt: [
          { $add: [
            { $multiply: ['$currentStock.packs', '$packSize'] },
            '$currentStock.units'
          ] },
          '$reorderLevel'
        ]
      }
    });
    
    const outOfStock = await Product.countDocuments({
      $expr: {
        $eq: [
          { $add: [
            { $multiply: ['$currentStock.packs', '$packSize'] },
            '$currentStock.units'
          ] },
          0
        ]
      }
    });
    
    const valuation = await Inventory.getInventoryValuation();
    
    res.status(200).json({
      success: true,
      summary: {
        totalProducts,
        lowStock,
        outOfStock,
        totalValue: valuation.totalValue
      }
    });
  } catch (error) {
    console.error('Get inventory summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching inventory summary'
    });
  }
};