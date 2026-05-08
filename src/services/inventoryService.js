// backend/src/services/inventoryService.js
const Product = require('../models/Product');
const Inventory = require('../models/Inventory');
const StockAdjustment = require('../models/StockAdjustment');

class InventoryService {
  /**
   * Calculate stock update based on packs and units
   * @param {Object} product - Product object
   * @param {number} quantityPacks - Number of packs to add/remove
   * @param {number} quantityUnits - Number of units to add/remove
   * @param {string} operation - 'add' or 'remove'
   * @returns {Object} Updated stock { packs, units }
   */
  static calculateStockUpdate(product, quantityPacks, quantityUnits, operation) {
    let newPacks = product.currentStock.packs;
    let newUnits = product.currentStock.units;
    
    if (operation === 'add') {
      newPacks += quantityPacks;
      newUnits += quantityUnits;
    } else if (operation === 'remove') {
      const totalUnitsToRemove = (quantityPacks * product.packSize) + quantityUnits;
      let currentTotalUnits = (newPacks * product.packSize) + newUnits;
      
      if (totalUnitsToRemove > currentTotalUnits) {
        throw new Error(`Insufficient stock. Available: ${currentTotalUnits} units`);
      }
      
      newPacks -= quantityPacks;
      newUnits -= quantityUnits;
      
      // Handle negative units by borrowing from packs
      while (newUnits < 0 && newPacks > 0) {
        newPacks--;
        newUnits += product.packSize;
      }
    }
    
    // Ensure non-negative values
    newPacks = Math.max(0, newPacks);
    newUnits = Math.max(0, newUnits);
    
    return { packs: newPacks, units: newUnits };
  }

  /**
   * Get total units in stock
   * @param {Object} product - Product object
   * @returns {number} Total units
   */
  static getTotalUnits(product) {
    return (product.currentStock.packs * product.packSize) + product.currentStock.units;
  }

  /**
   * Get display stock string
   * @param {Object} product - Product object
   * @returns {string} Formatted stock string
   */
  static getDisplayStock(product) {
    const totalUnits = this.getTotalUnits(product);
    return `${product.currentStock.packs} pack(s) + ${product.currentStock.units} unit(s) (${totalUnits} total units)`;
  }

  /**
   * Check if stock is sufficient for requested quantity
   * @param {Object} product - Product object
   * @param {number} packs - Number of packs requested
   * @param {number} units - Number of units requested
   * @returns {boolean} True if sufficient
   */
  static isStockSufficient(product, packs, units) {
    const requestedUnits = (packs * product.packSize) + units;
    const availableUnits = this.getTotalUnits(product);
    return requestedUnits <= availableUnits;
  }

  /**
   * Get stock status (good, low, critical, out)
   * @param {Object} product - Product object
   * @returns {Object} Stock status with label and color
   */
  static getStockStatus(product) {
    const totalUnits = this.getTotalUnits(product);
    const reorderLevel = product.reorderLevel || 20;
    const criticalLevel = reorderLevel * 0.3;
    
    if (totalUnits === 0) {
      return { label: 'Out of Stock', color: 'red', status: 'out' };
    }
    if (totalUnits <= criticalLevel) {
      return { label: 'Critical Stock', color: 'red', status: 'critical' };
    }
    if (totalUnits <= reorderLevel) {
      return { label: 'Low Stock', color: 'yellow', status: 'low' };
    }
    if (totalUnits <= reorderLevel * 2) {
      return { label: 'Moderate Stock', color: 'blue', status: 'moderate' };
    }
    return { label: 'Good Stock', color: 'green', status: 'good' };
  }

  /**
   * Update product stock and create inventory record
   * @param {string} productId - Product ID
   * @param {number} packs - Number of packs
   * @param {number} units - Number of units
   * @param {string} operation - 'add' or 'remove'
   * @param {string} userId - User performing the operation
   * @param {string} referenceId - Reference ID (transaction, adjustment, etc.)
   * @param {string} notes - Optional notes
   * @returns {Object} Updated product and inventory record
   */
  static async updateStock(productId, packs, units, operation, userId, referenceId = null, notes = '') {
    const product = await Product.findById(productId);
    
    if (!product) {
      throw new Error('Product not found');
    }
    
    const previousStock = {
      packs: product.currentStock.packs,
      units: product.currentStock.units
    };
    
    // Calculate new stock
    const newStock = this.calculateStockUpdate(product, packs, units, operation);
    
    // Update product stock
    product.currentStock = newStock;
    await product.save();
    
    // Create inventory record
    const inventory = await Inventory.create({
      productId: product._id,
      movementType: operation === 'add' ? 'restock' : 'sale',
      quantityPacks: packs,
      quantityUnits: units,
      previousStock,
      newStock,
      referenceId,
      performedBy: userId,
      notes
    });
    
    return { product, inventory };
  }

  /**
   * Create stock adjustment record
   * @param {Object} adjustmentData - Adjustment data
   * @returns {Object} Created adjustment
   */
  static async createStockAdjustment(adjustmentData) {
    const adjustment = await StockAdjustment.create(adjustmentData);
    return adjustment;
  }

  /**
   * Get inventory valuation
   * @returns {Object} Valuation summary
   */
  static async getInventoryValuation() {
    const products = await Product.find({ isActive: true, isDeleted: false });
    
    let totalValue = 0;
    const byCategory = {};
    
    for (const product of products) {
      const totalUnits = this.getTotalUnits(product);
      const avgPrice = product.pricePerUnit || (product.pricePerPack / product.packSize);
      const value = totalUnits * avgPrice;
      totalValue += value;
      
      const categoryId = product.category.toString();
      if (!byCategory[categoryId]) {
        byCategory[categoryId] = {
          category: product.category,
          value: 0,
          count: 0,
          products: []
        };
      }
      
      byCategory[categoryId].value += value;
      byCategory[categoryId].count += 1;
      byCategory[categoryId].products.push({
        id: product._id,
        name: product.name,
        stock: this.getTotalUnits(product),
        value
      });
    }
    
    return {
      totalValue,
      totalProducts: products.length,
      averageValuePerProduct: products.length > 0 ? totalValue / products.length : 0,
      byCategory: Object.values(byCategory),
      generatedAt: new Date()
    };
  }

  /**
   * Get stock movement summary for a period
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Object} Movement summary
   */
  static async getMovementSummary(startDate, endDate) {
    const movements = await Inventory.find({
      createdAt: { $gte: startDate, $lte: endDate }
    }).populate('productId', 'name');
    
    const summary = {
      totalMovements: movements.length,
      byType: {},
      totalValueAdded: 0,
      totalValueRemoved: 0,
      topMovingProducts: []
    };
    
    const productMovement = {};
    
    movements.forEach(movement => {
      // Group by type
      if (!summary.byType[movement.movementType]) {
        summary.byType[movement.movementType] = {
          count: 0,
          totalUnits: 0,
          totalPacks: 0
        };
      }
      summary.byType[movement.movementType].count++;
      summary.byType[movement.movementType].totalUnits += movement.totalUnits;
      summary.byType[movement.movementType].totalPacks += movement.quantityPacks;
      
      // Track product movement
      const productId = movement.productId._id.toString();
      if (!productMovement[productId]) {
        productMovement[productId] = {
          productId: movement.productId._id,
          productName: movement.productId.name,
          totalUnits: 0,
          movementCount: 0
        };
      }
      productMovement[productId].totalUnits += movement.totalUnits;
      productMovement[productId].movementCount++;
    });
    
    // Get top moving products
    summary.topMovingProducts = Object.values(productMovement)
      .sort((a, b) => b.totalUnits - a.totalUnits)
      .slice(0, 10);
    
    return summary;
  }

  /**
   * Calculate stock turnover rate
   * @param {string} productId - Product ID
   * @param {number} days - Period in days
   * @returns {Object} Turnover rate
   */
  static async calculateTurnoverRate(productId, days = 365) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const product = await Product.findById(productId);
    if (!product) {
      throw new Error('Product not found');
    }
    
    // Get sales for the period
    const sales = await Inventory.find({
      productId,
      movementType: 'sale',
      createdAt: { $gte: startDate }
    });
    
    const totalSold = sales.reduce((sum, sale) => sum + sale.totalUnits, 0);
    const averageInventory = (this.getTotalUnits(product) + (this.getTotalUnits(product) - totalSold)) / 2;
    
    const turnoverRate = averageInventory > 0 ? totalSold / averageInventory : 0;
    const daysOfInventory = turnoverRate > 0 ? 365 / turnoverRate : 0;
    
    return {
      productId,
      productName: product.name,
      periodDays: days,
      totalSold,
      averageInventory,
      turnoverRate: turnoverRate.toFixed(2),
      daysOfInventory: Math.round(daysOfInventory),
      status: turnoverRate > 3 ? 'Fast Moving' : (turnoverRate > 1 ? 'Normal' : 'Slow Moving')
    };
  }

  /**
   * Get reorder recommendations
   * @returns {Array} List of products that need reordering
   */
  static async getReorderRecommendations() {
    const products = await Product.find({ isActive: true, isDeleted: false })
      .populate('category', 'name');
    
    const recommendations = [];
    
    for (const product of products) {
      const totalUnits = this.getTotalUnits(product);
      const reorderLevel = product.reorderLevel || 20;
      
      if (totalUnits <= reorderLevel) {
        const neededUnits = (product.reorderQuantity || 50) - totalUnits;
        const neededPacks = Math.ceil(neededUnits / product.packSize);
        
        recommendations.push({
          productId: product._id,
          productName: product.name,
          category: product.category.name,
          currentStock: {
            packs: product.currentStock.packs,
            units: product.currentStock.units,
            totalUnits
          },
          reorderLevel,
          recommendedOrder: {
            packs: neededPacks,
            units: 0,
            totalUnits: neededPacks * product.packSize,
            estimatedCost: (neededPacks * product.costPrice * product.packSize)
          },
          urgency: totalUnits === 0 ? 'critical' : (totalUnits <= reorderLevel / 2 ? 'high' : 'medium')
        });
      }
    }
    
    return recommendations.sort((a, b) => {
      const urgencyOrder = { critical: 0, high: 1, medium: 2 };
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    });
  }

  /**
   * Get expiring products report
   * @param {number} daysThreshold - Days to check for expiry
   * @returns {Array} List of expiring products
   */
  static async getExpiringProducts(daysThreshold = 90) {
    const products = await Product.find({
      expiryDate: { $exists: true, $ne: null },
      isActive: true,
      isDeleted: false
    });
    
    const today = new Date();
    const expiringProducts = [];
    
    for (const product of products) {
      const daysUntilExpiry = Math.ceil((product.expiryDate - today) / (1000 * 60 * 60 * 24));
      
      if (daysUntilExpiry <= daysThreshold && daysUntilExpiry > 0) {
        const totalUnits = this.getTotalUnits(product);
        const value = totalUnits * (product.pricePerUnit || (product.pricePerPack / product.packSize));
        
        expiringProducts.push({
          productId: product._id,
          productName: product.name,
          batchNumber: product.batchNumber,
          expiryDate: product.expiryDate,
          daysUntilExpiry,
          currentStock: {
            packs: product.currentStock.packs,
            units: product.currentStock.units,
            totalUnits
          },
          value,
          urgency: daysUntilExpiry <= 30 ? 'critical' : (daysUntilExpiry <= 60 ? 'high' : 'medium'),
          recommendedAction: daysUntilExpiry <= 30 ? 'Immediate markdown' : 'Promotional pricing'
        });
      }
    }
    
    return expiringProducts.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  }

  /**
   * Sync stock levels (for physical count)
   * @param {Array} counts - Array of { productId, actualPacks, actualUnits }
   * @param {string} userId - User performing the sync
   * @returns {Object} Sync results
   */
  static async syncStockLevels(counts, userId) {
    const results = {
      synced: [],
      errors: [],
      totalDiscrepancies: 0
    };
    
    for (const count of counts) {
      try {
        const product = await Product.findById(count.productId);
        
        if (!product) {
          results.errors.push({
            productId: count.productId,
            error: 'Product not found'
          });
          continue;
        }
        
        const previousStock = {
          packs: product.currentStock.packs,
          units: product.currentStock.units
        };
        
        const newStock = {
          packs: count.actualPacks,
          units: count.actualUnits
        };
        
        const hasDiscrepancy = previousStock.packs !== newStock.packs || previousStock.units !== newStock.units;
        
        if (hasDiscrepancy) {
          product.currentStock = newStock;
          await product.save();
          
          // Create adjustment record
          await StockAdjustment.create({
            productId: product._id,
            adjustmentType: 'count_correction',
            quantityPacks: Math.abs(newStock.packs - previousStock.packs),
            quantityUnits: Math.abs(newStock.units - previousStock.units),
            previousStock,
            newStock,
            reason: 'Physical stock count adjustment',
            performedBy: userId,
            approvedBy: userId,
            verificationStatus: 'verified'
          });
          
          results.totalDiscrepancies++;
        }
        
        results.synced.push({
          productId: product._id,
          productName: product.name,
          previousStock,
          newStock,
          adjusted: hasDiscrepancy
        });
        
      } catch (error) {
        results.errors.push({
          productId: count.productId,
          error: error.message
        });
      }
    }
    
    return results;
  }
}

module.exports = InventoryService;