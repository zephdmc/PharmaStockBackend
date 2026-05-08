const { body, param, query, validationResult } = require('express-validator');

// Handle validation errors
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(error => ({
      field: error.param,
      message: error.msg
    }));
    
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: formattedErrors
    });
  }
  
  next();
};

// User validation rules
const validateUser = {
  create: [
    body('name')
      .trim()
      .notEmpty().withMessage('Name is required')
      .isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Please provide a valid email')
      .normalizeEmail(),
    body('password')
      .notEmpty().withMessage('Password is required')
      .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role')
      .optional()
      .isIn(['admin', 'pos_agent']).withMessage('Role must be either admin or pos_agent'),
    body('pinCode')
      .if(body('role').equals('pos_agent'))
      .notEmpty().withMessage('PIN code is required for POS agents')
      .isLength({ min: 4, max: 4 }).withMessage('PIN must be exactly 4 digits')
      .isNumeric().withMessage('PIN must contain only numbers'),
    validateRequest
  ],
  
  update: [
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
    body('email')
      .optional()
      .trim()
      .isEmail().withMessage('Please provide a valid email')
      .normalizeEmail(),
    body('phone')
      .optional()
      .matches(/^[0-9]{11}$/).withMessage('Phone must be 11 digits'),
    body('role')
      .optional()
      .isIn(['admin', 'pos_agent']).withMessage('Role must be either admin or pos_agent'),
    body('isActive')
      .optional()
      .isBoolean().withMessage('isActive must be boolean'),
    validateRequest
  ],
  
  changePassword: [
    body('currentPassword')
      .notEmpty().withMessage('Current password is required'),
    body('newPassword')
      .notEmpty().withMessage('New password is required')
      .isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
    validateRequest
  ],
  
  verifyPin: [
    body('pin')
      .notEmpty().withMessage('PIN is required')
      .isLength({ min: 4, max: 4 }).withMessage('PIN must be exactly 4 digits')
      .isNumeric().withMessage('PIN must contain only numbers'),
    validateRequest
  ],
  
  forgotPassword: [
    body('email')
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Please provide a valid email'),
    validateRequest
  ],
  
  resetPassword: [
    body('token')
      .notEmpty().withMessage('Reset token is required'),
    body('newPassword')
      .notEmpty().withMessage('New password is required')
      .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    validateRequest
  ]
};

// Product validation rules
const validateProduct = {
  create: [
    body('name')
      .trim()
      .notEmpty().withMessage('Product name is required')
      .isLength({ min: 2, max: 100 }).withMessage('Product name must be between 2 and 100 characters'),
    body('category')
      .notEmpty().withMessage('Category is required')
      .isMongoId().withMessage('Invalid category ID'),
    body('packSize')
      .optional()
      .isInt({ min: 1 }).withMessage('Pack size must be at least 1'),
    body('pricePerUnit')
      .optional()
      .isFloat({ min: 0 }).withMessage('Price per unit must be a positive number'),
    body('pricePerPack')
      .optional()
      .isFloat({ min: 0 }).withMessage('Price per pack must be a positive number'),
    body('costPrice')
      .optional()
      .isFloat({ min: 0 }).withMessage('Cost price must be a positive number'),
    body('reorderLevel')
      .optional()
      .isInt({ min: 0 }).withMessage('Reorder level must be a positive integer'),
    body('expiryDate')
      .optional()
      .isISO8601().withMessage('Invalid date format')
      .custom(value => {
        if (value && new Date(value) <= new Date()) {
          throw new Error('Expiry date must be in the future');
        }
        return true;
      }),
    body('unitType')
      .optional()
      .isIn(['tablet', 'capsule', 'sachet', 'bottle', 'pack', 'ml', 'mg'])
      .withMessage('Invalid unit type'),
    validateRequest
  ],
  
  update: [
    param('id')
      .isMongoId().withMessage('Invalid product ID'),
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 }).withMessage('Product name must be between 2 and 100 characters'),
    body('pricePerUnit')
      .optional()
      .isFloat({ min: 0 }).withMessage('Price per unit must be a positive number'),
    body('pricePerPack')
      .optional()
      .isFloat({ min: 0 }).withMessage('Price per pack must be a positive number'),
    validateRequest
  ],
  
  updateStock: [
    param('id')
      .isMongoId().withMessage('Invalid product ID'),
    body('packs')
      .optional()
      .isInt({ min: 0 }).withMessage('Packs must be a positive integer'),
    body('units')
      .optional()
      .isInt({ min: 0 }).withMessage('Units must be a positive integer'),
    body('type')
      .notEmpty().withMessage('Update type is required')
      .isIn(['add', 'remove']).withMessage('Type must be either add or remove'),
    validateRequest
  ]
};

// Sales validation rules
const validateSale = {
  create: [
    body('items')
      .isArray({ min: 1 }).withMessage('At least one item is required'),
    body('items.*.productId')
      .notEmpty().withMessage('Product ID is required')
      .isMongoId().withMessage('Invalid product ID'),
    body('items.*.quantityPacks')
      .optional()
      .isInt({ min: 0 }).withMessage('Quantity packs must be a positive integer'),
    body('items.*.quantityUnits')
      .optional()
      .isInt({ min: 0 }).withMessage('Quantity units must be a positive integer'),
    body('paymentMethod')
      .notEmpty().withMessage('Payment method is required')
      .isIn(['cash', 'card', 'transfer', 'pos', 'wallet']).withMessage('Invalid payment method'),
    body('pinCode')
      .notEmpty().withMessage('PIN is required for verification')
      .isLength({ min: 4, max: 4 }).withMessage('PIN must be exactly 4 digits')
      .isNumeric().withMessage('PIN must contain only numbers'),
    body('customer.name')
      .optional()
      .trim(),
    body('customer.email')
      .optional()
      .isEmail().withMessage('Invalid customer email'),
    validateRequest
  ],
  
  refund: [
    param('id')
      .isMongoId().withMessage('Invalid transaction ID'),
    body('reason')
      .optional()
      .trim()
      .isLength({ max: 500 }).withMessage('Reason cannot exceed 500 characters'),
    validateRequest
  ]
};

// Inventory validation rules
const validateInventory = {
  addStock: [
    body('productId')
      .notEmpty().withMessage('Product ID is required')
      .isMongoId().withMessage('Invalid product ID'),
    body('packs')
      .optional()
      .isInt({ min: 0 }).withMessage('Packs must be a positive integer'),
    body('units')
      .optional()
      .isInt({ min: 0 }).withMessage('Units must be a positive integer'),
    body('costPerUnit')
      .optional()
      .isFloat({ min: 0 }).withMessage('Cost per unit must be a positive number'),
    body('batchNumber')
      .optional()
      .trim(),
    body('expiryDate')
      .optional()
      .isISO8601().withMessage('Invalid date format'),
    validateRequest
  ],
  
  removeStock: [
    body('productId')
      .notEmpty().withMessage('Product ID is required')
      .isMongoId().withMessage('Invalid product ID'),
    body('packs')
      .optional()
      .isInt({ min: 0 }).withMessage('Packs must be a positive integer'),
    body('units')
      .optional()
      .isInt({ min: 0 }).withMessage('Units must be a positive integer'),
    body('reason')
      .notEmpty().withMessage('Reason for removal is required')
      .isLength({ min: 3, max: 200 }).withMessage('Reason must be between 3 and 200 characters'),
    validateRequest
  ]
};

// Report validation rules
const validateReport = {
  getSalesReport: [
    query('startDate')
      .notEmpty().withMessage('Start date is required')
      .isISO8601().withMessage('Invalid start date format'),
    query('endDate')
      .notEmpty().withMessage('End date is required')
      .isISO8601().withMessage('Invalid end date format')
      .custom((value, { req }) => {
        if (new Date(value) < new Date(req.query.startDate)) {
          throw new Error('End date must be after start date');
        }
        return true;
      }),
    query('groupBy')
      .optional()
      .isIn(['hour', 'day', 'month', 'year']).withMessage('Invalid group by parameter'),
    validateRequest
  ],
  
  getProfitLoss: [
    query('startDate')
      .notEmpty().withMessage('Start date is required')
      .isISO8601().withMessage('Invalid start date format'),
    query('endDate')
      .notEmpty().withMessage('End date is required')
      .isISO8601().withMessage('Invalid end date format')
      .custom((value, { req }) => {
        if (new Date(value) < new Date(req.query.startDate)) {
          throw new Error('End date must be after start date');
        }
        return true;
      }),
    validateRequest
  ]
};

// ID parameter validation
const validateId = [
  param('id')
    .isMongoId().withMessage('Invalid ID format'),
  validateRequest
];

// Pagination validation
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  validateRequest
];

// Search query validation
const validateSearch = [
  query('q')
    .optional()
    .trim()
    .isLength({ min: 2 }).withMessage('Search query must be at least 2 characters'),
  validateRequest
];

// Date range validation
const validateDateRange = [
  query('startDate')
    .optional()
    .isISO8601().withMessage('Invalid start date format'),
  query('endDate')
    .optional()
    .isISO8601().withMessage('Invalid end date format')
    .custom((value, { req }) => {
      if (req.query.startDate && value && new Date(value) < new Date(req.query.startDate)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),
  validateRequest
];

// Bulk operations validation
const validateBulkOperation = [
  body('items')
    .isArray({ min: 1, max: 1000 }).withMessage('Items must be an array with 1-1000 items'),
  body('items.*.id')
    .optional()
    .isMongoId().withMessage('Invalid item ID'),
  validateRequest
];

// Wrapper middleware functions
const validatePaginationMiddleware = (req, res, next) => {
  const runValidators = async () => {
    for (const validator of validatePagination) {
      await validator(req, res, () => {});
    }
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    next();
  };
  runValidators();
};

const validateSearchMiddleware = (req, res, next) => {
  const runValidators = async () => {
    for (const validator of validateSearch) {
      await validator(req, res, () => {});
    }
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    next();
  };
  runValidators();
};

const validateIdMiddleware = (req, res, next) => {
  const runValidators = async () => {
    for (const validator of validateId) {
      await validator(req, res, () => {});
    }
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    next();
  };
  runValidators();
};

const validateProductCreateMiddleware = (req, res, next) => {
  const runValidators = async () => {
    for (const validator of validateProduct.create) {
      await validator(req, res, () => {});
    }
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    next();
  };
  runValidators();
};

const validateProductUpdateMiddleware = (req, res, next) => {
  const runValidators = async () => {
    for (const validator of validateProduct.update) {
      await validator(req, res, () => {});
    }
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    next();
  };
  runValidators();
};

const validateProductUpdateStockMiddleware = (req, res, next) => {
  const runValidators = async () => {
    for (const validator of validateProduct.updateStock) {
      await validator(req, res, () => {});
    }
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    next();
  };
  runValidators();
};

const validateBulkOperationMiddleware = (req, res, next) => {
  const runValidators = async () => {
    for (const validator of validateBulkOperation) {
      await validator(req, res, () => {});
    }
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    next();
  };
  runValidators();
};

module.exports = {
  validateRequest,
  validateUser,
  validateProduct,
  validateSale,
  validateInventory,
  validateReport,
  validateId,
  validatePagination,
  validateSearch,
  validateDateRange,
  validateBulkOperation,
  validatePaginationMiddleware,
  validateSearchMiddleware,
  validateIdMiddleware,
  validateProductCreateMiddleware,
  validateProductUpdateMiddleware,
  validateProductUpdateStockMiddleware,
  validateBulkOperationMiddleware
};
