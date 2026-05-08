// backend/src/routes/inventoryRoutes.js
const express = require('express');
const router = express.Router();
const { protect, isAdmin } = require('../middleware/authMiddleware');
const {
  getInventoryMovements,
  addStock,
  removeStock,
  getInventoryValuation,
  getStockTurnover,
  getLowStockItems,
  getExpiringItems,
  getInventorySummary
} = require('../controllers/inventoryController');

// All routes require authentication
router.use(protect);

// Public (authenticated) routes - anyone can view
router.get('/movements', getInventoryMovements);
router.get('/valuation', getInventoryValuation);
router.get('/turnover', getStockTurnover);
router.get('/low-stock', getLowStockItems);
router.get('/expiring', getExpiringItems);
router.get('/summary', getInventorySummary);

// Admin only routes (require admin role)
router.post('/add-stock', isAdmin, addStock);
router.post('/remove-stock', isAdmin, removeStock);
router.post('/stock-count', isAdmin, (req, res) => {
  // Optional: implement stock count functionality
  res.status(200).json({
    success: true,
    message: 'Stock count recorded'
  });
});

// Get single movement by ID
router.get('/movements/:id', async (req, res) => {
  try {
    const movement = await Inventory.findById(req.params.id)
      .populate('productId', 'name genericName')
      .populate('performedBy', 'name email');
    
    if (!movement) {
      return res.status(404).json({
        success: false,
        message: 'Movement not found'
      });
    }
    
    res.status(200).json({
      success: true,
      movement
    });
  } catch (error) {
    console.error('Get movement error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching movement'
    });
  }
});

// Get inventory history for a specific product
router.get('/product/:productId', async (req, res) => {
  try {
    const movements = await Inventory.find({ productId: req.params.productId })
      .sort({ createdAt: -1 })
      .populate('performedBy', 'name email');
    
    res.status(200).json({
      success: true,
      movements,
      count: movements.length
    });
  } catch (error) {
    console.error('Get product inventory error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching product inventory'
    });
  }
});

module.exports = router;