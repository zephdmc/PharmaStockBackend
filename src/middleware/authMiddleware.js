const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { verifyToken, tokenBlacklist } = require('../config/jwt');

// Authenticate user with JWT
const protect = async (req, res, next) => {
  try {
    let token;
    
    // Check for token in headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    // Check if token exists in cookie (alternative)
    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized. No token provided'
      });
    }
    
    // Check if token is blacklisted
    if (tokenBlacklist.isBlacklisted(token)) {
      return res.status(401).json({
        success: false,
        message: 'Token has been revoked. Please login again.'
      });
    }
    
    // Verify token
    const decoded = verifyToken(token);
    
    if (!decoded.valid) {
      if (decoded.error === 'Token expired') {
        return res.status(401).json({
          success: false,
          message: 'Token expired. Please login again.',
          code: 'TOKEN_EXPIRED'
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Please login again.'
      });
    }
    
    // Get user from database
    const user = await User.findById(decoded.decoded.id).select('-password -pinCode');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found. Invalid token.'
      });
    }
    
    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account has been deactivated. Please contact administrator.'
      });
    }
    
    // Attach user to request object
    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during authentication'
    });
  }
};

// Admin authorization middleware
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Access denied. Admin rights required.'
    });
  }
};

// POS Agent authorization middleware
const isPosAgent = (req, res, next) => {
  if (req.user && req.user.role === 'pos_agent') {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Access denied. POS Agent rights required.'
    });
  }
};

// Check if user owns the resource or is admin (parameterized version)
const isOwnResource = (paramName = 'id') => {
  return (req, res, next) => {
    const resourceId = req.params[paramName];
    
    if (!resourceId) {
      return res.status(400).json({
        success: false,
        message: 'Resource ID is required'
      });
    }
    
    // Check if user exists
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    // Admin can access any resource
    if (req.user.role === 'admin') {
      return next();
    }
    
    // Check if the authenticated user owns the resource
    if (req.user._id.toString() === resourceId) {
      return next();
    }
    
    res.status(403).json({
      success: false,
      message: 'Access denied. You can only access your own resources.'
    });
  };
};

// Optional authentication (doesn't require token, but attaches user if exists)
const optionalAuth = async (req, res, next) => {
  try {
    let token;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    if (token && !tokenBlacklist.isBlacklisted(token)) {
      const decoded = verifyToken(token);
      if (decoded.valid) {
        const user = await User.findById(decoded.decoded.id).select('-password -pinCode');
        if (user && user.isActive) {
          req.user = user;
        }
      }
    }
    
    next();
  } catch (error) {
    // Don't fail on optional auth, just proceed without user
    next();
  }
};

// Verify PIN for sensitive operations (with rate limiting)
const verifyPin = async (req, res, next) => {
  try {
    const { pin } = req.body;
    
    if (!pin) {
      return res.status(400).json({
        success: false,
        message: 'PIN is required for this operation'
      });
    }
    
    // Get user with PIN field
    const user = await User.findById(req.user.id).select('+pinCode');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // For POS agents, PIN is required
    if (user.role === 'pos_agent' && !user.pinCode) {
      return res.status(400).json({
        success: false,
        message: 'PIN not set for this user'
      });
    }
    
    // Verify PIN
    const isValidPin = await user.comparePin(pin);
    
    if (!isValidPin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid PIN'
      });
    }
    
    // Attach PIN verified flag
    req.pinVerified = true;
    next();
  } catch (error) {
    console.error('PIN verification middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying PIN'
    });
  }
};

// Optional PIN verification (allows operations without PIN but marks if verified)
const optionalPin = async (req, res, next) => {
  try {
    const { pin } = req.body;
    
    if (pin && req.user) {
      const user = await User.findById(req.user.id).select('+pinCode');
      if (user && await user.comparePin(pin)) {
        req.pinVerified = true;
      }
    }
    
    next();
  } catch (error) {
    // Don't fail on optional PIN, just proceed without verification
    next();
  }
};

// Check if user has specific permissions
const checkPermission = (permission) => {
  return async (req, res, next) => {
    try {
      if (req.user.role === 'admin') {
        return next();
      }
      
      if (req.user.permissions && req.user.permissions.includes(permission)) {
        return next();
      }
      
      res.status(403).json({
        success: false,
        message: 'You dont have permission to perform this action. Required: ' + permission
      });
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({
        success: false,
        message: 'Error checking permissions'
      });
    }
  };
};

// Rate limiter for login attempts (handled in controller but can be middleware)
const loginRateLimiter = async (req, res, next) => {
  const { email } = req.body;
  
  if (!email) {
    return next();
  }
  
  try {
    const user = await User.findOne({ email });
    
    if (user && user.isLocked()) {
      const lockTimeRemaining = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return res.status(401).json({
        success: false,
        message: 'Account is locked. Please try again in ' + lockTimeRemaining + ' minutes'
      });
    }
    
    next();
  } catch (error) {
    next();
  }
};

// Check if token is about to expire (for auto-refresh)
const checkTokenExpiry = async (req, res, next) => {
  try {
    const { token } = req;
    
    if (token) {
      const decoded = jwt.decode(token);
      if (decoded && decoded.exp) {
        const expiryTime = decoded.exp * 1000;
        const currentTime = Date.now();
        const timeUntilExpiry = expiryTime - currentTime;
        
        // If token expires in less than 5 minutes, add flag
        if (timeUntilExpiry < 5 * 60 * 1000 && timeUntilExpiry > 0) {
          req.tokenExpiringSoon = true;
        }
      }
    }
    
    next();
  } catch (error) {
    next();
  }
};

// Device fingerprinting (for security)
const deviceFingerprint = (req, res, next) => {
  req.deviceInfo = {
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
    platform: req.get('sec-ch-ua-platform'),
    mobile: req.get('sec-ch-ua-mobile'),
    timestamp: new Date()
  };
  
  next();
};

module.exports = {
  protect,
  isAdmin,
  isPosAgent,
  isOwnResource,
  optionalAuth,
  verifyPin,
  optionalPin,
  checkPermission,
  loginRateLimiter,
  checkTokenExpiry,
  deviceFingerprint
};
