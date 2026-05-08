// diagnostic.js - Force output to find the issue
const fs = require('fs');

// Override console to ensure output
const originalLog = console.log;
const originalError = console.error;

console.log = function(...args) {
    originalLog('[LOG]', new Date().toISOString(), ...args);
};

console.error = function(...args) {
    originalError('[ERR]', new Date().toISOString(), ...args);
};

console.log('=== DIAGNOSTIC START ===');
console.log('Current directory:', process.cwd());
console.log('Node version:', process.version);
console.log('Platform:', process.platform);

// Test file exists
console.log('Checking server.js exists:', fs.existsSync('./server.js'));
console.log('Checking .env exists:', fs.existsSync('./.env'));

// Read and show .env (without values)
if (fs.existsSync('./.env')) {
    const envContent = fs.readFileSync('./.env', 'utf8');
    console.log('.env lines:', envContent.split('\n').length);
    const envLines = envContent.split('\n');
    envLines.forEach(line => {
        if (line.trim() && !line.startsWith('#')) {
            const key = line.split('=')[0];
            console.log('  ENV:', key, '=', key === 'JWT_SECRET' ? '***HIDDEN***' : 'set');
        }
    });
}

console.log('Loading dotenv...');
try {
    require('dotenv').config();
    console.log('? dotenv loaded');
    console.log('  JWT_SECRET exists:', !!process.env.JWT_SECRET);
    console.log('  NODE_ENV:', process.env.NODE_ENV);
} catch(e) {
    console.error('? dotenv error:', e.message);
    process.exit(1);
}

console.log('Loading app module...');
try {
    const app = require('./src/app');
    console.log('? app loaded');
    console.log('  App type:', typeof app);
    console.log('  App has listen:', typeof app.listen === 'function');
} catch(e) {
    console.error('? App load error:', e.message);
    console.error(e.stack);
    process.exit(1);
}

console.log('Loading db config...');
try {
    const { connectDB } = require('./src/config/db');
    console.log('? db config loaded');
} catch(e) {
    console.error('? DB config error:', e.message);
    process.exit(1);
}

console.log('Loading logger...');
try {
    const { logger } = require('./src/utils/logger');
    console.log('? logger loaded');
} catch(e) {
    console.error('? Logger error:', e.message);
    console.error(e.stack);
    process.exit(1);
}

console.log('=== DIAGNOSTIC COMPLETE ===');
console.log('All modules loaded successfully!');

// Now try to start the server
console.log('\nAttempting to start server...');
try {
    require('./server.js');
} catch(e) {
    console.error('Server start error:', e.message);
    console.error(e.stack);
}
