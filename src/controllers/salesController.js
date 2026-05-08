// backend/src/controllers/salesController.js
const Transaction = require('../models/Transaction');
const Product = require('../models/Product');
const Inventory = require('../models/Inventory');
const User = require('../models/User');

// @desc    Process a new sale
// @route   POST /api/sales
// @access  Private (POS Agent or Admin)
exports.processSale = async (req, res) => {
  try {
    const { items, paymentMethod, pinCode, customer } = req.body;
    const posAgentId = req.user.id;

    // Verify PIN
    const user = await User.findById(posAgentId).select('+pinCode');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const isPinValid = await user.comparePin(pinCode);
    if (!isPinValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid PIN'
      });
    }

    let subtotal = 0;
    let totalTax = 0;
    let totalDiscount = 0;
    const transactionItems = [];

    // Process each item
    for (const item of items) {
      const product = await Product.findById(item.productId);
      
      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product ${item.productId} not found`
        });
      }

      // Check stock availability
      const requestedUnits = (item.quantityPacks * product.packSize) + item.quantityUnits;
      const availableUnits = (product.currentStock.packs * product.packSize) + product.currentStock.units;
      
      if (requestedUnits > availableUnits) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}. Available: ${availableUnits} units`
        });
      }

      // Calculate item price
      const packPrice = item.quantityPacks * product.pricePerPack;
      const unitPrice = item.quantityUnits * product.pricePerUnit;
      const itemSubtotal = packPrice + unitPrice;
      const itemTax = itemSubtotal * (product.taxRate / 100);
      const itemDiscount = itemSubtotal * (product.discountRate / 100);
      const itemTotal = itemSubtotal + itemTax - itemDiscount;

      // Save previous stock for inventory record
      const previousStock = { 
        packs: product.currentStock.packs, 
        units: product.currentStock.units 
      };

      // Update stock manually (without using updateStock method if it doesn't exist)
      let newPacks = product.currentStock.packs - item.quantityPacks;
      let newUnits = product.currentStock.units - item.quantityUnits;
      
      // Handle negative units by borrowing from packs
      while (newUnits < 0 && newPacks > 0) {
        newPacks--;
        newUnits += product.packSize;
      }
      
      product.currentStock = { packs: Math.max(0, newPacks), units: Math.max(0, newUnits) };
      await product.save();

      // Add to transaction items
      transactionItems.push({
        productId: product._id,
        productName: product.name,
        quantityPacks: item.quantityPacks,
        quantityUnits: item.quantityUnits,
        packSize: product.packSize,
        unitPrice: product.pricePerUnit,
        packPrice: product.pricePerPack,
        totalPrice: itemTotal,
        discount: itemDiscount,
        tax: itemTax
      });

      // Create inventory movement record
      await Inventory.create({
        productId: product._id,
        movementType: 'sale',
        quantityPacks: item.quantityPacks,
        quantityUnits: item.quantityUnits,
        previousStock,
        newStock: product.currentStock,
        referenceId: null,
        performedBy: posAgentId,
        notes: `Sale by ${user.name}`
      });

      subtotal += itemSubtotal;
      totalTax += itemTax;
      totalDiscount += itemDiscount;
    }

    const totalAmount = subtotal + totalTax - totalDiscount;

    // Generate transaction ID and receipt number
    const generateTransactionId = () => {
      const date = new Date();
      const timestamp = date.getTime().toString().slice(-8);
      const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      return `TRX-${timestamp}-${random}`;
    };

    const generateReceiptNumber = () => {
      const date = new Date();
      const timestamp = date.getTime().toString().slice(-8);
      return `RCPT-${timestamp}`;
    };

    // Create transaction
    const transaction = await Transaction.create({
      transactionId: generateTransactionId(),
      receiptNumber: generateReceiptNumber(),
      posAgentId,
      customer: customer || { name: 'Walk-in Customer' },
      items: transactionItems,
      subtotal,
      tax: totalTax,
      discount: totalDiscount,
      totalAmount,
      paymentMethod,
      verifiedByPin: true,
      status: 'completed',
      'metadata.ipAddress': req.ip,
      'metadata.userAgent': req.get('user-agent')
    });

    // Update inventory records with reference ID
    await Inventory.updateMany(
      { referenceId: null, performedBy: posAgentId, movementType: 'sale' },
      { referenceId: transaction.transactionId }
    );

    res.status(201).json({
      success: true,
      transaction,
      receipt: {
        transactionId: transaction.transactionId,
        receiptNumber: transaction.receiptNumber,
        date: transaction.createdAt,
        items: transactionItems,
        subtotal,
        tax: totalTax,
        discount: totalDiscount,
        total: totalAmount,
        paymentMethod
      },
      message: 'Sale completed successfully'
    });
  } catch (error) {
    console.error('Process sale error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error processing sale'
    });
  }
};

// @desc    Get all sales transactions
// @route   GET /api/sales
// @access  Private (Admin only)
// backend/src/controllers/salesController.js
// Replace the getSales function with this updated version

// @desc    Get all sales transactions
// @route   GET /api/sales
// @access  Private (Admin sees all, POS Agent sees only their own)
// backend/src/controllers/salesController.js
// Update the getSales function with proper date handling

exports.getSales = async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;
      
      const filter = {};
      
      // ROLE-BASED FILTERING
      if (req.user.role !== 'admin') {
        filter.posAgentId = req.user.id;
      }
      
      if (req.user.role === 'admin' && req.query.posAgentId) {
        filter.posAgentId = req.query.posAgentId;
      }
      
      if (req.query.status) {
        filter.status = req.query.status;
      }
      
      if (req.query.paymentMethod) {
        filter.paymentMethod = req.query.paymentMethod;
      }
      
      // FIX: Handle date range properly
      if (req.query.startDate && req.query.endDate) {
        // Create start date at beginning of the day
        const startDate = new Date(req.query.startDate);
        startDate.setHours(0, 0, 0, 0);
        
        // Create end date at end of the day
        const endDate = new Date(req.query.endDate);
        endDate.setHours(23, 59, 59, 999);
        
        filter.createdAt = {
          $gte: startDate,
          $lte: endDate
        };
        
        console.log('Date filter:', { startDate, endDate });
      }
      
      console.log('User ID:', req.user.id);
      console.log('Filter:', JSON.stringify(filter, null, 2));
      
      const transactions = await Transaction.find(filter)
        .populate('posAgentId', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
  
      const total = await Transaction.countDocuments(filter);
      console.log('Total transactions found:', total);
      
      // Calculate summary
      const summary = await Transaction.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalSales: { $sum: '$totalAmount' },
            totalTransactions: { $sum: 1 },
            averageSale: { $avg: '$totalAmount' }
          }
        }
      ]);
  
      res.status(200).json({
        success: true,
        transactions,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        summary: summary[0] || { totalSales: 0, totalTransactions: 0, averageSale: 0 }
      });
    } catch (error) {
      console.error('Get sales error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching sales'
      });
    }
  };
  


// backend/src/controllers/salesController.js
// Add this function

// @desc    Get agent performance metrics
// @route   GET /api/sales/agent-performance
// @access  Private (Admin only)
exports.getAgentPerformance = async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      const matchFilter = { status: 'completed' };
      
      if (startDate && endDate) {
        matchFilter.createdAt = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }
      
      const agentPerformance = await Transaction.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: '$posAgentId',
            totalSales: { $sum: '$totalAmount' },
            transactionCount: { $sum: 1 },
            averageSale: { $avg: '$totalAmount' }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'agent'
          }
        },
        { $unwind: '$agent' },
        {
          $project: {
            _id: '$_id',
            name: '$agent.name',
            email: '$agent.email',
            totalSales: 1,
            transactionCount: 1,
            averageSale: { $round: ['$averageSale', 2] }
          }
        },
        { $sort: { totalSales: -1 } }
      ]);
      
      res.status(200).json({
        success: true,
        agents: agentPerformance
      });
    } catch (error) {
      console.error('Get agent performance error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching agent performance'
      });
    }
  };
// @desc    Get single transaction
// @route   GET /api/sales/:id
// @access  Private
exports.getSaleById = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate('posAgentId', 'name email')
      .populate('items.productId', 'name genericName');
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    // Check permission (admin or the agent who made the sale)
    if (req.user.role !== 'admin' && transaction.posAgentId._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.status(200).json({
      success: true,
      transaction
    });
  } catch (error) {
    console.error('Get sale error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching transaction'
    });
  }
};

// @desc    Get today's sales
// @route   GET /api/sales/today
// @access  Private
exports.getTodaySales = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const filter = {
      createdAt: { $gte: today, $lt: tomorrow },
      status: 'completed'
    };

    // For POS agents, only show their sales
    if (req.user.role === 'pos_agent') {
      filter.posAgentId = req.user.id;
    }

    const transactions = await Transaction.find(filter)
      .populate('posAgentId', 'name');

    const total = transactions.reduce((sum, t) => sum + t.totalAmount, 0);
    const count = transactions.length;

    res.status(200).json({
      success: true,
      sales: transactions,
      total,
      count,
      average: count > 0 ? total / count : 0
    });
  } catch (error) {
    console.error('Get today sales error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching today\'s sales'
    });
  }
};

// @desc    Refund a sale
// @route   POST /api/sales/:id/refund
// @access  Private (Admin only)
exports.refundSale = async (req, res) => {
  try {
    const { reason } = req.body;
    const transaction = await Transaction.findById(req.params.id);
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    if (transaction.status === 'refunded') {
      return res.status(400).json({
        success: false,
        message: 'Transaction already refunded'
      });
    }

    // Restore stock for each item
    for (const item of transaction.items) {
      const product = await Product.findById(item.productId);
      if (product) {
        let newPacks = product.currentStock.packs + item.quantityPacks;
        let newUnits = product.currentStock.units + item.quantityUnits;
        
        product.currentStock = { packs: newPacks, units: newUnits };
        await product.save();
        
        await Inventory.create({
          productId: product._id,
          movementType: 'return',
          quantityPacks: item.quantityPacks,
          quantityUnits: item.quantityUnits,
          previousStock: { packs: newPacks - item.quantityPacks, units: newUnits - item.quantityUnits },
          newStock: product.currentStock,
          referenceId: transaction.transactionId,
          performedBy: req.user.id,
          notes: `Refund of transaction ${transaction.transactionId}. Reason: ${reason}`
        });
      }
    }
    
    transaction.status = 'refunded';
    transaction.refundDetails = {
      refundedBy: req.user.id,
      refundedAt: new Date(),
      refundReason: reason,
      refundAmount: transaction.totalAmount,
      originalTransactionId: transaction.transactionId
    };
    
    await transaction.save();

    res.status(200).json({
      success: true,
      transaction,
      message: 'Transaction refunded successfully'
    });
  } catch (error) {
    console.error('Refund sale error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error processing refund'
    });
  }
};

// @desc    Get sales report by date range
// @route   GET /api/sales/report
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
    });

    // Group by period
    const groupedData = {};
    transactions.forEach(transaction => {
      let key;
      const date = new Date(transaction.createdAt);
      
      if (groupBy === 'day') {
        key = date.toISOString().split('T')[0];
      } else if (groupBy === 'month') {
        key = `${date.getFullYear()}-${date.getMonth() + 1}`;
      } else {
        key = date.toISOString().split('T')[0];
      }

      if (!groupedData[key]) {
        groupedData[key] = {
          _id: key,
          totalSales: 0,
          transactionCount: 0
        };
      }
      groupedData[key].totalSales += transaction.totalAmount;
      groupedData[key].transactionCount += 1;
    });

    // Get top products
    const productMap = new Map();
    transactions.forEach(transaction => {
      transaction.items.forEach(item => {
        const existing = productMap.get(item.productId.toString()) || {
          productId: item.productId,
          productName: item.productName,
          quantity: 0,
          revenue: 0
        };
        existing.quantity += (item.quantityPacks * item.packSize) + item.quantityUnits;
        existing.revenue += item.totalPrice;
        productMap.set(item.productId.toString(), existing);
      });
    });

    const topProducts = Array.from(productMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    const totalSales = transactions.reduce((sum, t) => sum + t.totalAmount, 0);
    const totalTransactions = transactions.length;

    res.status(200).json({
      success: true,
      report: {
        summary: {
          totalSales,
          totalTransactions,
          averageSale: totalTransactions > 0 ? totalSales / totalTransactions : 0,
          startDate: start,
          endDate: end
        },
        breakdown: Object.values(groupedData),
        topProducts,
        transactions: transactions.slice(0, 100)
      }
    });
  } catch (error) {
    console.error('Get sales report error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating sales report'
    });
  }
};

// @desc    Generate receipt
// @route   GET /api/sales/:id/receipt
// @access  Private
exports.generateReceipt = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate('posAgentId', 'name');
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    // Generate HTML receipt
    const receiptHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Receipt ${transaction.receiptNumber}</title>
        <style>
          body { font-family: monospace; margin: 0; padding: 20px; }
          .receipt { max-width: 300px; margin: 0 auto; }
          .header { text-align: center; margin-bottom: 20px; }
          .items { margin: 20px 0; }
          .item { margin-bottom: 10px; }
          .totals { border-top: 1px dashed #000; padding-top: 10px; margin-top: 10px; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="header">
            <h3>PHARMACY STORE</h3>
            <p>123 Pharmacy Road, Lagos</p>
            <p>Tel: 08012345678</p>
            <p>VAT: 12345678-01</p>
            <hr>
            <p>Receipt: ${transaction.receiptNumber}</p>
            <p>Date: ${new Date(transaction.createdAt).toLocaleString()}</p>
            <p>Cashier: ${transaction.posAgentId?.name || 'Agent'}</p>
            <hr>
          </div>
          <div class="items">
            ${transaction.items.map(item => `
              <div class="item">
                <div><strong>${item.productName}</strong></div>
                <div>Qty: ${item.quantityPacks > 0 ? item.quantityPacks + ' pack(s)' : ''}${item.quantityPacks > 0 && item.quantityUnits > 0 ? ' + ' : ''}${item.quantityUnits > 0 ? item.quantityUnits + ' unit(s)' : ''}</div>
                <div>Price: ₦${item.totalPrice.toLocaleString()}</div>
              </div>
            `).join('')}
          </div>
          <div class="totals">
            <div>Subtotal: ₦${transaction.subtotal.toLocaleString()}</div>
            <div>VAT (7.5%): ₦${transaction.tax.toLocaleString()}</div>
            <div><strong>TOTAL: ₦${transaction.totalAmount.toLocaleString()}</strong></div>
          </div>
          <div class="footer">
            <hr>
            <p>Thank you for your patronage!</p>
            <p>Goods sold are not returnable</p>
          </div>
        </div>
      </body>
      </html>
    `;

    res.set('Content-Type', 'text/html');
    res.send(receiptHtml);
  } catch (error) {
    console.error('Generate receipt error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating receipt'
    });
  }
};