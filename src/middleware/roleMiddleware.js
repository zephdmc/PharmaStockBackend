// backend/src/middleware/roleMiddleware.js

// Check if user has specific role
const hasRole = (roles) => {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Not authenticated'
        });
      }
      
      const userRole = req.user.role;
      const allowedRoles = Array.isArray(roles) ? roles : [roles];
      
      if (allowedRoles.includes(userRole)) {
        return next();
      }
      
      res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${allowedRoles.join(' or ')}`
      });
    };
  };
  
  // Admin only middleware
  const isAdmin = (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }
    
    next();
  };
  
  // POS Agent or Admin middleware
  const isPosAgent = (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }
    
    if (req.user.role !== 'pos_agent' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'POS agent access required'
      });
    }
    
    next();
  };
  
  // Check if user is accessing their own resource
  const isOwnResource = (resourceIdField = 'id') => {
    return (req, res, next) => {
      const resourceUserId = req.params[resourceIdField] || req.body.userId;
      
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Not authenticated'
        });
      }
      
      // Admin can access any resource
      if (req.user.role === 'admin') {
        return next();
      }
      
      // Check if user is accessing their own resource
      if (resourceUserId && resourceUserId === req.user.id) {
        return next();
      }
      
      res.status(403).json({
        success: false,
        message: 'You can only access your own resources'
      });
    };
  };
  
  // Department-based access (for larger organizations)
  const hasDepartment = (departments) => {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Not authenticated'
        });
      }
      
      // Admin has access to all departments
      if (req.user.role === 'admin') {
        return next();
      }
      
      const userDepartment = req.user.department;
      const allowedDepartments = Array.isArray(departments) ? departments : [departments];
      
      if (allowedDepartments.includes(userDepartment)) {
        return next();
      }
      
      res.status(403).json({
        success: false,
        message: `Access denied. Required department: ${allowedDepartments.join(' or ')}`
      });
    };
  };
  
  // Permission-based middleware
  const hasPermission = (permission) => {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Not authenticated'
        });
      }
      
      // Admin has all permissions
      if (req.user.role === 'admin') {
        return next();
      }
      
      if (req.user.permissions && req.user.permissions.includes(permission)) {
        return next();
      }
      
      res.status(403).json({
        success: false,
        message: `You don't have permission: ${permission}`
      });
    };
  };
  
  // Combine multiple role checks
  const hasAnyRole = (...roles) => {
    return hasRole(roles);
  };
  
  const hasAllRoles = (...roles) => {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Not authenticated'
        });
      }
      
      const userRole = req.user.role;
      const allRolesPresent = roles.every(role => userRole === role);
      
      if (allRolesPresent) {
        return next();
      }
      
      res.status(403).json({
        success: false,
        message: `Access denied. Required all roles: ${roles.join(', ')}`
      });
    };
  };
  
  // Middleware to restrict access based on user status
  const requireActiveUser = (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }
    
    if (!req.user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated. Please contact administrator.'
      });
    }
    
    next();
  };
  
  // Restrict access during certain hours (e.g., after business hours)
  const restrictBusinessHours = (startHour = 8, endHour = 20) => {
    return (req, res, next) => {
      const currentHour = new Date().getHours();
      
      // Admin bypasses time restriction
      if (req.user && req.user.role === 'admin') {
        return next();
      }
      
      if (currentHour >= startHour && currentHour < endHour) {
        return next();
      }
      
      res.status(403).json({
        success: false,
        message: `Access restricted to business hours (${startHour}:00 - ${endHour}:00)`
      });
    };
  };
  
  // Rate limiting based on role (different limits for different roles)
  const roleBasedRateLimit = (limits) => {
    return (req, res, next) => {
      const userRole = req.user?.role || 'guest';
      const limit = limits[userRole] || limits.default || 100;
      
      // This would integrate with a rate limiter like express-rate-limit
      // For now, just attach the limit to request
      req.rateLimit = { limit, windowMs: 15 * 60 * 1000 };
      next();
    };
  };
  
  // Log user actions for audit trail
  const auditLog = (action) => {
    return (req, res, next) => {
      const startTime = Date.now();
      
      // Capture response finish event
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        const logEntry = {
          action,
          user: req.user?._id,
          userId: req.user?._id,
          userEmail: req.user?.email,
          userRole: req.user?.role,
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration: `${duration}ms`,
          ip: req.ip,
          userAgent: req.get('user-agent'),
          timestamp: new Date()
        };
        
        // Log to console in development, to file/db in production
        if (process.env.NODE_ENV === 'development') {
          console.log('Audit Log:', logEntry);
        }
        
        // In production, you might want to save to database
        // await AuditLog.create(logEntry);
      });
      
      next();
    };
  };
  
  module.exports = {
    hasRole,
    isAdmin,
    isPosAgent,
    isOwnResource,
    hasDepartment,
    hasPermission,
    hasAnyRole,
    hasAllRoles,
    requireActiveUser,
    restrictBusinessHours,
    roleBasedRateLimit,
    auditLog
  };