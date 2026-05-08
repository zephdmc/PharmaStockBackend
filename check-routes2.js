const path = require('path');
console.log('Current directory:', process.cwd());

console.log('\n=== Checking productController exports ===');
try {
    const controllerPath = path.join(process.cwd(), 'src', 'controllers', 'productController.js');
    console.log('Loading from:', controllerPath);
    const {
        getProducts,
        getProductById,
        createProduct,
        updateProduct,
        deleteProduct,
        searchProducts,
        getLowStockProducts,
        getExpiringProducts,
        updateStock,
        bulkImportProducts
    } = require('./src/controllers/productController');
    
    console.log('? productController loaded successfully');
    console.log('  getProducts:', typeof getProducts);
    console.log('  getProductById:', typeof getProductById);
    console.log('  createProduct:', typeof createProduct);
    console.log('  updateProduct:', typeof updateProduct);
    console.log('  deleteProduct:', typeof deleteProduct);
    console.log('  searchProducts:', typeof searchProducts);
    console.log('  getLowStockProducts:', typeof getLowStockProducts);
    console.log('  getExpiringProducts:', typeof getExpiringProducts);
    console.log('  updateStock:', typeof updateStock);
    console.log('  bulkImportProducts:', typeof bulkImportProducts);
} catch(e) {
    console.error('? Error loading productController:', e.message);
    console.error(e.stack);
}

console.log('\n=== Checking validationMiddleware exports ===');
try {
    const { validateProduct } = require('./src/middleware/validationMiddleware');
    console.log('? validationMiddleware loaded successfully');
    console.log('  validateProduct.create:', typeof validateProduct?.create);
    console.log('  validateProduct.update:', typeof validateProduct?.update);
    console.log('  validateProduct.updateStock:', typeof validateProduct?.updateStock);
} catch(e) {
    console.error('? Error loading validationMiddleware:', e.message);
    console.error(e.stack);
}

console.log('\n=== Checking if all routes are valid ===');
try {
    const productRoutes = require('./src/routes/productRoutes');
    console.log('? productRoutes loaded successfully');
    console.log('  Router is a function:', typeof productRoutes === 'function');
} catch(e) {
    console.error('? Error loading productRoutes:', e.message);
    console.error(e.stack);
}
