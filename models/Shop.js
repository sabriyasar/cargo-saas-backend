const mongoose = require('mongoose');

const ShopSchema = new mongoose.Schema({
  shop: { type: String, required: true, unique: true },
  accessToken: { type: String },       // OAuth token
  apiKey: { type: String },            // manuel API key
  apiSecret: { type: String },         // manuel API secret
  scopes: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date },
});

const ShopModel = mongoose.model('Shop', ShopSchema);
module.exports = { ShopModel };
