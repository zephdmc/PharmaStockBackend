// // backend/src/app.js
// const express = require('express');
// const cors = require('cors');
// const helmet = require('helmet');
// const morgan = require('morgan');
// const rateLimit = require('express-rate-limit');

// const { protect, deviceFingerprint } = require('./middleware/authMiddleware');
// const { errorHandler, notFound, setupGlobalErrorHandlers, maintenanceMode, xssProtection, sanitizeRequest } = require('./middleware/errorHandler');

// const app = express();

// // Setup global error handlers
// setupGlobalErrorHandlers();

// // Security middleware
// app.use(helmet());
// app.use(cors({
//   origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
//   credentials: true
// }));
// app.use(xssProtection());
// app.use(sanitizeRequest());

// // Body parsing middleware
// app.use(express.json({ limit: '10mb' }));
// app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// // Logging middleware
// if (process.env.NODE_ENV === 'development') {
//   app.use(morgan('dev'));
// } else {
//   app.use(morgan('combined'));
// }

// // Rate limiting
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 100, // limit each IP to 100 requests per windowMs
//   handler: (req, res) => {
//     res.status(429).json({
//       success: false,
//       message: 'Too many requests, please try again later.'
//     });
//   }
// });
// app.use('/api', limiter);

// // Device fingerprinting
// app.use(deviceFingerprint);

// // Maintenance mode check
// app.use(maintenanceMode);

// // Routes
// app.use('/api/auth', require('./routes/authRoutes'));
// app.use('/api/products', protect, require('./routes/productRoutes'));
// app.use('/api/sales', protect, require('./routes/salesRoutes'));
// app.use('/api/inventory', protect, require('./routes/inventoryRoutes'));
// app.use('/api/users', protect, require('./routes/userRoutes'));

// // Health check
// app.get('/api/health', (req, res) => {
//   res.status(200).json({
//     success: true,
//     message: 'Server is running',
//     timestamp: new Date()
//   });
// });

// // Error handling middleware (must be last)
// app.use(notFound);
// app.use(errorHandler);

// module.exports = app;
// backend/src/app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit'); // Re-enabled
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const cookieParser = require('cookie-parser');
const path = require('path');

// Import middleware
const { morganStream, logRequest } = require('./utils/logger');
const { protect, deviceFingerprint } = require('./middleware/authMiddleware');
const { errorHandler, notFound, maintenanceMode, xssProtection, sanitizeRequest } = require('./middleware/errorHandler');

// Import routes
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const salesRoutes = require('./routes/salesRoutes');
const reportRoutes = require('./routes/reportRoutes');
const userRoutes = require('./routes/userRoutes');

// Import config
const { RATE_LIMITS, ENVIRONMENTS } = require('./utils/constants');

// Initialize Express app
const app = express();

// Trust proxy (for rate limiting behind reverse proxy)
if (process.env.NODE_ENV === ENVIRONMENTS.PRODUCTION) {
  app.set('trust proxy', 1);
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  }
}));

// CORS configuration
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
};

app.use(cors(corsOptions));

// Compression middleware
app.use(compression());

// Data sanitization against NoSQL injection
app.use(mongoSanitize());

// Data sanitization against XSS
app.use(xss());
app.use(xssProtection);
app.use(sanitizeRequest);

// Logging middleware
app.use(logRequest);
if (process.env.NODE_ENV !== ENVIRONMENTS.TEST) {
  app.use(morgan('combined', { stream: morganStream }));
}

// Device fingerprinting
app.use(deviceFingerprint);

// ========== RATE LIMITING FIX ==========
// High limit for development, lower for production
const generalMax = process.env.NODE_ENV === 'production' ? 100 : 500;
const authMax   = process.env.NODE_ENV === 'production' ? 10  : 50;

// General API limiter (skips auth routes to avoid double‑counting)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: generalMax,
  skip: (req) => req.path.startsWith('/auth'), // don't limit auth endpoints here
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Auth‑specific limiter (more generous, especially in development)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: authMax,
  skipSuccessfulRequests: true, // don't count successful logins
  message: 'Too many login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply auth limiter only to auth routes (placed before general)
app.use('/api/auth', authLimiter);
app.use('/api', generalLimiter);
// ========================================

// Maintenance mode check
app.use(maintenanceMode);

// Static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    uptime: process.uptime()
  });
});

// API version info
app.get('/api/version', (req, res) => {
  res.status(200).json({
    success: true,
    version: require('../../package.json').version,
    name: require('../../package.json').name
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', protect, productRoutes);
app.use('/api/inventory', protect, inventoryRoutes);
app.use('/api/sales', protect, salesRoutes);
app.use('/api/reports', protect, reportRoutes);
app.use('/api/users', protect, userRoutes);

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

module.exports = app;