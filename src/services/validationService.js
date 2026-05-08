// backend/src/services/validationService.js
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');

class ValidationService {
  /**
   * Verify user PIN
   * @param {string} userId - User ID
   * @param {string} pin - PIN to verify
   * @returns {Promise<Object>} Verification result
   */
  static async verifyPin(userId, pin) {
    try {
      const user = await User.findById(userId).select('+pinCode');
      
      if (!user) {
        return { valid: false, message: 'User not found' };
      }
      
      if (!user.pinCode) {
        return { valid: false, message: 'PIN not set for this user' };
      }
      
      const isValid = await bcrypt.compare(pin, user.pinCode);
      
      if (!isValid) {
        return { valid: false, message: 'Invalid PIN' };
      }
      
      return { valid: true, message: 'PIN verified successfully' };
    } catch (error) {
      console.error('PIN verification error:', error);
      return { valid: false, message: 'Error verifying PIN' };
    }
  }

  /**
   * Validate Nigerian phone number
   * @param {string} phone - Phone number
   * @returns {Object} Validation result
   */
  static validatePhoneNumber(phone) {
    if (!phone) {
      return { valid: false, message: 'Phone number is required' };
    }
    
    // Remove all non-digit characters
    const cleaned = phone.replace(/\D/g, '');
    
    // Nigerian phone number patterns
    const patterns = [
      /^0[789][01]\d{8}$/,      // 080, 081, 090, 091 format
      /^234[789][01]\d{8}$/,    // 23480, 23481, 23490, 23491 format
      /^\+234[789][01]\d{8}$/   // +23480, +23481 format
    ];
    
    const isValid = patterns.some(pattern => pattern.test(cleaned));
    
    return {
      valid: isValid,
      message: isValid ? 'Valid phone number' : 'Invalid Nigerian phone number',
      formatted: isValid ? this.formatPhoneNumber(cleaned) : null
    };
  }

  /**
   * Format Nigerian phone number
   * @param {string} phone - Raw phone number
   * @returns {string} Formatted phone number
   */
  static formatPhoneNumber(phone) {
    const cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.startsWith('0') && cleaned.length === 11) {
      return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
    }
    
    if (cleaned.startsWith('234') && cleaned.length === 13) {
      return `+${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 9)} ${cleaned.slice(9)}`;
    }
    
    return phone;
  }

  /**
   * Validate NAFDAC registration number
   * @param {string} nafdacNumber - NAFDAC number
   * @returns {Object} Validation result
   */
  static validateNafdacNumber(nafdacNumber) {
    if (!nafdacNumber) {
      return { valid: true, message: 'NAFDAC number not provided' };
    }
    
    // NAFDAC number formats (example patterns)
    const patterns = [
      /^[A-Z0-9]{4,20}$/i,           // Basic alphanumeric
      /^NAFDAC-\d{2}-\d{4}-\d{4}$/i,  // NAFDAC-01-1234-5678 format
      /^[0-9]{2}-[0-9]{4}-[A-Z0-9]{4}$/i  // 01-1234-ABCD format
    ];
    
    const isValid = patterns.some(pattern => pattern.test(nafdacNumber));
    
    return {
      valid: isValid,
      message: isValid ? 'Valid NAFDAC number' : 'Invalid NAFDAC number format'
    };
  }

  /**
   * Validate batch number
   * @param {string} batchNumber - Batch number
   * @returns {Object} Validation result
   */
  static validateBatchNumber(batchNumber) {
    if (!batchNumber) {
      return { valid: true, message: 'Batch number not provided' };
    }
    
    if (batchNumber.length < 2 || batchNumber.length > 30) {
      return { valid: false, message: 'Batch number must be between 2 and 30 characters' };
    }
    
    const validChars = /^[A-Z0-9-]+$/i;
    if (!validChars.test(batchNumber)) {
      return { valid: false, message: 'Batch number can only contain letters, numbers, and hyphens' };
    }
    
    return { valid: true, message: 'Valid batch number' };
  }

  /**
   * Validate expiry date
   * @param {Date} expiryDate - Expiry date
   * @returns {Object} Validation result
   */
  static validateExpiryDate(expiryDate) {
    if (!expiryDate) {
      return { valid: true, message: 'Expiry date not provided' };
    }
    
    const date = new Date(expiryDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (isNaN(date.getTime())) {
      return { valid: false, message: 'Invalid date format' };
    }
    
    if (date < today) {
      return { valid: false, message: 'Product has expired' };
    }
    
    const daysUntilExpiry = Math.ceil((date - today) / (1000 * 60 * 60 * 24));
    
    return {
      valid: true,
      message: 'Valid expiry date',
      daysUntilExpiry,
      isExpiringSoon: daysUntilExpiry <= 90
    };
  }

  /**
   * Validate stock levels before sale
   * @param {Object} product - Product object
   * @param {number} packs - Requested packs
   * @param {number} units - Requested units
   * @returns {Object} Validation result
   */
  static validateStockAvailability(product, packs, units) {
    const requestedUnits = (packs * product.packSize) + units;
    const availableUnits = (product.currentStock.packs * product.packSize) + product.currentStock.units;
    
    if (requestedUnits === 0) {
      return { valid: false, message: 'Quantity must be greater than 0' };
    }
    
    if (requestedUnits > availableUnits) {
      return {
        valid: false,
        message: `Insufficient stock. Available: ${availableUnits} units (${product.currentStock.packs} packs + ${product.currentStock.units} units)`,
        availableUnits,
        requestedUnits,
        shortfall: requestedUnits - availableUnits
      };
    }
    
    return {
      valid: true,
      message: 'Sufficient stock available',
      availableUnits,
      requestedUnits
    };
  }

  /**
   * Validate price boundaries
   * @param {number} price - Price to validate
   * @param {Object} options - Validation options
   * @returns {Object} Validation result
   */
  static validatePrice(price, options = {}) {
    const { min = 0, max = 10000000, allowZero = true } = options;
    
    if (price === undefined || price === null) {
      return { valid: false, message: 'Price is required' };
    }
    
    if (typeof price !== 'number' || isNaN(price)) {
      return { valid: false, message: 'Price must be a number' };
    }
    
    if (!allowZero && price === 0) {
      return { valid: false, message: 'Price cannot be zero' };
    }
    
    if (price < min) {
      return { valid: false, message: `Price cannot be less than ${min}` };
    }
    
    if (price > max) {
      return { valid: false, message: `Price cannot exceed ${max}` };
    }
    
    return { valid: true, message: 'Valid price' };
  }

  /**
   * Validate quantity
   * @param {number} quantity - Quantity to validate
   * @param {Object} options - Validation options
   * @returns {Object} Validation result
   */
  static validateQuantity(quantity, options = {}) {
    const { min = 0, max = 10000, integer = true } = options;
    
    if (quantity === undefined || quantity === null) {
      return { valid: false, message: 'Quantity is required' };
    }
    
    if (typeof quantity !== 'number' || isNaN(quantity)) {
      return { valid: false, message: 'Quantity must be a number' };
    }
    
    if (integer && !Number.isInteger(quantity)) {
      return { valid: false, message: 'Quantity must be a whole number' };
    }
    
    if (quantity < min) {
      return { valid: false, message: `Quantity cannot be less than ${min}` };
    }
    
    if (quantity > max) {
      return { valid: false, message: `Quantity cannot exceed ${max}` };
    }
    
    return { valid: true, message: 'Valid quantity' };
  }

  /**
   * Validate payment amount
   * @param {number} amount - Payment amount
   * @param {number} totalDue - Total amount due
   * @returns {Object} Validation result
   */
  static validatePaymentAmount(amount, totalDue) {
    if (amount === undefined || amount === null) {
      return { valid: false, message: 'Payment amount is required' };
    }
    
    if (typeof amount !== 'number' || isNaN(amount)) {
      return { valid: false, message: 'Payment amount must be a number' };
    }
    
    if (amount <= 0) {
      return { valid: false, message: 'Payment amount must be greater than 0' };
    }
    
    if (amount < totalDue) {
      return {
        valid: false,
        message: `Insufficient payment. Amount due: ₦${totalDue.toLocaleString()}`,
        shortfall: totalDue - amount
      };
    }
    
    const change = amount - totalDue;
    
    return {
      valid: true,
      message: 'Valid payment amount',
      change,
      hasChange: change > 0
    };
  }

  /**
   * Validate email address
   * @param {string} email - Email to validate
   * @returns {Object} Validation result
   */
  static validateEmail(email) {
    if (!email) {
      return { valid: false, message: 'Email is required' };
    }
    
    const emailRegex = /^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/;
    const isValid = emailRegex.test(email);
    
    return {
      valid: isValid,
      message: isValid ? 'Valid email address' : 'Invalid email address format'
    };
  }

  /**
   * Validate password strength
   * @param {string} password - Password to validate
   * @param {Object} options - Validation options
   * @returns {Object} Validation result
   */
  static validatePasswordStrength(password, options = {}) {
    const {
      minLength = 6,
      requireUppercase = true,
      requireLowercase = true,
      requireNumbers = true,
      requireSpecialChars = false
    } = options;
    
    const checks = [];
    
    if (password.length < minLength) {
      checks.push(`At least ${minLength} characters`);
    }
    
    if (requireUppercase && !/[A-Z]/.test(password)) {
      checks.push('At least one uppercase letter');
    }
    
    if (requireLowercase && !/[a-z]/.test(password)) {
      checks.push('At least one lowercase letter');
    }
    
    if (requireNumbers && !/\d/.test(password)) {
      checks.push('At least one number');
    }
    
    if (requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      checks.push('At least one special character');
    }
    
    const isValid = checks.length === 0;
    
    return {
      valid: isValid,
      message: isValid ? 'Strong password' : `Password must contain: ${checks.join(', ')}`,
      checks: checks
    };
  }

  /**
   * Hash sensitive data
   * @param {string} data - Data to hash
   * @returns {string} Hashed data
   */
  static hashData(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Validate that two values match
   * @param {any} value1 - First value
   * @param {any} value2 - Second value
   * @param {string} fieldName - Field name for error message
   * @returns {Object} Validation result
   */
  static validateMatch(value1, value2, fieldName = 'Fields') {
    const isValid = value1 === value2;
    
    return {
      valid: isValid,
      message: isValid ? `${fieldName} match` : `${fieldName} do not match`
    };
  }
}

module.exports = ValidationService;