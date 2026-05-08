// backend/src/services/pricingService.js
const Product = require('../models/Product');

class PricingService {
  /**
   * Calculate total price for a product based on packs and units
   * @param {Object} product - Product object
   * @param {number} quantityPacks - Number of packs
   * @param {number} quantityUnits - Number of units
   * @returns {Object} Price breakdown
   */
  static calculatePrice(product, quantityPacks, quantityUnits) {
    const packPrice = quantityPacks * product.pricePerPack;
    const unitPrice = quantityUnits * product.pricePerUnit;
    const subtotal = packPrice + unitPrice;
    
    // Calculate VAT (Nigeria: 7.5%)
    const vatRate = product.taxRate || 7.5;
    const vat = subtotal * (vatRate / 100);
    
    // Calculate discount if applicable
    const discountRate = product.discountRate || 0;
    const discount = subtotal * (discountRate / 100);
    
    const total = subtotal + vat - discount;
    
    return {
      subtotal,
      vat,
      vatRate,
      discount,
      discountRate,
      total,
      breakdown: {
        packs: {
          quantity: quantityPacks,
          unitPrice: product.pricePerPack,
          total: packPrice
        },
        units: {
          quantity: quantityUnits,
          unitPrice: product.pricePerUnit,
          total: unitPrice
        }
      }
    };
  }

  /**
   * Calculate price for multiple items in a cart
   * @param {Array} items - Array of { productId, quantityPacks, quantityUnits }
   * @returns {Object} Cart total breakdown
   */
  static async calculateCartTotal(items) {
    let subtotal = 0;
    let totalVat = 0;
    let totalDiscount = 0;
    const itemDetails = [];
    
    for (const item of items) {
      const product = await Product.findById(item.productId);
      
      if (!product) {
        throw new Error(`Product ${item.productId} not found`);
      }
      
      const pricing = this.calculatePrice(product, item.quantityPacks, item.quantityUnits);
      
      subtotal += pricing.subtotal;
      totalVat += pricing.vat;
      totalDiscount += pricing.discount;
      
      itemDetails.push({
        productId: product._id,
        productName: product.name,
        quantityPacks: item.quantityPacks,
        quantityUnits: item.quantityUnits,
        unitPrice: product.pricePerUnit,
        packPrice: product.pricePerPack,
        subtotal: pricing.subtotal,
        vat: pricing.vat,
        discount: pricing.discount,
        total: pricing.total,
        breakdown: pricing.breakdown
      });
    }
    
    const grandTotal = subtotal + totalVat - totalDiscount;
    
    return {
      subtotal,
      vat: totalVat,
      discount: totalDiscount,
      total: grandTotal,
      items: itemDetails,
      summary: {
        totalItems: items.length,
        averageItemPrice: items.length > 0 ? grandTotal / items.length : 0
      }
    };
  }

  /**
   * Calculate profit margin for a product
   * @param {Object} product - Product object
   * @returns {Object} Profit margin details
   */
  static calculateProfitMargin(product) {
    const sellingPricePerUnit = product.pricePerUnit;
    const sellingPricePerPack = product.pricePerPack;
    const costPerUnit = product.costPrice;
    const costPerPack = costPerUnit * product.packSize;
    
    const unitMargin = sellingPricePerUnit - costPerUnit;
    const unitMarginPercentage = sellingPricePerUnit > 0 ? (unitMargin / sellingPricePerUnit) * 100 : 0;
    
    const packMargin = sellingPricePerPack - costPerPack;
    const packMarginPercentage = sellingPricePerPack > 0 ? (packMargin / sellingPricePerPack) * 100 : 0;
    
    return {
      perUnit: {
        sellingPrice: sellingPricePerUnit,
        costPrice: costPerUnit,
        profit: unitMargin,
        marginPercentage: unitMarginPercentage.toFixed(2)
      },
      perPack: {
        sellingPrice: sellingPricePerPack,
        costPrice: costPerPack,
        profit: packMargin,
        marginPercentage: packMarginPercentage.toFixed(2)
      },
      overall: {
        totalStockValue: (product.costPrice * this.getTotalUnits(product)),
        potentialRevenue: (product.pricePerUnit * this.getTotalUnits(product)),
        potentialProfit: (product.pricePerUnit - product.costPrice) * this.getTotalUnits(product)
      }
    };
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
   * Calculate bulk discount
   * @param {number} quantity - Quantity purchased
   * @param {number} basePrice - Base price per unit
   * @param {Array} discountTiers - Discount tiers [{ minQty, discountPercentage }]
   * @returns {Object} Discounted price
   */
  static calculateBulkDiscount(quantity, basePrice, discountTiers = []) {
    let discountPercentage = 0;
    
    // Sort tiers by minQty descending
    const sortedTiers = [...discountTiers].sort((a, b) => b.minQty - a.minQty);
    
    for (const tier of sortedTiers) {
      if (quantity >= tier.minQty) {
        discountPercentage = tier.discountPercentage;
        break;
      }
    }
    
    const originalPrice = quantity * basePrice;
    const discountAmount = originalPrice * (discountPercentage / 100);
    const finalPrice = originalPrice - discountAmount;
    
    return {
      quantity,
      originalPrice,
      discountPercentage,
      discountAmount,
      finalPrice,
      savings: discountAmount
    };
  }

  /**
   * Compare prices between products
   * @param {Array} productIds - Array of product IDs
   * @returns {Array} Price comparison
   */
  static async comparePrices(productIds) {
    const products = await Product.find({
      _id: { $in: productIds },
      isActive: true
    });
    
    return products.map(product => ({
      id: product._id,
      name: product.name,
      genericName: product.genericName,
      unitPrice: product.pricePerUnit,
      packPrice: product.pricePerPack,
      packSize: product.packSize,
      pricePerUnitInPack: product.pricePerPack / product.packSize,
      bestValue: product.pricePerUnit > (product.pricePerPack / product.packSize) ? 'Pack' : 'Unit'
    }));
  }

  /**
   * Apply promotional pricing
   * @param {Object} product - Product object
   * @param {Object} promotion - Promotion details { type, value, startDate, endDate }
   * @returns {Object} Promotional pricing
   */
  static applyPromotion(product, promotion) {
    const { type, value, startDate, endDate } = promotion;
    const now = new Date();
    
    // Check if promotion is active
    if (startDate && now < new Date(startDate)) {
      return { regular: true, message: 'Promotion not yet started' };
    }
    if (endDate && now > new Date(endDate)) {
      return { regular: true, message: 'Promotion has ended' };
    }
    
    let promotionalPrice = product.pricePerUnit;
    let promotionalPackPrice = product.pricePerPack;
    
    if (type === 'percentage') {
      promotionalPrice = product.pricePerUnit * (1 - value / 100);
      promotionalPackPrice = product.pricePerPack * (1 - value / 100);
    } else if (type === 'fixed') {
      promotionalPrice = product.pricePerUnit - value;
      promotionalPackPrice = product.pricePerPack - (value * product.packSize);
    } else if (type === 'buy_one_get_one') {
      // BOGO logic would be handled at cart level
      return { regular: false, promotion: 'BOGO', message: 'Buy One Get One Free' };
    }
    
    return {
      regular: false,
      originalPrice: product.pricePerUnit,
      originalPackPrice: product.pricePerPack,
      promotionalPrice: Math.max(0, promotionalPrice),
      promotionalPackPrice: Math.max(0, promotionalPackPrice),
      savings: (product.pricePerUnit - promotionalPrice) * this.getTotalUnits(product),
      promotionDetails: promotion
    };
  }

  /**
   * Calculate price with membership discount
   * @param {number} price - Original price
   * @param {string} membershipTier - Membership tier (bronze, silver, gold, platinum)
   * @returns {Object} Discounted price
   */
  static applyMembershipDiscount(price, membershipTier) {
    const discounts = {
      bronze: 0,
      silver: 5,
      gold: 10,
      platinum: 15
    };
    
    const discountPercentage = discounts[membershipTier] || 0;
    const discountAmount = price * (discountPercentage / 100);
    const finalPrice = price - discountAmount;
    
    return {
      originalPrice: price,
      discountPercentage,
      discountAmount,
      finalPrice,
      membershipTier
    };
  }

  /**
   * Calculate price for prescription vs non-prescription
   * @param {Object} product - Product object
   * @param {boolean} hasPrescription - Whether customer has prescription
   * @returns {Object} Pricing with prescription adjustment
   */
  static calculatePrescriptionPricing(product, hasPrescription) {
    if (!product.requiresPrescription) {
      return {
        eligible: true,
        price: product.pricePerUnit,
        message: 'No prescription required'
      };
    }
    
    if (hasPrescription) {
      // Prescription drugs may have different pricing (e.g., no VAT)
      const vatRate = 0; // Prescription drugs may be VAT exempt
      const priceWithVat = product.pricePerUnit;
      const priceWithoutVat = product.pricePerUnit / (1 + (product.taxRate / 100));
      
      return {
        eligible: true,
        price: priceWithoutVat,
        savings: priceWithVat - priceWithoutVat,
        message: 'Prescription applied - VAT exempt'
      };
    } else {
      return {
        eligible: false,
        price: product.pricePerUnit,
        message: 'Prescription required for this medication'
      };
    }
  }

  /**
   * Calculate price per unit for comparison shopping
   * @param {Array} products - Array of products
   * @returns {Array} Price per unit comparison
   */
  static calculatePricePerUnit(products) {
    return products.map(product => ({
      id: product._id,
      name: product.name,
      pricePerUnit: product.pricePerUnit,
      pricePerPack: product.pricePerPack,
      packSize: product.packSize,
      pricePerUnitFromPack: product.pricePerPack / product.packSize,
      bestDeal: Math.min(product.pricePerUnit, product.pricePerPack / product.packSize) === product.pricePerUnit ? 'Buy Units' : 'Buy Packs',
      savingsByBuyingPack: Math.abs(product.pricePerUnit - (product.pricePerPack / product.packSize)) * product.packSize
    }));
  }
}

module.exports = PricingService;