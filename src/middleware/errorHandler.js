// backend/src/middleware/errorHandler.js
const mongoose = require('mongoose');

// Custom error classes
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, errors = null) {
    super(message, 400);
    this.errors = errors;
    this.name = 'ValidationError';
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401);
    this.name = 'AuthenticationError';
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'You do not have permission to perform this action') {
    super(message, 403);
    this.name = 'AuthorizationError';
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404);
    this.name = 'NotFoundError';
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(message, 409);
    this.name = 'ConflictError';
  }
}

// Global error handler middleware
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  
  // Log error for debugging
  console.error('Error:', {
    name: err.name,
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userId: req.user?._id
  });
  
  // Mongoose validation error
  if (err instanceof mongoose.Error.ValidationError) {
    const errors = Object.values(err.errors).map(e => ({
      field: e.path,
      message: e.message
    }));
    error = new ValidationError('Validation failed', errors);
  }
  
  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    error = new ConflictError(`${field} already exists`);
  }
  
  // Mongoose CastError (invalid ID)
  if (err instanceof mongoose.Error.CastError) {
    error = new NotFoundError(`${err.path} with id ${err.value}`);
  }
  
  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = new AuthenticationError('Invalid token');
  }
  
  if (err.name === 'TokenExpiredError') {
    error = new AuthenticationError('Token expired');
  }
  
  // Multer errors (file upload)
  if (err.code === 'LIMIT_FILE_SIZE') {
    error = new AppError('File too large. Maximum size is 5MB', 400);
  }
  
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    error = new AppError('Too many files uploaded', 400);
  }
  
  // Send response
  const statusCode = error.statusCode || 500;
  const response = {
    success: false,
    message: error.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    ...(error.errors && { errors: error.errors })
  };
  
  res.status(statusCode).json(response);
};

// Async handler wrapper to avoid try-catch in controllers
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Not found middleware (404)
const notFound = (req, res, next) => {
  const error = new NotFoundError(`Route ${req.originalUrl}`);
  next(error);
};

// Database error handler
const handleDatabaseError = (err) => {
  if (err.code === 'ECONNREFUSED') {
    console.error('Database connection refused. Please check if MongoDB is running.');
    process.exit(1);
  }
  
  if (err.code === 'EADDRINUSE') {
    console.error('Port is already in use. Please check if another instance is running.');
    process.exit(1);
  }
  
  return err;
};

// Unhandled rejection handler
const handleUnhandledRejection = (err) => {
  console.error('UNHANDLED REJECTION:', err);
  console.error('Stack:', err.stack);
  
  // Graceful shutdown
  process.exit(1);
};

// Uncaught exception handler
const handleUncaughtException = (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
  console.error('Stack:', err.stack);
  
  // Graceful shutdown
  process.exit(1);
};

// Setup global error handlers
const setupGlobalErrorHandlers = () => {
  process.on('unhandledRejection', handleUnhandledRejection);
  process.on('uncaughtException', handleUncaughtException);
  process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    process.exit(0);
  });
  process.on('SIGINT', () => {
    console.log('SIGINT received. Shutting down gracefully...');
      process.exit(0);
      // backend/src/middleware/errorHandler.js (continued)
    process.exit(0);
});
};

// Rate limit exceeded handler
const rateLimitHandler = (req, res) => {
res.status(429).json({
  success: false,
  message: 'Too many requests, please try again later.',
  retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
});
};

// Sanitize error for response (remove sensitive info)
const sanitizeError = (err) => {
const sanitized = {
  message: err.message,
  statusCode: err.statusCode || 500,
  isOperational: err.isOperational || false
};

// Add validation errors if present
if (err.errors) {
  sanitized.errors = err.errors;
}

// Add stack trace in development
if (process.env.NODE_ENV === 'development') {
  sanitized.stack = err.stack;
}

return sanitized;
};

// Log error to file/database (for production)
const logError = async (err, req) => {
const errorLog = {
  timestamp: new Date(),
  name: err.name,
  message: err.message,
  stack: err.stack,
  url: req.originalUrl,
  method: req.method,
  ip: req.ip,
  userId: req.user?._id,
  userAgent: req.get('user-agent'),
  statusCode: err.statusCode || 500
};

// In production, you might want to save to database
if (process.env.NODE_ENV === 'production') {
  // await ErrorLog.create(errorLog);
  console.error('Error logged:', errorLog);
} else {
  console.error('Error details:', errorLog);
}
};

// API version error handler
const apiVersionHandler = (req, res, next) => {
const version = req.headers['api-version'] || req.query.version;

if (version && !['v1', 'v2'].includes(version)) {
  return res.status(400).json({
    success: false,
    message: 'Invalid API version. Supported versions: v1, v2'
  });
}

req.apiVersion = version || 'v1';
next();
};

// Maintenance mode handler
let isMaintenanceMode = false;

const maintenanceMode = (req, res, next) => {
if (isMaintenanceMode && req.path !== '/api/health') {
  return res.status(503).json({
    success: false,
    message: 'System is under maintenance. Please try again later.',
    estimatedTime: '30 minutes'
  });
}
next();
};

// Enable/disable maintenance mode (admin function)
const setMaintenanceMode = (enabled) => {
isMaintenanceMode = enabled;
console.log(`Maintenance mode ${enabled ? 'enabled' : 'disabled'}`);
};

// Request timeout handler
const timeoutHandler = (req, res, next) => {
const timeout = 30000; // 30 seconds
req.setTimeout(timeout, () => {
  res.status(408).json({
    success: false,
    message: 'Request timeout. Please try again.'
  });
  req.abort();
});
next();
};

// Compress response handler (for large responses)
const shouldCompress = (req, res) => {
if (req.headers['x-no-compression']) {
  return false;
}
return true;
};

// CORS error handler
const corsErrorHandler = (err, req, res, next) => {
if (err.message === 'CORS error') {
  return res.status(403).json({
    success: false,
    message: 'CORS not allowed for this origin',
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || []
  });
}
next(err);
};

// Body parser error handler
const bodyParserErrorHandler = (err, req, res, next) => {
if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
  return res.status(400).json({
    success: false,
    message: 'Invalid JSON payload'
  });
}
next(err);
};

// XSS protection header
const xssProtection = (req, res, next) => {
res.setHeader('X-XSS-Protection', '1; mode=block');
next();
};

// No cache headers for sensitive routes
const noCache = (req, res, next) => {
res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
res.setHeader('Pragma', 'no-cache');
res.setHeader('Expires', '-1');
next();
};

// Request sanitization (prevent injection attacks)
const sanitizeRequest = (req, res, next) => {
// Sanitize query parameters
if (req.query) {
  Object.keys(req.query).forEach(key => {
    if (typeof req.query[key] === 'string') {
      req.query[key] = req.query[key].replace(/[<>]/g, '');
    }
  });
}

// Sanitize body parameters
if (req.body) {
  Object.keys(req.body).forEach(key => {
    if (typeof req.body[key] === 'string') {
      req.body[key] = req.body[key].replace(/[<>]/g, '');
    }
  });
}

next();
};

module.exports = {
// Error classes
AppError,
ValidationError,
AuthenticationError,
AuthorizationError,
NotFoundError,
ConflictError,

// Middleware
errorHandler,
asyncHandler,
notFound,
rateLimitHandler,
apiVersionHandler,
maintenanceMode,
timeoutHandler,
corsErrorHandler,
bodyParserErrorHandler,
xssProtection,
noCache,
sanitizeRequest,

// Utilities
handleDatabaseError,
setupGlobalErrorHandlers,
sanitizeError,
logError,
setMaintenanceMode,
shouldCompress
};