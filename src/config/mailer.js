// backend/src/config/mailer.js
const nodemailer = require('nodemailer');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

// Email configuration
const EMAIL_CONFIG = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  from: process.env.EMAIL_FROM || 'noreply@pharmainventory.com',
  fromName: process.env.EMAIL_FROM_NAME || 'PharmaInventory System',
};

// Create transporter
let transporter = null;

const createTransporter = () => {
  if (!EMAIL_CONFIG.auth.user || !EMAIL_CONFIG.auth.pass) {
    console.warn(chalk.yellow('⚠ Email credentials not configured. Email features will be disabled.'));
    return null;
  }
  
  try {
    const transport = nodemailer.createTransport(EMAIL_CONFIG);
    
    // Verify connection
    transport.verify((error, success) => {
      if (error) {
        console.error(chalk.red('✗ Email service connection failed:'), error);
      } else {
        console.log(chalk.green('✓ Email service connected successfully'));
      }
    });
    
    return transport;
  } catch (error) {
    console.error(chalk.red('✗ Failed to create email transporter:'), error);
    return null;
  }
};

// Initialize transporter
const initMailer = () => {
  transporter = createTransporter();
  return transporter;
};

// Send email
const sendEmail = async (options) => {
  if (!transporter) {
    console.warn('Email service not configured. Skipping email send.');
    return { success: false, error: 'Email service not configured' };
  }
  
  try {
    const mailOptions = {
      from: `"${EMAIL_CONFIG.fromName}" <${EMAIL_CONFIG.from}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachments: options.attachments || [],
    };
    
    const info = await transporter.sendMail(mailOptions);
    
    if (process.env.NODE_ENV === 'development') {
      console.log(chalk.cyan(`Email sent: ${info.messageId}`));
    }
    
    return { success: true, info };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
};

// Email templates
const emailTemplates = {
  // Welcome email template
  welcome: (userName, pharmacyName) => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #3B82F6; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; }
          .button { display: inline-block; padding: 10px 20px; background: #3B82F6; color: white; text-decoration: none; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Welcome to PharmaInventory!</h2>
          </div>
          <div class="content">
            <p>Dear ${userName},</p>
            <p>Welcome to ${pharmacyName}! Your account has been successfully created.</p>
            <p>You can now log in to the system using your email and password.</p>
            <p>If you have any questions, please don't hesitate to contact our support team.</p>
            <p>Best regards,<br>The PharmaInventory Team</p>
          </div>
          <div class="footer">
            <p>&copy; 2024 PharmaInventory. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const text = `Welcome to PharmaInventory!\n\nDear ${userName},\n\nWelcome to ${pharmacyName}! Your account has been successfully created.\n\nYou can now log in to the system using your email and password.\n\nBest regards,\nThe PharmaInventory Team`;
    
    return { html, text };
  },
  
  // Password reset email template
  passwordReset: (userName, resetToken, resetUrl) => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #EF4444; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; }
          .button { display: inline-block; padding: 10px 20px; background: #EF4444; color: white; text-decoration: none; border-radius: 5px; }
          .warning { color: #EF4444; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Password Reset Request</h2>
          </div>
          <div class="content">
            <p>Dear ${userName},</p>
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            <p style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </p>
            <p>Or copy and paste this link: ${resetUrl}</p>
            <p>This link will expire in 1 hour.</p>
            <p class="warning">If you didn't request this, please ignore this email.</p>
            <p>Best regards,<br>The PharmaInventory Team</p>
          </div>
          <div class="footer">
            <p>&copy; 2024 PharmaInventory. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const text = `Password Reset Request\n\nDear ${userName},\n\nWe received a request to reset your password. Use this token to reset your password: ${resetToken}\n\nThis token will expire in 1 hour.\n\nIf you didn't request this, please ignore this email.\n\nBest regards,\nThe PharmaInventory Team`;
    
    return { html, text };
  },
  
  // Sale receipt email template
  saleReceipt: (customerName, receiptNumber, items, total, date) => {
    const itemsHtml = items.map(item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.name}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">₦${item.price.toLocaleString()}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">₦${item.total.toLocaleString()}</td>
      </tr>
    `).join('');
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10B981; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .receipt { background: white; padding: 20px; border-radius: 8px; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; }
          table { width: 100%; border-collapse: collapse; }
          th { text-align: left; padding: 8px; background: #f3f4f6; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Your Purchase Receipt</h2>
          </div>
          <div class="content">
            <div class="receipt">
              <p><strong>Receipt #:</strong> ${receiptNumber}</p>
              <p><strong>Date:</strong> ${new Date(date).toLocaleString()}</p>
              <p><strong>Customer:</strong> ${customerName}</p>
              
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th style="text-align: center;">Qty</th>
                    <th style="text-align: right;">Price</th>
                    <th style="text-align: right;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
                <tfoot>
                  <tr>
                    <td colspan="3" style="text-align: right; padding: 8px;"><strong>Total:</strong></td>
                    <td style="text-align: right; padding: 8px;"><strong>₦${total.toLocaleString()}</strong></td>
                  </tr>
                </tfoot>
              </table>
              
              <p style="text-align: center; margin-top: 20px;">Thank you for your purchase!</p>
            </div>
          </div>
          <div class="footer">
            <p>&copy; 2024 PharmaInventory. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    return { html };
  },
  
  // Low stock alert email template
  lowStockAlert: (pharmacyName, lowStockItems) => {
    const itemsHtml = lowStockItems.map(item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.name}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.currentStock}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.reorderLevel}</td>
      </tr>
    `).join('');
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #F59E0B; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .alert { background: #FEF3C7; padding: 15px; border-left: 4px solid #F59E0B; margin-bottom: 20px; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; }
          table { width: 100%; border-collapse: collapse; }
          th { text-align: left; padding: 8px; background: #f3f4f6; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Low Stock Alert</h2>
          </div>
          <div class="content">
            <div class="alert">
              <p><strong>Warning:</strong> Some products are running low on stock!</p>
            </div>
            
            <p>Dear Pharmacy Manager,</p>
            <p>The following products in ${pharmacyName} have fallen below their reorder level:</p>
            
            <table>
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th style="text-align: center;">Current Stock</th>
                  <th style="text-align: center;">Reorder Level</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>
            
            <p style="margin-top: 20px;">Please restock these items as soon as possible.</p>
            <p>Best regards,<br>The PharmaInventory Team</p>
          </div>
          <div class="footer">
            <p>&copy; 2024 PharmaInventory. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    return { html };
  },
  
  // Daily sales report email template
  dailySalesReport: (date, totalSales, transactionCount, topProducts) => {
    const productsHtml = topProducts.map(product => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${product.name}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${product.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">₦${product.revenue.toLocaleString()}</td>
      </tr>
    `).join('');
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #3B82F6; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .stats { display: flex; justify-content: space-around; margin-bottom: 20px; }
          .stat-card { background: white; padding: 15px; border-radius: 8px; text-align: center; flex: 1; margin: 0 5px; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { text-align: left; padding: 8px; background: #f3f4f6; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Daily Sales Report</h2>
            <p>${new Date(date).toLocaleDateString()}</p>
          </div>
          <div class="content">
            <div class="stats">
              <div class="stat-card">
                <h3>Total Sales</h3>
                <p style="font-size: 24px; color: #10B981;">₦${totalSales.toLocaleString()}</p>
              </div>
              <div class="stat-card">
                <h3>Transactions</h3>
                <p style="font-size: 24px; color: #3B82F6;">${transactionCount}</p>
              </div>
              <div class="stat-card">
                <h3>Average Sale</h3>
                <p style="font-size: 24px; color: #8B5CF6;">₦${(totalSales / transactionCount).toLocaleString()}</p>
              </div>
            </div>
            
            <h3>Top Selling Products</h3>
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th style="text-align: center;">Quantity</th>
                  <th style="text-align: right;">Revenue</th>
                </tr>
              </thead>
              <tbody>
                ${productsHtml}
              </tbody>
            </table>
            
            <p style="margin-top: 20px;">View detailed report in your dashboard.</p>
            <p>Best regards,<br>The PharmaInventory Team</p>
          </div>
          <div class="footer">
            <p>&copy; 2024 PharmaInventory. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    return { html };
  },
};

// Send welcome email
const sendWelcomeEmail = async (email, name, pharmacyName) => {
  const { html, text } = emailTemplates.welcome(name, pharmacyName);
  return sendEmail({
    to: email,
    subject: 'Welcome to PharmaInventory!',
    text,
    html,
  });
};

// Send password reset email
const sendPasswordResetEmail = async (email, name, resetToken, resetUrl) => {
  const { html, text } = emailTemplates.passwordReset(name, resetToken, resetUrl);
  return sendEmail({
    to: email,
    subject: 'Password Reset Request',
    text,
    html,
  });
};

// Send receipt email
const sendReceiptEmail = async (email, customerName, receiptNumber, items, total, date) => {
  const { html } = emailTemplates.saleReceipt(customerName, receiptNumber, items, total, date);
  return sendEmail({
    to: email,
    subject: `Your Receipt #${receiptNumber}`,
    html,
  });
};

// Send low stock alert email
const sendLowStockAlert = async (email, pharmacyName, lowStockItems) => {
  const { html } = emailTemplates.lowStockAlert(pharmacyName, lowStockItems);
  return sendEmail({
    to: email,
    subject: 'Low Stock Alert - Action Required',
    html,
  });
};

// Send daily sales report email
const sendDailySalesReport = async (email, date, totalSales, transactionCount, topProducts) => {
  const { html } = emailTemplates.dailySalesReport(date, totalSales, transactionCount, topProducts);
  return sendEmail({
    to: email,
    subject: `Daily Sales Report - ${new Date(date).toLocaleDateString()}`,
    html,
  });
};

// Test email configuration
const testEmailConfig = async () => {
  if (!transporter) {
    console.log(chalk.yellow('Email service not configured'));
    return false;
  }
  
  try {
    await transporter.verify();
    console.log(chalk.green('✓ Email configuration is valid'));
    return true;
  } catch (error) {
    console.error(chalk.red('✗ Email configuration invalid:'), error);
    return false;
  }
};

module.exports = {
  initMailer,
  sendEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendReceiptEmail,
  sendLowStockAlert,
  sendDailySalesReport,
  testEmailConfig,
  emailTemplates,
};