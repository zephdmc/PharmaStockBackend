// backend/src/routes/reportRoutes.js
const express = require('express');
const router = express.Router();
const { protect, isAdmin } = require('../middleware/authMiddleware');
const { validateReport, validateDateRange } = require('../middleware/validationMiddleware');
const {
  getSalesReport,
  getInventoryReport,
  getProfitLossReport,
  getTaxReport,
  exportReport
} = require('../controllers/reportController');

/**
 * @route   GET /api/reports/sales
 * @desc    Generate sales report
 * @access  Private (Admin only)
 */
router.get('/sales', protect, isAdmin, validateReport.getSalesReport, getSalesReport);

/**
 * @route   GET /api/reports/inventory
 * @desc    Generate inventory report
 * @access  Private (Admin only)
 */
router.get('/inventory', protect, isAdmin, getInventoryReport);

/**
 * @route   GET /api/reports/profit-loss
 * @desc    Generate profit & loss report
 * @access  Private (Admin only)
 */
router.get('/profit-loss', protect, isAdmin, validateReport.getProfitLoss, getProfitLossReport);

/**
 * @route   GET /api/reports/tax
 * @desc    Generate tax (VAT) report
 * @access  Private (Admin only)
 */
router.get('/tax', protect, isAdmin, validateDateRange, getTaxReport);

/**
 * @route   POST /api/reports/export
 * @desc    Export report to PDF or Excel
 * @access  Private (Admin only)
 */
router.post('/export', protect, isAdmin, exportReport);

/**
 * @route   GET /api/reports/low-stock
 * @desc    Generate low stock report
 * @access  Private (Admin only)
 */
router.get('/low-stock', protect, isAdmin, async (req, res) => {
  const Product = require('../models/Product');
  const lowStockProducts = await Product.getLowStockProducts();
  
  res.status(200).json({
    success: true,
    report: {
      title: 'Low Stock Report',
      generatedAt: new Date(),
      totalLowStock: lowStockProducts.length,
      products: lowStockProducts.map(p => ({
        name: p.name,
        currentStock: p.totalUnits,
        reorderLevel: p.reorderLevel,
        packSize: p.packSize,
        category: p.category
      }))
    }
  });
});

/**
 * @route   GET /api/reports/expiring
 * @desc    Generate expiring products report
 * @access  Private (Admin only)
 */
router.get('/expiring', protect, isAdmin, async (req, res) => {
  const days = parseInt(req.query.days) || 90;
  const Product = require('../models/Product');
  const expiringProducts = await Product.getExpiringProducts(days);
  
  res.status(200).json({
    success: true,
    report: {
      title: 'Expiring Products Report',
      generatedAt: new Date(),
      daysThreshold: days,
      totalExpiring: expiringProducts.length,
      products: expiringProducts.map(p => ({
        name: p.name,
        batchNumber: p.batchNumber,
        expiryDate: p.expiryDate,
        daysUntilExpiry: Math.ceil((new Date(p.expiryDate) - new Date()) / (1000 * 60 * 60 * 24)),
        currentStock: p.totalUnits,
        category: p.category
      }))
    }
  });
});

/**
 * @route   GET /api/reports/daily-summary
 * @desc    Get daily summary report
 * @access  Private (Admin only)
 */
router.get('/daily-summary', protect, isAdmin, async (req, res) => {
  const Transaction = require('../models/Transaction');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const sales = await Transaction.find({
    createdAt: { $gte: today, $lt: tomorrow },
    status: 'completed'
  });
  
  const totalSales = sales.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalTransactions = sales.length;
  
  // Get top selling products
  const productSales = {};
  sales.forEach(sale => {
    sale.items.forEach(item => {
      if (!productSales[item.productName]) {
        productSales[item.productName] = {
          quantity: 0,
          revenue: 0
        };
      }
      productSales[item.productName].quantity += (item.quantityPacks * item.packSize) + item.quantityUnits;
      productSales[item.productName].revenue += item.totalPrice;
    });
  });
  
  const topProducts = Object.entries(productSales)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);
  
  res.status(200).json({
    success: true,
    report: {
      date: today,
      totalSales,
      totalTransactions,
      averageSale: totalTransactions > 0 ? totalSales / totalTransactions : 0,
      topProducts,
      paymentMethods: {
        cash: sales.filter(s => s.paymentMethod === 'cash').length,
        card: sales.filter(s => s.paymentMethod === 'card').length,
        transfer: sales.filter(s => s.paymentMethod === 'transfer').length
      }
    }
  });
});

/**
 * @route   GET /api/reports/monthly-summary
 * @desc    Get monthly summary report
 * @access  Private (Admin only)
 */
router.get('/monthly-summary', protect, isAdmin, async (req, res) => {
  const { year, month } = req.query;
  const targetYear = parseInt(year) || new Date().getFullYear();
  const targetMonth = parseInt(month) || new Date().getMonth() + 1;
  
  const Transaction = require('../models/Transaction');
  const startDate = new Date(targetYear, targetMonth - 1, 1);
  const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);
  
  const sales = await Transaction.find({
    createdAt: { $gte: startDate, $lte: endDate },
    status: 'completed'
  });
  
  const totalSales = sales.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalTransactions = sales.length;
  
  // Daily breakdown
  const dailyBreakdown = {};
  sales.forEach(sale => {
    const day = sale.createdAt.getDate();
    if (!dailyBreakdown[day]) {
      dailyBreakdown[day] = {
        sales: 0,
        transactions: 0,
        items: 0
      };
    }
    dailyBreakdown[day].sales += sale.totalAmount;
    dailyBreakdown[day].transactions += 1;
    dailyBreakdown[day].items += sale.totalUnits;
  });
  
  res.status(200).json({
    success: true,
    report: {
      year: targetYear,
      month: targetMonth,
      totalSales,
      totalTransactions,
      averageSale: totalTransactions > 0 ? totalSales / totalTransactions : 0,
      dailyBreakdown: Object.entries(dailyBreakdown).map(([day, data]) => ({
        day: parseInt(day),
        ...data
      }))
    }
  });
});

module.exports = router;