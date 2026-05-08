// backend/src/utils/constants.js

// User Roles
const USER_ROLES = {
    ADMIN: 'admin',
    POS_AGENT: 'pos_agent'
  };
  
  // User Role Labels
  const USER_ROLE_LABELS = {
    [USER_ROLES.ADMIN]: 'Administrator',
    [USER_ROLES.POS_AGENT]: 'POS Agent'
  };
  
  // Product Unit Types
  const UNIT_TYPES = {
    TABLET: 'tablet',
    CAPSULE: 'capsule',
    SACHET: 'sachet',
    BOTTLE: 'bottle',
    PACK: 'pack',
    ML: 'ml',
    MG: 'mg'
  };
  
  // Unit Type Labels
  const UNIT_TYPE_LABELS = {
    [UNIT_TYPES.TABLET]: 'Tablet(s)',
    [UNIT_TYPES.CAPSULE]: 'Capsule(s)',
    [UNIT_TYPES.SACHET]: 'Sachet(s)',
    [UNIT_TYPES.BOTTLE]: 'Bottle(s)',
    [UNIT_TYPES.PACK]: 'Pack(s)',
    [UNIT_TYPES.ML]: 'ML',
    [UNIT_TYPES.MG]: 'MG'
  };
  
  // Payment Methods
  const PAYMENT_METHODS = {
    CASH: 'cash',
    CARD: 'card',
    TRANSFER: 'transfer',
    POS: 'pos',
    WALLET: 'wallet'
  };
  
  // Payment Method Labels
  const PAYMENT_METHOD_LABELS = {
    [PAYMENT_METHODS.CASH]: 'Cash',
    [PAYMENT_METHODS.CARD]: 'Card Payment',
    [PAYMENT_METHODS.TRANSFER]: 'Bank Transfer',
    [PAYMENT_METHODS.POS]: 'POS Machine',
    [PAYMENT_METHODS.WALLET]: 'Digital Wallet'
  };
  
  // Transaction Status
  const TRANSACTION_STATUS = {
    PENDING: 'pending',
    COMPLETED: 'completed',
    FAILED: 'failed',
    REFUNDED: 'refunded',
    VOID: 'void'
  };
  
  // Transaction Status Labels
  const TRANSACTION_STATUS_LABELS = {
    [TRANSACTION_STATUS.PENDING]: 'Pending',
    [TRANSACTION_STATUS.COMPLETED]: 'Completed',
    [TRANSACTION_STATUS.FAILED]: 'Failed',
    [TRANSACTION_STATUS.REFUNDED]: 'Refunded',
    [TRANSACTION_STATUS.VOID]: 'Void'
  };
  
  // Transaction Status Colors
  const TRANSACTION_STATUS_COLORS = {
    [TRANSACTION_STATUS.PENDING]: 'warning',
    [TRANSACTION_STATUS.COMPLETED]: 'success',
    [TRANSACTION_STATUS.FAILED]: 'error',
    [TRANSACTION_STATUS.REFUNDED]: 'info',
    [TRANSACTION_STATUS.VOID]: 'default'
  };
  
  // Inventory Movement Types
  const MOVEMENT_TYPES = {
    RESTOCK: 'restock',
    SALE: 'sale',
    ADJUSTMENT: 'adjustment',
    RETURN: 'return',
    DAMAGE: 'damage',
    EXPIRED: 'expired'
  };
  
  // Movement Type Labels
  const MOVEMENT_TYPE_LABELS = {
    [MOVEMENT_TYPES.RESTOCK]: 'Restock',
    [MOVEMENT_TYPES.SALE]: 'Sale',
    [MOVEMENT_TYPES.ADJUSTMENT]: 'Stock Adjustment',
    [MOVEMENT_TYPES.RETURN]: 'Return',
    [MOVEMENT_TYPES.DAMAGE]: 'Damaged Goods',
    [MOVEMENT_TYPES.EXPIRED]: 'Expired Products'
  };
  
  // Stock Adjustment Categories
  const ADJUSTMENT_CATEGORIES = {
    RESTOCK: 'restock',
    THEFT: 'theft',
    DAMAGE: 'damage',
    EXPIRY: 'expiry',
    INVENTORY_COUNT: 'inventory_count',
    RETURN: 'return',
    OTHER: 'other'
  };
  
  // VAT Rate (Nigeria)
  const VAT_RATE = 7.5;
  
  // Nigerian States
  const NIGERIAN_STATES = [
    'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
    'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'Gombe', 'Imo', 'Jigawa',
    'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger',
    'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
    'FCT Abuja'
  ];
  
  // Pagination Defaults
  const PAGINATION = {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
    LIMIT_OPTIONS: [10, 20, 50, 100]
  };
  
  // Stock Thresholds
  const STOCK_THRESHOLDS = {
    LOW_STOCK: 20,
    CRITICAL_STOCK: 5,
    EXPIRY_WARNING_DAYS: 90,
    EXPIRY_CRITICAL_DAYS: 30,
    MAX_STOCK: 1000
  };
  
  // Cache Durations (in milliseconds)
  const CACHE_DURATIONS = {
    SHORT: 5 * 60 * 1000,      // 5 minutes
    MEDIUM: 30 * 60 * 1000,    // 30 minutes
    LONG: 60 * 60 * 1000,      // 1 hour
    VERY_LONG: 24 * 60 * 60 * 1000  // 24 hours
  };
  
  // API Rate Limits
  const RATE_LIMITS = {
    DEFAULT: {
      windowMs: 15 * 60 * 1000,  // 15 minutes
      max: 100                    // 100 requests per window
    },
    AUTH: {
      windowMs: 15 * 60 * 1000,  // 15 minutes
      max: 5                      // 5 login attempts
    },
    API: {
      windowMs: 60 * 1000,       // 1 minute
      max: 60                     // 60 requests per minute
    }
  };
  
  // File Upload Limits
  const UPLOAD_LIMITS = {
    MAX_FILE_SIZE: 5 * 1024 * 1024,  // 5MB
    ALLOWED_MIME_TYPES: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ],
    MAX_FILES_PER_UPLOAD: 5
  };
  
  // Token Expiration Times (in seconds)
  const TOKEN_EXPIRY = {
    ACCESS: 7 * 24 * 60 * 60,    // 7 days
    REFRESH: 30 * 24 * 60 * 60,  // 30 days
    RESET_PASSWORD: 60 * 60,      // 1 hour
    EMAIL_VERIFICATION: 24 * 60 * 60  // 24 hours
  };
  
  // HTTP Status Codes
  const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    ACCEPTED: 202,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503
  };
  
  // Error Messages
  const ERROR_MESSAGES = {
    // Authentication errors
    INVALID_CREDENTIALS: 'Invalid email or password',
    UNAUTHORIZED: 'Unauthorized access',
    TOKEN_EXPIRED: 'Token expired. Please login again',
    TOKEN_INVALID: 'Invalid token',
    ACCOUNT_LOCKED: 'Account is locked. Please try again later',
    ACCOUNT_INACTIVE: 'Account is deactivated. Contact administrator',
    INVALID_PIN: 'Invalid PIN',
    PIN_REQUIRED: 'PIN is required for this operation',
    
    // Resource errors
    NOT_FOUND: 'Resource not found',
    ALREADY_EXISTS: 'Resource already exists',
    INVALID_ID: 'Invalid ID format',
    
    // Validation errors
    VALIDATION_ERROR: 'Validation failed',
    INVALID_INPUT: 'Invalid input provided',
    MISSING_FIELDS: 'Required fields are missing',
    
    // Stock errors
    INSUFFICIENT_STOCK: 'Insufficient stock available',
    PRODUCT_OUT_OF_STOCK: 'Product is out of stock',
    PRODUCT_EXPIRED: 'Product has expired',
    
    // Transaction errors
    TRANSACTION_FAILED: 'Transaction failed',
    REFUND_FAILED: 'Refund failed',
    INVALID_PAYMENT: 'Invalid payment method',
    
    // Server errors
    INTERNAL_ERROR: 'Internal server error',
    DATABASE_ERROR: 'Database error',
    NETWORK_ERROR: 'Network error'
  };
  
  // Success Messages
  const SUCCESS_MESSAGES = {
    LOGIN_SUCCESS: 'Login successful',
    LOGOUT_SUCCESS: 'Logout successful',
    PIN_VERIFIED: 'PIN verified successfully',
    PASSWORD_CHANGED: 'Password changed successfully',
    PROFILE_UPDATED: 'Profile updated successfully',
    
    PRODUCT_CREATED: 'Product created successfully',
    PRODUCT_UPDATED: 'Product updated successfully',
    PRODUCT_DELETED: 'Product deleted successfully',
    
    STOCK_ADDED: 'Stock added successfully',
    STOCK_REMOVED: 'Stock removed successfully',
    
    SALE_COMPLETED: 'Sale completed successfully',
    REFUND_COMPLETED: 'Refund completed successfully',
    
    USER_CREATED: 'User created successfully',
    USER_UPDATED: 'User updated successfully',
    USER_DELETED: 'User deleted successfully',
    
    REPORT_GENERATED: 'Report generated successfully'
  };
  
  // Date Formats
  const DATE_FORMATS = {
    DISPLAY: 'DD/MM/YYYY',
    DISPLAY_WITH_TIME: 'DD/MM/YYYY HH:mm:ss',
    API: 'YYYY-MM-DD',
    API_WITH_TIME: 'YYYY-MM-DD HH:mm:ss',
    FILE_NAME: 'YYYY-MM-DD_HH-mm-ss',
    MONTH_DAY: 'MMM DD',
    TIME: 'HH:mm:ss'
  };
  
  // Log Levels
  const LOG_LEVELS = {
    ERROR: 'error',
    WARN: 'warn',
    INFO: 'info',
    DEBUG: 'debug',
    VERBOSE: 'verbose'
  };
  
  // Environment Variables
  const ENVIRONMENTS = {
    DEVELOPMENT: 'development',
    STAGING: 'staging',
    PRODUCTION: 'production',
    TEST: 'test'
  };
  
  // Default Pharmacy Info (for receipts)
  const DEFAULT_PHARMACY_INFO = {
    name: 'PharmaInventory Store',
    address: '123 Pharmacy Road, Lagos, Nigeria',
    phone: '+234 801 234 5678',
    email: 'info@pharmainventory.com',
    vatNumber: 'VAT-12345678-01',
    rcNumber: 'RC-1234567'
  };
  
  // Report Types
  const REPORT_TYPES = {
    SALES: 'sales',
    INVENTORY: 'inventory',
    PROFIT_LOSS: 'profit-loss',
    TAX: 'tax',
    LOW_STOCK: 'low-stock',
    EXPIRING: 'expiring',
    DAILY_SUMMARY: 'daily-summary',
    MONTHLY_SUMMARY: 'monthly-summary'
  };
  
  // Export Formats
  const EXPORT_FORMATS = {
    PDF: 'pdf',
    EXCEL: 'excel',
    CSV: 'csv'
  };
  
  // Sort Orders
  const SORT_ORDERS = {
    ASC: 'asc',
    DESC: 'desc'
  };
  
  // Filter Operators
  const FILTER_OPERATORS = {
    EQ: 'eq',
    NE: 'ne',
    GT: 'gt',
    GTE: 'gte',
    LT: 'lt',
    LTE: 'lte',
    LIKE: 'like',
    IN: 'in',
    NIN: 'nin'
  };
  
  module.exports = {
    USER_ROLES,
    USER_ROLE_LABELS,
    UNIT_TYPES,
    UNIT_TYPE_LABELS,
    PAYMENT_METHODS,
    PAYMENT_METHOD_LABELS,
    TRANSACTION_STATUS,
    TRANSACTION_STATUS_LABELS,
    TRANSACTION_STATUS_COLORS,
    MOVEMENT_TYPES,
    MOVEMENT_TYPE_LABELS,
    ADJUSTMENT_CATEGORIES,
    VAT_RATE,
    NIGERIAN_STATES,
    PAGINATION,
    STOCK_THRESHOLDS,
    CACHE_DURATIONS,
    RATE_LIMITS,
    UPLOAD_LIMITS,
    TOKEN_EXPIRY,
    HTTP_STATUS,
    ERROR_MESSAGES,
    SUCCESS_MESSAGES,
    DATE_FORMATS,
    LOG_LEVELS,
    ENVIRONMENTS,
    DEFAULT_PHARMACY_INFO,
    REPORT_TYPES,
    EXPORT_FORMATS,
    SORT_ORDERS,
    FILTER_OPERATORS
  };