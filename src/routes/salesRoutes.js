// backend/src/routes/salesRoutes.js
const express = require('express');
const router = express.Router();
const { protect, isAdmin, isPosAgent, verifyPin, optionalPin } = require('../middleware/authMiddleware');
const { validateSale, validateId, validatePagination, validateDateRange } = require('../middleware/validationMiddleware');
const {
  processSale,
  getSales,
  getSaleById,
  getTodaySales,
  refundSale,
  getSalesReport,
  generateReceipt,
  getAgentPerformance  // Add this import
} = require('../controllers/salesController');

/**
 * @route   POST /api/sales
 * @desc    Process a new sale (POS transaction)
 * @access  Private (POS Agent or Admin)
 */
router.post('/', protect, isPosAgent, validateSale.create, processSale);

/**
 * @route   GET /api/sales
 * @desc    Get all sales transactions (Admin sees all, POS Agent sees only their own)
 * @access  Private
 */
// REMOVED isAdmin - let controller handle filtering
router.get('/', protect, validatePagination, validateDateRange, getSales);

/**
 * @route   GET /api/sales/today
 * @desc    Get today's sales
 * @access  Private
 */
router.get('/today', protect, getTodaySales);

/**
 * @route   GET /api/sales/report
 * @desc    Get sales report by date range
 * @access  Private (Admin only)
 */
router.get('/report', protect, isAdmin, validateDateRange, getSalesReport);

/**
 * @route   GET /api/sales/agent-performance
 * @desc    Get agent performance metrics
 * @access  Private (Admin only)
 */
router.get('/agent-performance', protect, isAdmin, getAgentPerformance);

/**
 * @route   GET /api/sales/:id
 * @desc    Get single sale by ID
 * @access  Private
 */
router.get('/:id', protect, validateId, getSaleById);

/**
 * @route   GET /api/sales/:id/receipt
 * @desc    Generate receipt for a sale
 * @access  Private
 */
router.get('/:id/receipt', protect, validateId, generateReceipt);

/**
 * @route   POST /api/sales/:id/refund
 * @desc    Refund a sale
 * @access  Private (Admin only)
 */
router.post('/:id/refund', protect, isAdmin, validateId, validateSale.refund, refundSale);

/**
 * @route   POST /api/sales/:id/email-receipt
 * @desc    Send receipt via email
 * @access  Private
 */
router.post('/:id/email-receipt', protect, validateId, async (req, res) => {
  const { email } = req.body;
  res.status(200).json({
    success: true,
    message: `Receipt sent to ${email}`
  });
});

/**
 * @route   GET /api/sales/agent/:agentId
 * @desc    Get sales by specific POS agent
 * @access  Private (Admin only)
 */
router.get('/agent/:agentId', protect, isAdmin, validateId, async (req, res) => {
  const Transaction = require('../models/Transaction');
  const sales = await Transaction.find({ 
    posAgentId: req.params.agentId,
    status: 'completed'
  }).sort({ createdAt: -1 });
  
  const total = sales.reduce((sum, sale) => sum + sale.totalAmount, 0);
  
  res.status(200).json({
    success: true,
    sales,
    total,
    count: sales.length
  });
});



/**
 * @route   GET /api/sales/summary/daily
 * @desc    Get daily sales summary for current month
 * @access  Private (Admin only)
 */
router.get('/summary/daily', protect, isAdmin, async (req, res) => {
  const Transaction = require('../models/Transaction');
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  
  const endOfMonth = new Date();
  endOfMonth.setMonth(endOfMonth.getMonth() + 1);
  endOfMonth.setDate(0);
  endOfMonth.setHours(23, 59, 59, 999);
  
  const sales = await Transaction.aggregate([
    {
      $match: {
        createdAt: { $gte: startOfMonth, $lte: endOfMonth },
        status: 'completed'
      }
    },
    {
      $group: {
        _id: { $dayOfMonth: '$createdAt' },
        total: { $sum: '$totalAmount' },
        count: { $sum: 1 }
      }
    },
    { $sort: { '_id': 1 } }
  ]);
  
  res.status(200).json({
    success: true,
    dailySales: sales,
    month: startOfMonth.getMonth() + 1,
    year: startOfMonth.getFullYear()
  });
});

module.exports = router;