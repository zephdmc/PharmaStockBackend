console.log('Checking productController exports...');
try {
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
    } = require('../controllers/productController');
    
    console.log('getProducts:', typeof getProducts);
    console.log('getProductById:', typeof getProductById);
    console.log('createProduct:', typeof createProduct);
    console.log('updateProduct:', typeof updateProduct);
    console.log('deleteProduct:', typeof deleteProduct);
    console.log('searchProducts:', typeof searchProducts);
    console.log('getLowStockProducts:', typeof getLowStockProducts);
    console.log('getExpiringProducts:', typeof getExpiringProducts);
    console.log('updateStock:', typeof updateStock);
    console.log('bulkImportProducts:', typeof bulkImportProducts);
} catch(e) {
    console.error('Error loading productController:', e.message);
}

console.log('\nChecking validateProduct exports...');
try {
    const { validateProduct } = require('../middleware/validationMiddleware');
    console.log('validateProduct.create:', typeof validateProduct?.create);
    console.log('validateProduct.update:', typeof validateProduct?.update);
    console.log('validateProduct.updateStock:', typeof validateProduct?.updateStock);
} catch(e) {
    console.error('Error loading validationMiddleware:', e.message);
}
