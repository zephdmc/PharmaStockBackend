// backend/src/routes/productRoutes.js
const express = require('express');
const router = express.Router();
const { protect, isAdmin } = require('../middleware/authMiddleware');
const { validateProduct, validateId } = require('../middleware/validationMiddleware');
const productController = require('../controllers/productController');

// ==================== PRODUCT ROUTES ====================

// @route   GET /api/products
// @desc    Get all products
// @access  Private
router.get('/', protect, productController.getProducts);

// @route   GET /api/products/search
// @desc    Search products
// @access  Private
router.get('/search', protect, productController.searchProducts);

// @route   GET /api/products/low-stock
// @desc    Get low stock products
// @access  Private
router.get('/low-stock', protect, productController.getLowStockProducts);

// @route   GET /api/products/expiring
// @desc    Get expiring products
// @access  Private
router.get('/expiring', protect, productController.getExpiringProducts);

// @route   GET /api/products/categories
// @desc    Get all categories
// @access  Private
router.get('/categories', protect, productController.getCategories);

// @route   POST /api/products/categories
// @desc    Create new category
// @access  Private (Admin only)
router.post('/categories', protect, isAdmin, productController.createCategory);

// @route   PUT /api/products/categories/:id
// @desc    Update category
// @access  Private (Admin only)
router.put('/categories/:id', protect, isAdmin, productController.updateCategory);

// @route   DELETE /api/products/categories/:id
// @desc    Delete category
// @access  Private (Admin only)
router.delete('/categories/:id', protect, isAdmin, productController.deleteCategory);

// @route   GET /api/products/:id
// @desc    Get single product (MUST be after specific routes like /categories)
// @access  Private
router.get('/:id', protect, validateId, productController.getProductById);

// @route   POST /api/products
// @desc    Create new product
// @access  Private (Admin only)
router.post('/', protect, isAdmin, validateProduct.create, productController.createProduct);

// @route   POST /api/products/bulk-import
// @desc    Bulk import products
// @access  Private (Admin only)
router.post('/bulk-import', protect, isAdmin, productController.bulkImportProducts);

// @route   PUT /api/products/:id
// @desc    Update product
// @access  Private (Admin only)
router.put('/:id', protect, isAdmin, validateId, validateProduct.update, productController.updateProduct);

// @route   PUT /api/products/:id/stock
// @desc    Update product stock
// @access  Private (Admin only)
router.put('/:id/stock', protect, isAdmin, validateId, productController.updateStock);

// @route   DELETE /api/products/:id
// @desc    Delete product
// @access  Private (Admin only)
router.delete('/:id', protect, isAdmin, validateId, productController.deleteProduct);

// @route   GET /api/products/export/data
// @desc    Export products
// @access  Private (Admin only)
router.get('/export/data', protect, isAdmin, (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Export endpoint - to be implemented'
  });
});

module.exports = router;