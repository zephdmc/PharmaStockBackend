// backend/scripts/seedUsers.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// User model (copy from your User.js or import)
const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  pinCode: String,
  role: String,
  isActive: Boolean,
  createdAt: Date
});

const User = mongoose.model('User', userSchema);

// Connect to database
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pharmacy_db');
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

// Seed users
const seedUsers = async () => {
  try {
    // Clear existing users (optional - be careful!)
    // await User.deleteMany({});
    
    // Create admin user
    const adminPassword = await bcrypt.hash('admin123', 10);
    const adminPin = await bcrypt.hash('1234', 10);
    
    const admin = await User.findOneAndUpdate(
      { email: 'admin@pharmacy.com' },
      {
        name: 'Administrator',
        email: 'admin@pharmacy.com',
        password: adminPassword,
        pinCode: adminPin,
        role: 'admin',
        isActive: true,
        createdAt: new Date()
      },
      { upsert: true, new: true }
    );
    console.log('Admin user created:', admin.email);
    
    // Create POS agent user
    const posPassword = await bcrypt.hash('pos123', 10);
    const posPin = await bcrypt.hash('1234', 10);
    
    const posAgent = await User.findOneAndUpdate(
      { email: 'pos@pharmacy.com' },
      {
        name: 'POS Agent',
        email: 'pos@pharmacy.com',
        password: posPassword,
        pinCode: posPin,
        role: 'pos_agent',
        isActive: true,
        createdAt: new Date()
      },
      { upsert: true, new: true }
    );
    console.log('POS Agent created:', posAgent.email);
    
    // Create additional POS agent
    const posAgent2Password = await bcrypt.hash('pos123', 10);
    const posAgent2Pin = await bcrypt.hash('5678', 10);
    
    const posAgent2 = await User.findOneAndUpdate(
      { email: 'jane@pharmacy.com' },
      {
        name: 'Jane Smith',
        email: 'jane@pharmacy.com',
        password: posAgent2Password,
        pinCode: posAgent2Pin,
        role: 'pos_agent',
        isActive: true,
        createdAt: new Date()
      },
      { upsert: true, new: true }
    );
    console.log('Additional POS Agent created:', posAgent2.email);
    
    console.log('\n✅ Users seeded successfully!');
    console.log('\n📝 Login Credentials:');
    console.log('=====================');
    console.log('Admin:');
    console.log('  Email: admin@pharmacy.com');
    console.log('  Password: admin123');
    console.log('  PIN: 1234');
    console.log('\nPOS Agents:');
    console.log('  Email: pos@pharmacy.com');
    console.log('  Password: pos123');
    console.log('  PIN: 1234');
    console.log('\n  Email: jane@pharmacy.com');
    console.log('  Password: pos123');
    console.log('  PIN: 5678');
    
  } catch (error) {
    console.error('Error seeding users:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
};

// Run the seed
connectDB().then(() => seedUsers());