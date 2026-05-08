// backend/src/controllers/userController.js
const User = require('../models/User');
const crypto = require('crypto');

// @desc    Get all users
// @route   GET /api/users
// @access  Private (Admin only)
exports.getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const filter = {};
    
    if (req.query.role) {
      filter.role = req.query.role;
    }
    
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === 'true';
    }
    
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    const users = await User.find(filter)
      .select('-password -pinCode')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(filter);

    res.status(200).json({
      success: true,
      users,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching users'
    });
  }
};

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private (Admin only)
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -pinCode')
      .populate('createdBy', 'name email');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user'
    });
  }
};

// @desc    Create new user (POS agent or admin)
// @route   POST /api/users
// @access  Private (Admin only)
exports.createUser = async (req, res) => {
  try {
    const { name, email, phone, password, role, pinCode, permissions } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      phone,
      password,
      role: role || 'pos_agent',
      pinCode: role === 'pos_agent' ? pinCode : undefined,
      permissions: permissions || [],
      createdBy: req.user.id
    });

    // Remove sensitive data
    const userData = {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
      permissions: user.permissions,
      createdAt: user.createdAt
    };

    res.status(201).json({
      success: true,
      user: userData,
      message: 'User created successfully'
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating user'
    });
  }
};

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private (Admin only)
exports.updateUser = async (req, res) => {
  try {
    const { name, email, phone, role, isActive, permissions } = req.body;
    
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent admin from deactivating themselves
    if (user._id.toString() === req.user.id && isActive === false) {
      return res.status(400).json({
        success: false,
        message: 'You cannot deactivate your own account'
      });
    }

    // Update fields
    if (name) user.name = name;
    if (email) user.email = email;
    if (phone) user.phone = phone;
    if (role) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;
    if (permissions) user.permissions = permissions;

    await user.save();

    const userData = {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
      permissions: user.permissions
    };

    res.status(200).json({
      success: true,
      user: userData,
      message: 'User updated successfully'
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating user'
    });
  }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private (Admin only)
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent admin from deleting themselves
    if (user._id.toString() === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account'
      });
    }

    // Check if user has transactions
    const Transaction = require('../models/Transaction');
    const hasTransactions = await Transaction.exists({ posAgentId: user._id });
    
    if (hasTransactions) {
      // Soft delete - just deactivate
      user.isActive = false;
      await user.save();
      
      return res.status(200).json({
        success: true,
        message: 'User deactivated (has transaction history)'
      });
    } else {
      // Hard delete
      await user.remove();
      
      return res.status(200).json({
        success: true,
        message: 'User deleted permanently'
      });
    }
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting user'
    });
  }
};

// @desc    Reset user PIN
// @route   POST /api/users/:id/reset-pin
// @access  Private (Admin only)
exports.resetPin = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.role !== 'pos_agent') {
      return res.status(400).json({
        success: false,
        message: 'PIN reset only applicable for POS agents'
      });
    }

    // Generate new PIN (1234 for demo, should be random in production)
    const newPin = Math.floor(1000 + Math.random() * 9000).toString();
    user.pinCode = newPin;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'PIN reset successfully',
      newPin // In production, send via email/SMS instead of returning
    });
  } catch (error) {
    console.error('Reset PIN error:', error);
    res.status(500).json({
      success: false,
      message: 'Error resetting PIN'
    });
  }
};

// @desc    Get user activity summary
// @route   GET /api/users/:id/activity
// @access  Private (Admin only)
exports.getUserActivity = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const activity = await user.getActivitySummary();

    res.status(200).json({
      success: true,
      activity
    });
  } catch (error) {
    console.error('Get user activity error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user activity'
    });
  }
};

// @desc    Toggle user status (activate/deactivate)
// @route   PUT /api/users/:id/toggle-status
// @access  Private (Admin only)
exports.toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent admin from deactivating themselves
    if (user._id.toString() === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot change your own status'
      });
    }

    user.isActive = !user.isActive;
    await user.save();

    res.status(200).json({
      success: true,
      isActive: user.isActive,
      message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    console.error('Toggle user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error toggling user status'
    });
  }
};

// @desc    Get all POS agents
// @route   GET /api/users/agents
// @access  Private (Admin only)
exports.getPosAgents = async (req, res) => {
  try {
    const agents = await User.find({ role: 'pos_agent' })
      .select('name email phone isActive lastLogin')
      .sort('name');

    // Get sales summary for each agent
    const Transaction = require('../models/Transaction');
    const agentsWithSales = await Promise.all(agents.map(async (agent) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todaySales = await Transaction.aggregate([
        {
          $match: {
            posAgentId: agent._id,
            createdAt: { $gte: today },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$totalAmount' },
            count: { $sum: 1 }
          }
        }
      ]);

      const monthlySales = await Transaction.aggregate([
        {
          $match: {
            posAgentId: agent._id,
            createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$totalAmount' },
            count: { $sum: 1 }
          }
        }
      ]);

      return {
        ...agent.toObject(),
        todaySales: todaySales[0] || { total: 0, count: 0 },
        monthlySales: monthlySales[0] || { total: 0, count: 0 }
      };
    }));

    res.status(200).json({
      success: true,
      agents: agentsWithSales
    });
  } catch (error) {
    console.error('Get POS agents error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching POS agents'
    });
  }
};