// backend/src/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const { protect, isAdmin, isOwnResource } = require('../middleware/authMiddleware');
const { validateUser, validateId, validatePagination } = require('../middleware/validationMiddleware');
const {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  resetPin,
  getUserActivity,
  toggleUserStatus,
  getPosAgents
} = require('../controllers/userController');

/**
 * @route   GET /api/users
 * @desc    Get all users with pagination
 * @access  Private (Admin only)
 */
router.get('/', protect, isAdmin, validatePagination, getUsers);

/**
 * @route   GET /api/users/agents
 * @desc    Get all POS agents with their sales summary
 * @access  Private (Admin only)
 */
router.get('/agents', protect, isAdmin, getPosAgents);

/**
 * @route   GET /api/users/:id
 * @desc    Get single user by ID
 * @access  Private (Admin only or self)
 */
router.get('/:id', protect, isOwnResource('id'), validateId, getUserById);

/**
 * @route   GET /api/users/:id/activity
 * @desc    Get user activity summary
 * @access  Private (Admin only)
 */
router.get('/:id/activity', protect, isAdmin, validateId, getUserActivity);

/**
 * @route   POST /api/users
 * @desc    Create new user (POS agent or admin)
 * @access  Private (Admin only)
 */
router.post('/', protect, isAdmin, validateUser.create, createUser);

/**
 * @route   PUT /api/users/:id
 * @desc    Update user
 * @access  Private (Admin only)
 */
router.put('/:id', protect, isAdmin, validateId, validateUser.update, updateUser);

/**
 * @route   PUT /api/users/:id/toggle-status
 * @desc    Toggle user active status (activate/deactivate)
 * @access  Private (Admin only)
 */
router.put('/:id/toggle-status', protect, isAdmin, validateId, toggleUserStatus);

/**
 * @route   POST /api/users/:id/reset-pin
 * @desc    Reset user PIN (for POS agents)
 * @access  Private (Admin only)
 */
router.post('/:id/reset-pin', protect, isAdmin, validateId, resetPin);

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete user (soft delete if has transactions)
 * @access  Private (Admin only)
 */
router.delete('/:id', protect, isAdmin, validateId, deleteUser);

/**
 * @route   POST /api/users/:id/change-role
 * @desc    Change user role
 * @access  Private (Admin only)
 */
router.post('/:id/change-role', protect, isAdmin, validateId, async (req, res) => {
  const { role } = req.body;
  const User = require('../models/User');
  
  if (!['admin', 'pos_agent'].includes(role)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid role. Must be admin or pos_agent'
    });
  }
  
  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }
  
  // Prevent changing own role
  if (user._id.toString() === req.user.id) {
    return res.status(400).json({
      success: false,
      message: 'You cannot change your own role'
    });
  }
  
  user.role = role;
  await user.save();
  
  res.status(200).json({
    success: true,
    message: `User role changed to ${role}`,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  });
});

/**
 * @route   POST /api/users/:id/send-welcome
 * @desc    Send welcome email to user
 * @access  Private (Admin only)
 */
router.post('/:id/send-welcome', protect, isAdmin, validateId, async (req, res) => {
  const User = require('../models/User');
  const { sendWelcomeEmail } = require('../config/mailer');
  
  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }
  
  await sendWelcomeEmail(user.email, user.name, 'PharmaInventory');
  
  res.status(200).json({
    success: true,
    message: 'Welcome email sent successfully'
  });
});

/**
 * @route   GET /api/users/export/all
 * @desc    Export all users to CSV
 * @access  Private (Admin only)
 */
router.get('/export/all', protect, isAdmin, async (req, res) => {
  const User = require('../models/User');
  const users = await User.find({}).select('-password -pinCode');
  
  // Create CSV
  const csvHeaders = ['Name', 'Email', 'Phone', 'Role', 'Status', 'Created At', 'Last Login'];
  const csvRows = users.map(user => [
    user.name,
    user.email,
    user.phone || '',
    user.role,
    user.isActive ? 'Active' : 'Inactive',
    user.createdAt.toISOString(),
    user.lastLogin ? user.lastLogin.toISOString() : 'Never'
  ]);
  
  const csv = [csvHeaders, ...csvRows].map(row => row.join(',')).join('\n');
  
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=users_export.csv');
  res.send(csv);
});

module.exports = router;