// backend/src/utils/logger.js
const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Create logs directory if it doesn't exist
const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Define console format (more readable for development)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    return log;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    // Write all logs to console
    new winston.transports.Console({
      format: consoleFormat,
      level: 'debug'
    }),
    
    // Write all logs to combined.log
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: logFormat
    }),
    
    // Write error logs to error.log
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: logFormat
    })
  ],
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'exceptions.log'),
      maxsize: 5242880,
      maxFiles: 5
    })
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'rejections.log'),
      maxsize: 5242880,
      maxFiles: 5
    })
  ]
});

// Morgan stream for HTTP request logging
const morganStream = {
  write: (message) => {
    logger.info(message.trim());
  }
};

// Log HTTP request
const logRequest = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      userId: req.user?._id
    };
    
    if (res.statusCode >= 400 && res.statusCode < 500) {
      logger.warn('Client error', logData);
    } else if (res.statusCode >= 500) {
      logger.error('Server error', logData);
    } else {
      logger.info('Request completed', logData);
    }
  });
  
  next();
};

// Log database query (for debugging)
const logQuery = (query, duration) => {
  if (process.env.NODE_ENV === 'development') {
    logger.debug('Database Query', { query, duration: `${duration}ms` });
  }
};

// Log user activity
const logUserActivity = (userId, action, details = {}) => {
  logger.info('User Activity', {
    userId,
    action,
    details,
    timestamp: new Date().toISOString()
  });
};

// Log business events (sales, stock updates, etc.)
const logBusinessEvent = (eventType, data) => {
  logger.info('Business Event', {
    eventType,
    data,
    timestamp: new Date().toISOString()
  });
};

// Log security events (login attempts, permission changes, etc.)
const logSecurityEvent = (eventType, userId, details = {}) => {
  logger.warn('Security Event', {
    eventType,
    userId,
    details,
    timestamp: new Date().toISOString()
  });
};

// Log system events
const logSystemEvent = (eventType, message, details = {}) => {
  logger.info('System Event', {
    eventType,
    message,
    details,
    timestamp: new Date().toISOString()
  });
};

// Performance logging
const logPerformance = (operation, duration, metadata = {}) => {
  logger.debug('Performance Metric', {
    operation,
    duration: `${duration}ms`,
    ...metadata,
    timestamp: new Date().toISOString()
  });
};

// Error logging with context
const logError = (error, context = {}) => {
  logger.error(error.message, {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...context
    },
    timestamp: new Date().toISOString()
  });
};

// Create child logger for modules
const createChildLogger = (moduleName) => {
  return logger.child({ module: moduleName });
};

// Enable/disable logging (useful for tests)
const setLogLevel = (level) => {
  logger.level = level;
  logger.transports.forEach(transport => {
    transport.level = level;
  });
};

// Flush logs (useful before exit)
const flushLogs = () => {
  return new Promise((resolve) => {
    logger.on('finish', resolve);
    logger.end();
  });
};

module.exports = {
  logger,
  morganStream,
  logRequest,
  logQuery,
  logUserActivity,
  logBusinessEvent,
  logSecurityEvent,
  logSystemEvent,
  logPerformance,
  logError,
  createChildLogger,
  setLogLevel,
  flushLogs
};