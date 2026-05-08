// backend/src/controllers/reportController.js
const Transaction = require('../models/Transaction');
const Product = require('../models/Product');
const Inventory = require('../models/Inventory');
const StockAdjustment = require('../models/StockAdjustment');
const User = require('../models/User');

// @desc    Generate sales report
// @route   GET /api/reports/sales
// @access  Private (Admin only)
exports.getSalesReport = async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Please provide start and end dates'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const transactions = await Transaction.find({
      createdAt: { $gte: start, $lte: end },
      status: 'completed'
    }).populate('posAgentId', 'name');

    // Calculate summary
    const totalRevenue = transactions.reduce((sum, t) => sum + t.totalAmount, 0);
    const totalTransactions = transactions.length;
    const totalItems = transactions.reduce((sum, t) => sum + t.totalUnits, 0);
    const averageTransaction = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

    // Group by period
    const groupedData = {};
    transactions.forEach(transaction => {
      let key;
      const date = new Date(transaction.createdAt);
      
      if (groupBy === 'hour') {
        key = date.getHours();
      } else if (groupBy === 'day') {
        key = date.toISOString().split('T')[0];
      } else if (groupBy === 'month') {
        key = `${date.getFullYear()}-${date.getMonth() + 1}`;
      } else if (groupBy === 'year') {
        key = date.getFullYear().toString();
      } else {
        key = date.toISOString().split('T')[0];
      }

      if (!groupedData[key]) {
        groupedData[key] = {
          period: key,
          sales: 0,
          transactions: 0,
          items: 0
        };
      }

      groupedData[key].sales += transaction.totalAmount;
      groupedData[key].transactions += 1;
      groupedData[key].items += transaction.totalUnits;
    });

    // Get top selling products
    const productSales = new Map();
    transactions.forEach(transaction => {
      transaction.items.forEach(item => {
        const existing = productSales.get(item.productId.toString()) || {
          productId: item.productId,
          productName: item.productName,
          quantity: 0,
          revenue: 0
        };
        existing.quantity += (item.quantityPacks * item.packSize) + item.quantityUnits;
        existing.revenue += item.totalPrice;
        productSales.set(item.productId.toString(), existing);
      });
    });

    const topProducts = Array.from(productSales.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Get sales by payment method
    const paymentMethodBreakdown = {};
    transactions.forEach(transaction => {
      const method = transaction.paymentMethod;
      if (!paymentMethodBreakdown[method]) {
        paymentMethodBreakdown[method] = {
          count: 0,
          total: 0
        };
      }
      paymentMethodBreakdown[method].count++;
      paymentMethodBreakdown[method].total += transaction.totalAmount;
    });

    res.status(200).json({
      success: true,
      report: {
        summary: {
          startDate: start,
          endDate: end,
          totalRevenue,
          totalTransactions,
          totalItems,
          averageTransaction
        },
        breakdown: Object.values(groupedData),
        topProducts,
        paymentMethodBreakdown,
        transactions: transactions.slice(0, 100) // Limit to 100 for performance
      }
    });
  } catch (error) {
    console.error('Sales report error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating sales report'
    });
  }
};

// @desc    Generate inventory report
// @route   GET /api/reports/inventory
// @access  Private (Admin only)
exports.getInventoryReport = async (req, res) => {
  try {
    const { type = 'full' } = req.query;

    const products = await Product.find({ isDeleted: false })
      .populate('category', 'name');

    // Calculate summary
    const totalProducts = products.length;
    const totalValue = products.reduce((sum, p) => sum + p.totalValue, 0);
    const lowStockProducts = products.filter(p => {
      const totalUnits = (p.currentStock.packs * p.packSize) + p.currentStock.units;
      return totalUnits < p.reorderLevel && totalUnits > 0;
    });
    const outOfStock = products.filter(p => p.totalUnits === 0);
    const expiredProducts = products.filter(p => {
      if (!p.expiryDate) return false;
      return new Date(p.expiryDate) < new Date();
    });
    const expiringSoon = products.filter(p => {
      if (!p.expiryDate) return false;
      const daysUntilExpiry = Math.ceil((new Date(p.expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
      return daysUntilExpiry <= 90 && daysUntilExpiry > 0;
    });

    // Group by category
    const categoryBreakdown = {};
    products.forEach(product => {
      const categoryName = product.category?.name || 'Uncategorized';
      if (!categoryBreakdown[categoryName]) {
        categoryBreakdown[categoryName] = {
          count: 0,
          value: 0,
          products: []
        };
      }
      categoryBreakdown[categoryName].count++;
      categoryBreakdown[categoryName].value += product.totalValue;
      if (type === 'detailed') {
        categoryBreakdown[categoryName].products.push({
          name: product.name,
          stock: product.currentStock,
          totalUnits: product.totalUnits,
          value: product.totalValue
        });
      }
    });

    // Get inventory movements summary
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const movements = await Inventory.find({
      createdAt: { $gte: thirtyDaysAgo }
    });

    const movementSummary = {
      totalMovements: movements.length,
      byType: {}
    };

    movements.forEach(movement => {
      if (!movementSummary.byType[movement.movementType]) {
        movementSummary.byType[movement.movementType] = {
          count: 0,
          totalUnits: 0
        };
      }
      movementSummary.byType[movement.movementType].count++;
      movementSummary.byType[movement.movementType].totalUnits += movement.totalUnits;
    });

    res.status(200).json({
      success: true,
      report: {
        summary: {
          totalProducts,
          totalValue,
          lowStockCount: lowStockProducts.length,
          outOfStockCount: outOfStock.length,
          expiredCount: expiredProducts.length,
          expiringCount: expiringSoon.length
        },
        categoryBreakdown,
        movementSummary,
        lowStockProducts: lowStockProducts.slice(0, 20),
        expiringProducts: expiringSoon.slice(0, 20),
        ...(type === 'detailed' && { products: products.slice(0, 100) })
      }
    });
  } catch (error) {
    console.error('Inventory report error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating inventory report'
    });
  }
};

// @desc    Generate profit & loss report
// @route   GET /api/reports/profit-loss
// @access  Private (Admin only)
exports.getProfitLossReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Please provide start and end dates'
      });
    }

    const start = new Date(startDate);
  const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // Get completed transactions
    const transactions = await Transaction.find({
      createdAt: { $gte: start, $lte: end },
      status: 'completed'
    });

    // Calculate revenue
    const totalRevenue = transactions.reduce((sum, t) => sum + t.totalAmount, 0);

    // Calculate cost of goods sold (COGS)
    let totalCost = 0;
    const productCosts = new Map();

    for (const transaction of transactions) {
      for (const item of transaction.items) {
        const product = await Product.findById(item.productId);
        if (product) {
          const itemCost = product.costPrice * ((item.quantityPacks * item.packSize) + item.quantityUnits);
          totalCost += itemCost;
          
          const key = item.productId.toString();
          if (!productCosts.has(key)) {
            productCosts.set(key, {
              productName: item.productName,
              quantity: 0,
              revenue: 0,
              cost: 0
            });
          }
          const existing = productCosts.get(key);
          existing.quantity += (item.quantityPacks * item.packSize) + item.quantityUnits;
          existing.revenue += item.totalPrice;
          existing.cost += itemCost;
        }
      }
    }

    const grossProfit = totalRevenue - totalCost;
    const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    // Get operating expenses (from stock adjustments)
    const adjustments = await StockAdjustment.find({
      createdAt: { $gte: start, $lte: end },
      adjustmentType: 'remove',
      category: { $in: ['damage', 'expiry', 'theft'] }
    });

    const operatingExpenses = adjustments.reduce((sum, adj) => sum + adj.totalCost, 0);
    const netProfit = grossProfit - operatingExpenses;
    const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    // Get monthly breakdown
    const monthlyBreakdown = {};
    transactions.forEach(transaction => {
      const month = transaction.createdAt.toISOString().slice(0, 7);
      if (!monthlyBreakdown[month]) {
        monthlyBreakdown[month] = {
          revenue: 0,
          cost: 0,
          profit: 0
        };
      }
      monthlyBreakdown[month].revenue += transaction.totalAmount;
    });

    // Add cost to monthly breakdown
    for (const transaction of transactions) {
      const month = transaction.createdAt.toISOString().slice(0, 7);
      let transactionCost = 0;
      for (const item of transaction.items) {
        const product = await Product.findById(item.productId);
        if (product) {
          transactionCost += product.costPrice * ((item.quantityPacks * item.packSize) + item.quantityUnits);
        }
      }
      monthlyBreakdown[month].cost += transactionCost;
      monthlyBreakdown[month].profit = monthlyBreakdown[month].revenue - monthlyBreakdown[month].cost;
    }

    const productProfitability = Array.from(productCosts.values())
      .sort((a, b) => (b.revenue - b.cost) - (a.revenue - a.cost))
      .slice(0, 20);

    res.status(200).json({
      success: true,
      report: {
        summary: {
          startDate: start,
          endDate: end,
          totalRevenue,
          totalCost,
          grossProfit,
          grossMargin: grossMargin.toFixed(2),
          operatingExpenses,
          netProfit,
          netMargin: netMargin.toFixed(2)
        },
        monthlyBreakdown: Object.entries(monthlyBreakdown).map(([month, data]) => ({
          month,
          ...data,
          margin: data.revenue > 0 ? ((data.profit / data.revenue) * 100).toFixed(2) : 0
        })),
        productProfitability
      }
    });
  } catch (error) {
    console.error('Profit & loss report error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating profit & loss report'
    });
  }
};

// @desc    Generate tax report (VAT)
// @route   GET /api/reports/tax
// @access  Private (Admin only)
exports.getTaxReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Please provide start and end dates'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const transactions = await Transaction.find({
      createdAt: { $gte: start, $lte: end },
      status: 'completed'
    });

    const totalSales = transactions.reduce((sum, t) => sum + t.subtotal, 0);
    const totalVAT = transactions.reduce((sum, t) => sum + t.tax, 0);
    
    // Monthly breakdown
    const monthlyBreakdown = {};
    transactions.forEach(transaction => {
      const month = transaction.createdAt.toISOString().slice(0, 7);
      if (!monthlyBreakdown[month]) {
        monthlyBreakdown[month] = {
          sales: 0,
          vat: 0,
          transactions: 0
        };
      }
      monthlyBreakdown[month].sales += transaction.subtotal;
      monthlyBreakdown[month].vat += transaction.tax;
      monthlyBreakdown[month].transactions += 1;
    });

    res.status(200).json({
      success: true,
      report: {
        summary: {
          startDate: start,
          endDate: end,
          totalSales,
          totalVAT,
          effectiveRate: totalSales > 0 ? (totalVAT / totalSales) * 100 : 0,
          totalTransactions: transactions.length
        },
        monthlyBreakdown: Object.entries(monthlyBreakdown).map(([month, data]) => ({
          month,
          ...data,
          rate: data.sales > 0 ? (data.vat / data.sales) * 100 : 0
        })),
        transactions: transactions.slice(0, 50).map(t => ({
          receiptNumber: t.receiptNumber,
          date: t.createdAt,
          subtotal: t.subtotal,
          vat: t.tax,
          total: t.totalAmount,
          paymentMethod: t.paymentMethod
        }))
      }
    });
  } catch (error) {
    console.error('Tax report error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating tax report'
    });
  }
};

// @desc    Export report to PDF/Excel
// @route   POST /api/reports/export
// @access  Private (Admin only)
exports.exportReport = async (req, res) => {
  try {
    const { reportType, format, params } = req.body;
    
    // This would integrate with a PDF/Excel generation library
    // For now, return a placeholder
    res.status(200).json({
      success: true,
      message: `Export functionality for ${reportType} in ${format} format will be implemented`,
      downloadUrl: `/exports/${reportType}_${Date.now()}.${format}`
    });
  } catch (error) {
    console.error('Export report error:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting report'
    });
  }
};