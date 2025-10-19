const express = require('express');
const router = express.Router();
const { getShopifyOrdersFromAPI } = require('../../services/shopifyService');

router.get('/', async (req, res) => {
  const shop = req.query.shop; // örn: myshop.myshopify.com
  if (!shop) return res.status(400).json({ success: false, message: 'Shop parametre gerekli' });

  const status = req.query.status || 'open';
  const limit = parseInt(req.query.limit) || 20;

  try {
    const orders = await getShopifyOrdersFromAPI(shop, status, limit);
    res.json({ success: true, data: orders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
