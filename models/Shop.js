const mongoose = require('mongoose');

const ShopSchema = new mongoose.Schema({
  shop: { type: String, required: true, unique: true },
  accessToken: { type: String, required: true },
  scopes: { type: String },
  createdAt: { type: Date, default: Date.now }
});

const ShopModel = mongoose.model('Shop', ShopSchema);
module.exports = { ShopModel };
