// backend/src/config/db.js
const mongoose = require('mongoose');
const chalk = require('chalk');

// Database connection options
const dbOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  autoIndex: true, // Build indexes
  maxPoolSize: 10, // Maintain up to 10 socket connections
  serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
  socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
  family: 4, // Use IPv4, skip trying IPv6
};

// Connection events
const handleConnectionEvents = (connection) => {
  connection.on('connected', () => {
    console.log(chalk.green('✓ MongoDB connected successfully'));
  });

  connection.on('error', (err) => {
    console.error(chalk.red('✗ MongoDB connection error:'), err);
  });

  connection.on('disconnected', () => {
    console.log(chalk.yellow('⚠ MongoDB disconnected'));
  });

  connection.on('reconnected', () => {
    console.log(chalk.green('✓ MongoDB reconnected'));
  });
};

// Connect to database
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharmacy_db';
    
    if (!mongoURI) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    const connection = await mongoose.connect(mongoURI, dbOptions);
    
    handleConnectionEvents(connection.connection);
    
    // Log connection details in development
    if (process.env.NODE_ENV === 'development') {
      console.log(chalk.cyan(`MongoDB Host: ${connection.connection.host}`));
      console.log(chalk.cyan(`MongoDB Database: ${connection.connection.name}`));
    }
    
    return connection;
  } catch (error) {
    console.error(chalk.red('✗ MongoDB connection failed:'), error.message);
    
    // Retry connection after 5 seconds
    console.log(chalk.yellow('Retrying connection in 5 seconds...'));
    setTimeout(connectDB, 5000);
    
    process.exit(1);
  }
};

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log(chalk.yellow('⚠ Received shutdown signal'));
  
  try {
    await mongoose.connection.close();
    console.log(chalk.green('✓ MongoDB connection closed'));
    process.exit(0);
  } catch (error) {
    console.error(chalk.red('✗ Error closing MongoDB connection:'), error);
    process.exit(1);
  }
};

// Handle application termination
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error(chalk.red('Uncaught Exception:'), error);
  gracefulShutdown();
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('Unhandled Rejection at:'), promise);
  console.error(chalk.red('Reason:'), reason);
  gracefulShutdown();
});

// Check database connection health
const checkDatabaseHealth = async () => {
  try {
    await mongoose.connection.db.admin().ping();
    return { status: 'healthy', message: 'Database is responsive' };
  } catch (error) {
    return { status: 'unhealthy', message: error.message };
  }
};

// Get database statistics
const getDatabaseStats = async () => {
  try {
    const stats = await mongoose.connection.db.stats();
    return {
      collections: stats.collections,
      objects: stats.objects,
      avgObjSize: stats.avgObjSize,
      dataSize: stats.dataSize,
      storageSize: stats.storageSize,
      indexes: stats.indexes,
      indexSize: stats.indexSize,
    };
  } catch (error) {
    console.error('Error getting database stats:', error);
    return null;
  }
};

// Backup database (custom function)
const backupDatabase = async () => {
  // This would be implemented with mongodump or similar
  console.log(chalk.yellow('Database backup initiated...'));
  // Implementation depends on your hosting environment
};

module.exports = {
  connectDB,
  checkDatabaseHealth,
  getDatabaseStats,
  backupDatabase,
};