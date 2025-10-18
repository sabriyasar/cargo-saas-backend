// backend/routes/shopify/shopifyOrders.js
const express = require('express');
const router = express.Router();
const { getShopifyOrdersFromAPI } = require('../../services/shopifyService');

router.get('/', async (req, res) => {
  try {
    // query ile status ve limit alabiliriz
    const status = req.query.status || 'open';
    const limit = parseInt(req.query.limit) || 20;

    const orders = await getShopifyOrdersFromAPI(status, limit);

    res.json({ success: true, data: orders });
  } catch (err) {
    console.error('Shopify siparişleri alınamadı:', err);
    res.status(500).json({ success: false, message: err.message || 'Shopify siparişleri alınamadı' });
  }
});

module.exports = router;
