// backend/src/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  phone: {
    type: String,
    trim: true,
    match: [/^[0-9]{11}$/, 'Please provide a valid phone number']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  pinCode: {
    type: String,
    required: function() {
      return this.role === 'pos_agent';
    },
    select: false,
    validate: {
      validator: function(v) {
        return !v || /^\d{4}$/.test(v);
      },
      message: 'PIN must be 4 digits'
    }
  },
  role: {
    type: String,
    enum: ['admin', 'pos_agent'],
    default: 'pos_agent',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: null
  },
  lastLoginIP: {
    type: String,
    default: null
  },
  passwordResetToken: String,
  passwordResetExpires: Date,
  pinResetToken: String,
  pinResetExpires: Date,
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date,
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  permissions: [{
    type: String,
    enum: ['manage_users', 'manage_products', 'manage_inventory', 'view_reports', 'process_sales']
  }],
  metadata: {
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    },
    createdBy: String,
    notes: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ lastLogin: -1 });

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return this.name;
});

// Virtual for transactions
userSchema.virtual('transactions', {
  ref: 'Transaction',
  localField: '_id',
  foreignField: 'posAgentId',
  justOne: false
});

// Encrypt password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Encrypt PIN before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('pinCode')) return next();
  
  if (this.pinCode) {
    try {
      const salt = await bcrypt.genSalt(10);
      this.pinCode = await bcrypt.hash(this.pinCode, salt);
      next();
    } catch (error) {
      next(error);
    }
  } else {
    next();
  }
});

// Update timestamp on save
userSchema.pre('save', function(next) {
  this.metadata.updatedAt = Date.now();
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Compare PIN method
userSchema.methods.comparePin = async function(candidatePin) {
  if (!this.pinCode) return false;
  return await bcrypt.compare(candidatePin, this.pinCode);
};

// Check if account is locked
userSchema.methods.isLocked = function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

// Increment login attempts
userSchema.methods.incrementLoginAttempts = async function() {
  // Reset attempts if lock has expired
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return await this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 }
    });
  }
  
  // Increment attempts
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Lock account if attempts reached max (5)
  if (this.loginAttempts + 1 >= 5) {
    updates.$set = { lockUntil: Date.now() + 15 * 60 * 1000 }; // Lock for 15 minutes
  }
  
  return await this.updateOne(updates);
};

// Reset login attempts
userSchema.methods.resetLoginAttempts = async function() {
  return await this.updateOne({
    $set: { loginAttempts: 0 },
    $unset: { lockUntil: 1 }
  });
};

// Generate password reset token
userSchema.methods.createPasswordResetToken = function() {
  const crypto = require('crypto');
  const resetToken = crypto.randomBytes(32).toString('hex');
  
  this.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  this.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 1 hour
  
  return resetToken;
};

// Generate PIN reset token
userSchema.methods.createPinResetToken = function() {
  const crypto = require('crypto');
  const resetToken = crypto.randomBytes(16).toString('hex');
  
  this.pinResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  this.pinResetExpires = Date.now() + 60 * 60 * 1000; // 1 hour
  
  return resetToken;
};

// Check if user has permission
userSchema.methods.hasPermission = function(permission) {
  if (this.role === 'admin') return true;
  return this.permissions.includes(permission);
};

// Get user activity summary
userSchema.methods.getActivitySummary = async function() {
  const Transaction = mongoose.model('Transaction');
  const transactions = await Transaction.find({ posAgentId: this._id });
  
  const totalSales = transactions.reduce((sum, t) => sum + t.totalAmount, 0);
  const completedSales = transactions.filter(t => t.status === 'completed').length;
  
  return {
    totalTransactions: transactions.length,
    totalSales,
    averageSale: completedSales > 0 ? totalSales / completedSales : 0,
    completedSales,
    lastLogin: this.lastLogin
  };
};

// Static method to find by email with password
userSchema.statics.findByEmailWithPassword = function(email) {
  return this.findOne({ email }).select('+password');
};

// Static method to find by ID with PIN
userSchema.statics.findByIdWithPin = function(id) {
  return this.findById(id).select('+pinCode');
};

const User = mongoose.model('User', userSchema);

module.exports = User;