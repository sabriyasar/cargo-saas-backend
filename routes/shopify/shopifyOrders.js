// routes/shopifyOrders.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { ShopModel } = require('../../models/Shop');
const { getShopifyOrdersFromAPI } = require('../../services/shopifyService');

router.get('/', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ success: false, message: 'JWT yok' });

    const token = authHeader.replace('Bearer ', '');
    const payload = jwt.decode(token); // Shopify JWT decode
    const shopDomain = payload?.dest || payload?.iss; // shop domain

    if (!shopDomain) return res.status(400).json({ success: false, message: 'Shop bilgisi JWT’de yok' });

    // DB’den access token al
    const shopRecord = await ShopModel.findOne({ shop: shopDomain.replace(/^https?:\/\//, '') });
    if (!shopRecord) return res.status(404).json({ success: false, message: 'Mağaza bulunamadı' });

    // Shopify siparişlerini çek
    const orders = await getShopifyOrdersFromAPI(shopRecord.shop, 'open', 50, shopRecord.accessToken);

    res.json({ success: true, data: orders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
