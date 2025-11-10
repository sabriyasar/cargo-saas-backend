// routes/shopify/shopifyOrders.js
const express = require('express');
const router = express.Router();
const axios = require('axios');

router.get('/', async (req, res) => {
  const status = req.query.status || 'open';
  const limit = parseInt(req.query.limit) || 20;

  try {
    const shop = process.env.SHOPIFY_SHOP;
    const accessToken = process.env.SHOPIFY_ADMIN_TOKEN;

    if (!shop || !accessToken) {
      console.error('❌ Shopify env hatası: SHOPIFY_SHOP veya SHOPIFY_ADMIN_TOKEN yok');
      return res.status(500).json({ success: false, message: 'SHOPIFY_SHOP veya SHOPIFY_ADMIN_TOKEN .env dosyasında tanımlı değil' });
    }

    const url = `https://${shop}/admin/api/2025-10/orders.json?status=${status}&limit=${limit}`;
    console.log("🛒 Shopify Orders API çağrısı:", url);

    const response = await axios.get(url, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
      },
    });

    console.log(`✅ Shopify Orders API başarılı. Sipariş sayısı: ${response.data.orders.length}`);
    res.json({ success: true, data: response.data.orders });
  } catch (err) {
    console.error('❌ Shopify siparişleri alınamadı:', {
      status: err.response?.status,
      data: err.response?.data,
      message: err.message,
    });
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
