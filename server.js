require('dotenv').config();

console.log('==================================================');
console.log('SERVER INITIALIZATION STARTING');
console.log('==================================================');
console.log('');

console.log('Environment loaded:');
console.log('  NODE_ENV: ' + process.env.NODE_ENV);
console.log('  PORT: ' + process.env.PORT);
console.log('  JWT_SECRET: ' + (process.env.JWT_SECRET ? 'Set' : 'Missing'));
console.log('  MONGODB_URI: ' + (process.env.MONGODB_URI ? 'Set' : 'Missing'));
console.log('');

console.log('Loading modules with timing...');
console.log('');

const startTime = Date.now();

console.log('1. Loading express...');
const express = require('express');
console.log('   ✓ express loaded (' + (Date.now() - startTime) + 'ms)');

console.log('2. Loading mongoose...');
const mongoose = require('mongoose');
console.log('   ✓ mongoose loaded (' + (Date.now() - startTime) + 'ms)');

console.log('3. Loading chalk...');
const chalk = require('chalk');
console.log('   ✓ chalk loaded (' + (Date.now() - startTime) + 'ms)');

console.log('4. Loading winston...');
const winston = require('winston');
console.log('   ✓ winston loaded (' + (Date.now() - startTime) + 'ms)');

console.log('5. Loading logger module...');
const { logger, logSystemEvent, flushLogs } = require('./src/utils/logger');
console.log('   ✓ logger module loaded (' + (Date.now() - startTime) + 'ms)');

console.log('6. Loading db config...');
const { connectDB } = require('./src/config/db');
console.log('   ✓ db config loaded (' + (Date.now() - startTime) + 'ms)');

console.log('7. Loading constants...');
const { ENVIRONMENTS } = require('./src/utils/constants');
console.log('   ✓ constants loaded (' + (Date.now() - startTime) + 'ms)');

console.log('8. Loading app...');
const app = require('./src/app');
console.log('   ✓ app loaded (' + (Date.now() - startTime) + 'ms)');

console.log('');
console.log('All modules loaded successfully in ' + (Date.now() - startTime) + 'ms');
console.log('');

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('UNCAUGHT EXCEPTION: ' + error.message);
  logger.error('UNCAUGHT EXCEPTION! Shutting down...', { error: error.message, stack: error.stack });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION: ' + reason);
  logger.error('UNHANDLED REJECTION! Shutting down...', { reason });
  process.exit(1);
});

// Start server function
const startServer = async () => {
  console.log('Starting server...');
  try {
    console.log('  Connecting to database...');
    await connectDB();
    console.log('  Database connected');

    const port = process.env.PORT || 5000;
    // ✅ FIX: bind to 0.0.0.0 so Render can route external traffic
    const host = '0.0.0.0';

    console.log('  Starting HTTP server on ' + host + ':' + port + '...');
    const server = app.listen(port, host, () => {
      const environment = process.env.NODE_ENV || ENVIRONMENTS.DEVELOPMENT;
      const serverUrl = 'http://' + host + ':' + port;
      
      console.log('');
      console.log('==================================================');
      console.log(chalk.green('✓ SERVER STARTED SUCCESSFULLY'));
      console.log('==================================================');
      console.log(chalk.cyan('📡 Environment: ' + environment));
      console.log(chalk.cyan('🌐 URL: ' + serverUrl));
      console.log(chalk.cyan('📊 API: ' + serverUrl + '/api'));
      console.log(chalk.cyan('❤️  Health: ' + serverUrl + '/api/health'));
      console.log('==================================================');
      console.log('');
      
      logger.info('Server started on ' + serverUrl);
    });

    return server;
  } catch (error) {
    console.error('Failed to start server: ' + error.message);
    console.error(error.stack);
    process.exit(1);
  }
};

if (require.main === module) {
  console.log('Starting server from main module...');
  startServer();
}

module.exports = { startServer };