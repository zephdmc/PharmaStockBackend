// backend/src/utils/helpers.js
const crypto = require('crypto');
const moment = require('moment');

/**
 * Generate unique ID
 * @param {string} prefix - Optional prefix
 * @returns {string} Unique ID
 */
const generateUniqueId = (prefix = '') => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  const id = `${timestamp}${random}`.toUpperCase();
  return prefix ? `${prefix}-${id}` : id;
};

/**
 * Generate receipt number
 * @returns {string} Receipt number
 */
const generateReceiptNumber = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `RCPT-${year}${month}${day}-${random}`;
};

/**
 * Generate transaction ID
 * @returns {string} Transaction ID
 */
const generateTransactionId = () => {
  const date = new Date();
  const timestamp = date.getTime().toString().slice(-8);
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `TRX-${timestamp}-${random}`;
};

/**
 * Format currency (Nigerian Naira)
 * @param {number} amount - Amount to format
 * @returns {string} Formatted currency
 */
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

/**
 * Format date
 * @param {Date|string} date - Date to format
 * @param {string} format - Date format
 * @returns {string} Formatted date
 */
const formatDate = (date, format = 'DD/MM/YYYY') => {
  return moment(date).format(format);
};

/**
 * Format date time
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted date time
 */
const formatDateTime = (date) => {
  return moment(date).format('DD/MM/YYYY HH:mm:ss');
};

/**
 * Calculate days between two dates
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {number} Days difference
 */
const daysBetween = (startDate, endDate) => {
  const start = moment(startDate);
  const end = moment(endDate);
  return end.diff(start, 'days');
};

/**
 * Check if date is expired
 * @param {Date} expiryDate - Expiry date
 * @returns {boolean} True if expired
 */
const isExpired = (expiryDate) => {
  return moment(expiryDate).isBefore(moment());
};

/**
 * Get days until expiry
 * @param {Date} expiryDate - Expiry date
 * @returns {number} Days until expiry (negative if expired)
 */
const daysUntilExpiry = (expiryDate) => {
  return moment(expiryDate).diff(moment(), 'days');
};

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} Promise that resolves after timeout
 */
const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Retry async operation
 * @param {Function} fn - Async function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} delay - Delay between retries in ms
 * @returns {Promise} Result of the function
 */
const retry = async (fn, maxRetries = 3, delay = 1000) => {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        await sleep(delay);
      }
    }
  }
  
  throw lastError;
};

/**
 * Deep clone object
 * @param {Object} obj - Object to clone
 * @returns {Object} Cloned object
 */
const deepClone = (obj) => {
  return JSON.parse(JSON.stringify(obj));
};

/**
 * Pick specific fields from object
 * @param {Object} obj - Source object
 * @param {Array} fields - Fields to pick
 * @returns {Object} Object with picked fields
 */
const pick = (obj, fields) => {
  const result = {};
  fields.forEach(field => {
    if (obj && obj[field] !== undefined) {
      result[field] = obj[field];
    }
  });
  return result;
};

/**
 * Omit specific fields from object
 * @param {Object} obj - Source object
 * @param {Array} fields - Fields to omit
 * @returns {Object} Object without omitted fields
 */
const omit = (obj, fields) => {
  const result = { ...obj };
  fields.forEach(field => {
    delete result[field];
  });
  return result;
};

/**
 * Check if value is empty (null, undefined, empty string, empty array, empty object)
 * @param {any} value - Value to check
 * @returns {boolean} True if empty
 */
const isEmpty = (value) => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
};

/**
 * Capitalize first letter of string
 * @param {string} str - String to capitalize
 * @returns {string} Capitalized string
 */
const capitalize = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

/**
 * Truncate string to specified length
 * @param {string} str - String to truncate
 * @param {number} length - Maximum length
 * @param {string} suffix - Suffix to add
 * @returns {string} Truncated string
 */
const truncate = (str, length = 50, suffix = '...') => {
  if (!str) return '';
  if (str.length <= length) return str;
  return str.substring(0, length) + suffix;
};

/**
 * Slugify string (for URLs)
 * @param {string} str - String to slugify
 * @returns {string} Slugified string
 */
const slugify = (str) => {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

/**
 * Generate random string
 * @param {number} length - Length of random string
 * @returns {string} Random string
 */
const randomString = (length = 10) => {
  return crypto.randomBytes(length).toString('hex').slice(0, length);
};

/**
 * Generate random number between min and max
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Random number
 */
const randomNumber = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

/**
 * Calculate percentage
 * @param {number} value - Current value
 * @param {number} total - Total value
 * @returns {number} Percentage
 */
const calculatePercentage = (value, total) => {
  if (total === 0) return 0;
  return (value / total) * 100;
};

/**
 * Group array by key
 * @param {Array} array - Array to group
 * @param {string} key - Key to group by
 * @returns {Object} Grouped object
 */
const groupBy = (array, key) => {
  return array.reduce((result, item) => {
    const groupKey = item[key];
    if (!result[groupKey]) {
      result[groupKey] = [];
    }
    result[groupKey].push(item);
    return result;
  }, {});
};

/**
 * Sort array of objects by key
 * @param {Array} array - Array to sort
 * @param {string} key - Key to sort by
 * @param {string} order - 'asc' or 'desc'
 * @returns {Array} Sorted array
 */
const sortBy = (array, key, order = 'asc') => {
  return [...array].sort((a, b) => {
    let aVal = a[key];
    let bVal = b[key];
    
    if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }
    
    if (order === 'asc') {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });
};

/**
 * Parse JSON safely
 * @param {string} jsonString - JSON string to parse
 * @param {any} defaultValue - Default value if parsing fails
 * @returns {any} Parsed object or default value
 */
const safeJsonParse = (jsonString, defaultValue = null) => {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    return defaultValue;
  }
};

/**
 * Convert object to query string
 * @param {Object} params - Query parameters
 * @returns {string} Query string
 */
const toQueryString = (params) => {
  return Object.keys(params)
    .filter(key => params[key] !== undefined && params[key] !== null)
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');
};

/**
 * Parse query string to object
 * @param {string} queryString - Query string
 * @returns {Object} Query parameters object
 */
const parseQueryString = (queryString) => {
  const params = {};
  const search = queryString.startsWith('?') ? queryString.substring(1) : queryString;
  
  search.split('&').forEach(pair => {
    const [key, value] = pair.split('=');
    if (key) {
      params[decodeURIComponent(key)] = decodeURIComponent(value || '');
    }
  });
  
  return params;
};

/**
 * Mask sensitive data (like credit card, PIN)
 * @param {string} data - Data to mask
 * @param {number} visibleStart - Number of characters to show at start
 * @param {number} visibleEnd - Number of characters to show at end
 * @returns {string} Masked string
 */
const maskData = (data, visibleStart = 2, visibleEnd = 2) => {
  if (!data) return '';
  if (data.length <= visibleStart + visibleEnd) return '*'.repeat(data.length);
  
  const start = data.slice(0, visibleStart);
  const end = data.slice(-visibleEnd);
  const middle = '*'.repeat(data.length - visibleStart - visibleEnd);
  
  return start + middle + end;
};

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/;
  return emailRegex.test(email);
};

/**
 * Validate Nigerian phone number
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid
 */
const isValidPhoneNumber = (phone) => {
  const cleaned = phone.replace(/\D/g, '');
  const patterns = [
    /^0[789][01]\d{8}$/,
    /^234[789][01]\d{8}$/,
    /^\+234[789][01]\d{8}$/
  ];
  return patterns.some(pattern => pattern.test(cleaned));
};

module.exports = {
  generateUniqueId,
  generateReceiptNumber,
  generateTransactionId,
  formatCurrency,
  formatDate,
  formatDateTime,
  daysBetween,
  isExpired,
  daysUntilExpiry,
  sleep,
  retry,
  deepClone,
  pick,
  omit,
  isEmpty,
  capitalize,
  truncate,
  slugify,
  randomString,
  randomNumber,
  calculatePercentage,
  groupBy,
  sortBy,
  safeJsonParse,
  toQueryString,
  parseQueryString,
  maskData,
  isValidEmail,
  isValidPhoneNumber
};