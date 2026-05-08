// backend/src/services/receiptService.js
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const PDFDocument = require('pdfkit');

class ReceiptService {
  constructor(pharmacyInfo = null) {
    this.pharmacyInfo = pharmacyInfo || {
      name: 'PHARMA INVENTORY STORE',
      address: '123 Pharmacy Road, Lagos, Nigeria',
      phone: '+234 801 234 5678',
      email: 'info@pharmainventory.com',
      vatNumber: 'VAT-12345678-01',
      rcNumber: 'RC-1234567',
      logo: null
    };
  }

  /**
   * Generate HTML receipt
   * @param {Object} transaction - Transaction object
   * @returns {string} HTML receipt
   */
  generateHTMLReceipt(transaction) {
    const subtotal = transaction.subtotal || transaction.items.reduce((sum, item) => sum + item.totalPrice, 0);
    const vat = transaction.tax || subtotal * 0.075;
    const total = transaction.totalAmount || subtotal + vat;
    
    const itemsHtml = transaction.items.map(item => `
      <div class="receipt-item">
        <div class="item-name">${this.escapeHtml(item.productName)}</div>
        <div class="item-details">
          <span>${item.quantityPacks > 0 ? item.quantityPacks + ' pack(s)' : ''}${item.quantityPacks > 0 && item.quantityUnits > 0 ? ' + ' : ''}${item.quantityUnits > 0 ? item.quantityUnits + ' unit(s)' : ''}</span>
          <span class="item-price">₦${item.totalPrice.toLocaleString()}</span>
        </div>
      </div>
    `).join('');
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Receipt ${transaction.receiptNumber}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Courier New', monospace; 
            font-size: 12px; 
            line-height: 1.4;
            padding: 20px;
            background: #fff;
          }
          .receipt {
            max-width: 300px;
            margin: 0 auto;
            background: white;
          }
          .header {
            text-align: center;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 1px dashed #ccc;
          }
          .pharmacy-name {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 5px;
          }
          .pharmacy-details {
            font-size: 10px;
            color: #666;
            margin-bottom: 5px;
          }
          .receipt-info {
            margin-bottom: 15px;
            font-size: 10px;
          }
          .receipt-info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 3px;
          }
          .items {
            margin-bottom: 15px;
            border-top: 1px dashed #ccc;
            border-bottom: 1px dashed #ccc;
            padding: 10px 0;
          }
          .receipt-item {
            margin-bottom: 8px;
          }
          .item-name {
            font-weight: bold;
            margin-bottom: 2px;
          }
          .item-details {
            display: flex;
            justify-content: space-between;
            font-size: 10px;
            margin-left: 10px;
          }
          .totals {
            margin-bottom: 15px;
            padding-top: 10px;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 5px;
          }
          .grand-total {
            font-weight: bold;
            font-size: 14px;
            margin-top: 5px;
            padding-top: 5px;
            border-top: 1px dashed #ccc;
          }
          .footer {
            text-align: center;
            font-size: 10px;
            padding-top: 10px;
            border-top: 1px dashed #ccc;
          }
          .barcode {
            text-align: center;
            margin: 10px 0;
          }
          @media print {
            body { margin: 0; padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="header">
            <div class="pharmacy-name">${this.escapeHtml(this.pharmacyInfo.name)}</div>
            <div class="pharmacy-details">${this.escapeHtml(this.pharmacyInfo.address)}</div>
            <div class="pharmacy-details">Tel: ${this.pharmacyInfo.phone}</div>
            <div class="pharmacy-details">VAT: ${this.pharmacyInfo.vatNumber}</div>
          </div>
          
          <div class="receipt-info">
            <div class="receipt-info-row">
              <span>Receipt No:</span>
              <span>${transaction.receiptNumber}</span>
            </div>
            <div class="receipt-info-row">
              <span>Date:</span>
              <span>${new Date(transaction.createdAt).toLocaleDateString('en-NG')}</span>
            </div>
            <div class="receipt-info-row">
              <span>Time:</span>
              <span>${new Date(transaction.createdAt).toLocaleTimeString('en-NG')}</span>
            </div>
            <div class="receipt-info-row">
              <span>Cashier:</span>
              <span>${transaction.posAgentId?.name || 'Agent'}</span>
            </div>
          </div>
          
          <div class="items">
            ${itemsHtml}
          </div>
          
          <div class="totals">
            <div class="total-row">
              <span>Subtotal:</span>
              <span>₦${subtotal.toLocaleString()}</span>
            </div>
            <div class="total-row">
              <span>VAT (7.5%):</span>
              <span>₦${vat.toLocaleString()}</span>
            </div>
            ${transaction.discount > 0 ? `
            <div class="total-row">
              <span>Discount:</span>
              <span>-₦${transaction.discount.toLocaleString()}</span>
            </div>
            ` : ''}
            <div class="total-row grand-total">
              <span>TOTAL:</span>
              <span>₦${total.toLocaleString()}</span>
            </div>
          </div>
          
          <div class="footer">
            <div>Payment: ${transaction.paymentMethod.toUpperCase()}</div>
            <div>Thank you for your patronage!</div>
            <div>Goods sold are not returnable</div>
            <div>This is a computer generated receipt</div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate PDF receipt
   * @param {Object} transaction - Transaction object
   * @returns {Promise<Buffer>} PDF buffer
   */
  async generatePDFReceipt(transaction) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: [250, 600], margin: 20 });
        const chunks = [];
        
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
        
        const subtotal = transaction.subtotal || transaction.items.reduce((sum, item) => sum + item.totalPrice, 0);
        const vat = transaction.tax || subtotal * 0.075;
        const total = transaction.totalAmount || subtotal + vat;
        
        // Header
        doc.fontSize(12).font('Helvetica-Bold').text(this.pharmacyInfo.name, { align: 'center' });
        doc.fontSize(8).font('Helvetica').text(this.pharmacyInfo.address, { align: 'center' });
        doc.text(`Tel: ${this.pharmacyInfo.phone}`, { align: 'center' });
        doc.text(`VAT: ${this.pharmacyInfo.vatNumber}`, { align: 'center' });
        doc.moveDown();
        
        // Receipt info
        doc.fontSize(8);
        doc.text(`Receipt No: ${transaction.receiptNumber}`);
        doc.text(`Date: ${new Date(transaction.createdAt).toLocaleDateString('en-NG')}`);
        doc.text(`Time: ${new Date(transaction.createdAt).toLocaleTimeString('en-NG')}`);
        doc.text(`Cashier: ${transaction.posAgentId?.name || 'Agent'}`);
        doc.moveDown();
        
        // Items header
        doc.font('Helvetica-Bold').text('Items', { underline: true });
        doc.font('Helvetica');
        doc.moveDown(0.5);
        
        // Items
        transaction.items.forEach(item => {
          doc.font('Helvetica-Bold').text(item.productName);
          doc.font('Helvetica').fontSize(7);
          const quantityText = `${item.quantityPacks > 0 ? item.quantityPacks + ' pack(s)' : ''}${item.quantityPacks > 0 && item.quantityUnits > 0 ? ' + ' : ''}${item.quantityUnits > 0 ? item.quantityUnits + ' unit(s)' : ''}`;
          doc.text(`  ${quantityText}`, { continued: true });
          doc.text(`₦${item.totalPrice.toLocaleString()}`, { align: 'right' });
          doc.moveDown(0.3);
        });
        
        doc.moveDown();
        doc.fontSize(8);
        
        // Totals
        doc.text(`Subtotal: ₦${subtotal.toLocaleString()}`, { align: 'right' });
        doc.text(`VAT (7.5%): ₦${vat.toLocaleString()}`, { align: 'right' });
        if (transaction.discount > 0) {
          doc.text(`Discount: -₦${transaction.discount.toLocaleString()}`, { align: 'right' });
        }
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold').fontSize(10);
        doc.text(`TOTAL: ₦${total.toLocaleString()}`, { align: 'right' });
        
        doc.moveDown();
        doc.fontSize(8).font('Helvetica');
        doc.text(`Payment: ${transaction.paymentMethod.toUpperCase()}`, { align: 'center' });
        doc.moveDown();
        doc.text('Thank you for your patronage!', { align: 'center' });
        doc.text('Goods sold are not returnable', { align: 'center' });
        doc.text('This is a computer generated receipt', { align: 'center' });
        
        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate QR code for receipt
   * @param {Object} transaction - Transaction object
   * @returns {Promise<string>} QR code as data URL
   */
  async generateReceiptQRCode(transaction) {
    const receiptData = {
      receiptNumber: transaction.receiptNumber,
      transactionId: transaction.transactionId,
      amount: transaction.totalAmount,
      date: transaction.createdAt,
      pharmacy: this.pharmacyInfo.name
    };
    
    const qrData = JSON.stringify(receiptData);
    return await QRCode.toDataURL(qrData);
  }

  /**
   * Generate SMS receipt text
   * @param {Object} transaction - Transaction object
   * @returns {string} SMS text
   */
  generateSMSReceipt(transaction) {
    const subtotal = transaction.subtotal || transaction.items.reduce((sum, item) => sum + item.totalPrice, 0);
    const total = transaction.totalAmount || subtotal + (subtotal * 0.075);
    
    const itemsSummary = transaction.items.slice(0, 2).map(item => 
      `${item.productName}(${item.quantityPacks > 0 ? item.quantityPacks + 'p' : ''}${item.quantityPacks > 0 && item.quantityUnits > 0 ? '+' : ''}${item.quantityUnits > 0 ? item.quantityUnits + 'u' : ''})`
    ).join(', ');
    
    const moreItems = transaction.items.length > 2 ? ` +${transaction.items.length - 2} more` : '';
    
    return `Receipt ${transaction.receiptNumber} | ${this.pharmacyInfo.name} | ${itemsSummary}${moreItems} | Total: ₦${total.toLocaleString()} | Thank you!`;
  }

  /**
   * Generate email receipt HTML
   * @param {Object} transaction - Transaction object
   * @returns {string} Email HTML
   */
  generateEmailReceipt(transaction) {
    const subtotal = transaction.subtotal || transaction.items.reduce((sum, item) => sum + item.totalPrice, 0);
    const vat = transaction.tax || subtotal * 0.075;
    const total = transaction.totalAmount || subtotal + vat;
    
    const itemsHtml = transaction.items.map(item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${this.escapeHtml(item.productName)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantityPacks > 0 ? item.quantityPacks + ' pack(s)' : ''}${item.quantityPacks > 0 && item.quantityUnits > 0 ? ' + ' : ''}${item.quantityUnits > 0 ? item.quantityUnits + ' unit(s)' : ''}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">₦${item.totalPrice.toLocaleString()}</td>
      </tr>
    `).join('');
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10B981; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
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
            <p><strong>Receipt #:</strong> ${transaction.receiptNumber}</p>
            <p><strong>Date:</strong> ${new Date(transaction.createdAt).toLocaleString()}</p>
            <p><strong>Pharmacy:</strong> ${this.pharmacyInfo.name}</p>
            
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th style="text-align: center;">Quantity</th>
                  <th style="text-align: right;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="2" style="text-align: right; padding: 8px;"><strong>Subtotal:</strong></td>
                  <td style="text-align: right; padding: 8px;">₦${subtotal.toLocaleString()}</td>
                </tr>
                <tr>
                  <td colspan="2" style="text-align: right; padding: 8px;"><strong>VAT (7.5%):</strong></td>
                  <td style="text-align: right; padding: 8px;">₦${vat.toLocaleString()}</td>
                </tr>
                <tr style="border-top: 2px solid #000;">
                  <td colspan="2" style="text-align: right; padding: 8px;"><strong>TOTAL:</strong></td>
                  <td style="text-align: right; padding: 8px;"><strong>₦${total.toLocaleString()}</strong></td>
                </tr>
              </tfoot>
            </table>
            
            <p style="text-align: center; margin-top: 20px;">Thank you for your purchase!</p>
          </div>
          <div class="footer">
            <p>${this.pharmacyInfo.address}</p>
            <p>Tel: ${this.pharmacyInfo.phone} | Email: ${this.pharmacyInfo.email}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Escape HTML special characters
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Save receipt to file
   * @param {Object} transaction - Transaction object
   * @param {string} format - 'html' or 'pdf'
   * @returns {Promise<string>} File path
   */
  async saveReceiptToFile(transaction, format = 'html') {
    const receiptsDir = path.join(__dirname, '../../receipts');
    
    if (!fs.existsSync(receiptsDir)) {
      fs.mkdirSync(receiptsDir, { recursive: true });
    }
    
    const filename = `receipt_${transaction.receiptNumber}_${Date.now()}.${format}`;
    const filepath = path.join(receiptsDir, filename);
    
    if (format === 'html') {
      const html = this.generateHTMLReceipt(transaction);
      fs.writeFileSync(filepath, html);
    } else if (format === 'pdf') {
      const pdfBuffer = await this.generatePDFReceipt(transaction);
      fs.writeFileSync(filepath, pdfBuffer);
    }
    
    return filepath;
  }
}

module.exports = ReceiptService;