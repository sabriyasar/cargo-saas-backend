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
      return res.status(500).json({ success: false, message: 'SHOPIFY_SHOP veya SHOPIFY_ADMIN_TOKEN .env dosyasında tanımlı değil' });
    }

    const url = `https://${shop}/admin/api/2025-10/orders.json?status=${status}&limit=${limit}`;
    console.log("🛒 Shopify Orders API çağrısı:", url);

    const response = await axios.get(url, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
      },
    });

    res.json({ success: true, data: response.data.orders });
  } catch (err) {
    console.error('❌ Shopify siparişleri alınamadı:', err.response?.data || err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;


/* PUBLIC APP'E GEÇİNCE


const express = require('express');
const router = express.Router();
const { getShopifyOrdersFromAPI } = require('../../services/shopifyService');
const { ShopModel } = require('../../models/Shop');

router.get('/', async (req, res) => {
  const shop = req.query.shop;

  if (!shop) {
    return res.status(400).json({ success: false, message: 'Shop parametre gerekli' });
  }

  const status = req.query.status || 'open';
  const limit = parseInt(req.query.limit) || 20;

  try {
    // 🔹 MongoDB’den mağaza token’ını al
    const shopRecord = await ShopModel.findOne({ shop });
    if (!shopRecord) {
      return res.status(404).json({ success: false, message: 'Mağaza bulunamadı veya token alınmamış' });
    }

    // 🔹 Shopify siparişlerini token ile çek
    const orders = await getShopifyOrdersFromAPI(shop, status, limit, shopRecord.accessToken);

    res.json({ success: true, data: orders });
  } catch (err) {
    console.error('❌ Shopify siparişleri alınamadı:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
 */