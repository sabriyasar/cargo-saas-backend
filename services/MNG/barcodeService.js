// services/MNG/barcodeService.js
const { v4: uuidv4 } = require('uuid');

/**
 * 🔹 Basit barkod üretici
 * @param {string|number} orderId - Shopify order ID
 * @returns {string} benzersiz barkod
 */
function generateBarcode(orderId) {
    // UUID ile benzersiz barkod
    return `BC-${orderId}-${uuidv4().slice(0, 8)}`;
}

module.exports = { generateBarcode };
