// backend/models/Shop.js
const mongoose = require('mongoose');

const ShopSchema = new mongoose.Schema({
  shop: { type: String, required: true, unique: true },  // Örn: myshop.myshopify.com
  accessToken: { type: String, required: true },
  installedAt: { type: Date, default: Date.now }
});

const ShopModel = mongoose.model('Shop', ShopSchema);

module.exports = { ShopModel };
