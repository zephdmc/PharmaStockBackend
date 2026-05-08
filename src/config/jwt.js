require('dotenv').config();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// JWT configuration
const JWT_CONFIG = {
  secret: process.env.JWT_SECRET,
  expiresIn: process.env.JWT_EXPIRE || '7d',
  refreshExpiresIn: '30d',
  algorithm: 'HS256',
  issuer: 'pharma-inventory-api',
  audience: 'pharma-inventory-client',
};

// Validate JWT secret on startup
if (!JWT_CONFIG.secret || JWT_CONFIG.secret === 'your_super_secret_key_change_this' || JWT_CONFIG.secret === 'your_super_secure_jwt_secret_key_here_change_in_production') {
  console.error('⚠️  WARNING: JWT_SECRET is not set or using default value!');
  console.error('Please set a secure secret in .env file');
  console.error('Generate a secure secret using: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
  
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production environment');
  }
  
  // For development only: generate a temporary secret
  if (process.env.NODE_ENV !== 'production' && !JWT_CONFIG.secret) {
    console.log('Generating temporary development JWT secret...');
    JWT_CONFIG.secret = crypto.randomBytes(32).toString('hex');
  }
}

// Generate access token
const generateToken = (userId, role, expiresIn = JWT_CONFIG.expiresIn) => {
  try {
    const payload = {
      id: userId,
      role: role,
      timestamp: Date.now(),
    };
    
    const token = jwt.sign(payload, JWT_CONFIG.secret, {
      expiresIn,
      algorithm: JWT_CONFIG.algorithm,
      issuer: JWT_CONFIG.issuer,
      audience: JWT_CONFIG.audience,
    });
    
    return token;
  } catch (error) {
    console.error('Error generating token:', error);
    throw new Error('Token generation failed');
  }
};

// Generate refresh token
const generateRefreshToken = (userId) => {
  try {
    const refreshToken = crypto.randomBytes(40).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    
    return {
      token: refreshToken,
      expiresAt,
    };
  } catch (error) {
    console.error('Error generating refresh token:', error);
    throw new Error('Refresh token generation failed');
  }
};

// Verify token
const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_CONFIG.secret, {
      algorithms: [JWT_CONFIG.algorithm],
      issuer: JWT_CONFIG.issuer,
      audience: JWT_CONFIG.audience,
    });
    
    return {
      valid: true,
      decoded,
    };
  } catch (error) {
    let message = 'Invalid token';
    
    if (error.name === 'TokenExpiredError') {
      message = 'Token expired';
    } else if (error.name === 'JsonWebTokenError') {
      message = 'Malformed token';
    }
    
    return {
      valid: false,
      error: message,
    };
  }
};

// Decode token without verification
const decodeToken = (token) => {
  try {
    return jwt.decode(token);
  } catch (error) {
    return null;
  }
};

// Extract token from request header
const extractTokenFromHeader = (authHeader) => {
  if (!authHeader) {
    return null;
  }
  
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  return authHeader;
};

// Blacklist token (for logout)
class TokenBlacklist {
  constructor() {
    this.blacklistedTokens = new Map();
    this.cleanupInterval = setInterval(() => this.cleanup(), 3600000);
  }
  
  addToBlacklist(token, expiresIn) {
    const expiresAt = Date.now() + (expiresIn * 1000);
    this.blacklistedTokens.set(token, expiresAt);
  }
  
  isBlacklisted(token) {
    const expiresAt = this.blacklistedTokens.get(token);
    if (!expiresAt) return false;
    
    if (Date.now() > expiresAt) {
      this.blacklistedTokens.delete(token);
      return false;
    }
    
    return true;
  }
  
  cleanup() {
    const now = Date.now();
    for (const [token, expiresAt] of this.blacklistedTokens.entries()) {
      if (now > expiresAt) {
        this.blacklistedTokens.delete(token);
      }
    }
  }
  
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

const tokenBlacklist = new TokenBlacklist();

// Generate password reset token
const generatePasswordResetToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Generate email verification token
const generateEmailVerificationToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Hash token for storage
const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

// Validate token structure
const isValidTokenFormat = (token) => {
  if (!token || typeof token !== 'string') return false;
  
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  
  const base64Regex = /^[A-Za-z0-9-_]+$/;
  return parts.every(part => base64Regex.test(part));
};

// Get token expiration time
const getTokenExpiration = (token) => {
  try {
    const decoded = decodeToken(token);
    if (decoded && decoded.exp) {
      return new Date(decoded.exp * 1000);
    }
    return null;
  } catch (error) {
    return null;
  }
};

// Check if token is about to expire
const isTokenExpiringSoon = (token) => {
  const expiration = getTokenExpiration(token);
  if (!expiration) return false;
  
  const fiveMinutesFromNow = Date.now() + (5 * 60 * 1000);
  return expiration.getTime() < fiveMinutesFromNow;
};

// Rotate token
const rotateToken = (oldToken) => {
  const decoded = decodeToken(oldToken);
  if (!decoded || !decoded.id) return null;
  
  return generateToken(decoded.id, decoded.role, '1h');
};

module.exports = {
  JWT_CONFIG,
  generateToken,
  generateRefreshToken,
  verifyToken,
  decodeToken,
  extractTokenFromHeader,
  tokenBlacklist,
  generatePasswordResetToken,
  generateEmailVerificationToken,
  hashToken,
  isValidTokenFormat,
  getTokenExpiration,
  isTokenExpiringSoon,
  rotateToken,
};


