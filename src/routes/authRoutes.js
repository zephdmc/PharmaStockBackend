// backend/src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { protect, optionalAuth, verifyPin, loginRateLimiter, deviceFingerprint } = require('../middleware/authMiddleware');
const { validateUser, validateRequest } = require('../middleware/validationMiddleware');
const {
  login,
  logout,
  verifyPin: verifyPinController,
  changePassword,
  forgotPassword,
  resetPassword,
  getProfile,
  updateProfile,
  refreshToken
} = require('../controllers/authController');

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', loginRateLimiter, deviceFingerprint, login);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', protect, logout);

/**
 * @route   POST /api/auth/verify-pin
 * @desc    Verify user PIN for POS transactions
 * @access  Private
 */
router.post('/verify-pin', protect, validateUser.verifyPin, verifyPinController);

/**
 * @route   POST /api/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.post('/change-password', protect, validateUser.changePassword, changePassword);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset
 * @access  Public
 */
router.post('/forgot-password', validateUser.forgotPassword, forgotPassword);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password with token
 * @access  Public
 */
router.post('/reset-password', validateUser.resetPassword, resetPassword);

/**
 * @route   GET /api/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', protect, getProfile);

/**
 * @route   PUT /api/auth/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile', protect, validateUser.update, updateProfile);

/**
 * @route   POST /api/auth/refresh-token
 * @desc    Refresh JWT token
 * @access  Public
 */
router.post('/refresh-token', refreshToken);

/**
 * @route   POST /api/auth/verify-email
 * @desc    Verify email address
 * @access  Public
 */
router.post('/verify-email', optionalAuth, async (req, res) => {
  // Implementation for email verification
  res.status(200).json({
    success: true,
    message: 'Email verification endpoint'
  });
});

/**
 * @route   POST /api/auth/resend-verification
 * @desc    Resend verification email
 * @access  Private
 */
router.post('/resend-verification', protect, async (req, res) => {
  // Implementation for resending verification email
  res.status(200).json({
    success: true,
    message: 'Verification email resent'
  });
});

module.exports = router;