// routes/shopify/shopifyOrders.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { ShopModel } = require('../../models/Shop');
const { getShopifyOrdersFromAPI } = require('../../services/shopifyService');

router.get('/', async (req, res) => {
  try {
    console.log('[shopifyOrders] incoming request headers:', req.headers);
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      console.warn('[shopifyOrders] Authorization header yok');
      return res.status(401).json({ success: false, message: 'JWT yok' });
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('[shopifyOrders] received token length:', token ? token.length : 0);

    let payload;
    try {
      payload = jwt.decode(token);
      console.log('[shopifyOrders] decoded JWT payload:', payload);
    } catch (err) {
      console.error('[shopifyOrders] jwt.decode hata:', err);
      return res.status(400).json({ success: false, message: 'JWT decode hatası', error: String(err) });
    }

    const maybeShop = payload?.dest || payload?.iss || payload?.shop || payload?.sub;
    if (!maybeShop) {
      console.warn('[shopifyOrders] JWT payload içinde shop bilgisi yok:', Object.keys(payload || {}));
      return res.status(400).json({ success: false, message: 'Shop bilgisi JWT’de yok', payload });
    }

    // normalize shop domain
    const shopDomain = String(maybeShop).replace(/^https?:\/\//, '').replace(/\/$/, '');
    console.log('[shopifyOrders] derived shopDomain:', shopDomain);

    // DB’den access token al
    const shopRecord = await ShopModel.findOne({ shop: shopDomain });
    console.log('[shopifyOrders] shopRecord:', shopRecord ? { shop: shopRecord.shop, hasAccessToken: !!shopRecord.accessToken } : null);

    if (!shopRecord) {
      console.warn(`[shopifyOrders] Mağaza bulunamadı: ${shopDomain}`);
      return res.status(404).json({ success: false, message: 'Mağaza bulunamadı', shop: shopDomain });
    }

    // Shopify siparişlerini çek
    try {
      const orders = await getShopifyOrdersFromAPI(shopRecord.shop, 'open', 50, shopRecord.accessToken);
      console.log(`[shopifyOrders] Shopify'dan ${Array.isArray(orders) ? orders.length : 0} sipariş alındı`);
      return res.json({ success: true, data: orders, shop: shopDomain });
    } catch (err) {
      console.error('[shopifyOrders] getShopifyOrdersFromAPI hata:', err?.response?.data || err?.message || err);
      return res.status(500).json({ success: false, message: 'Shopify siparişleri alınamadı', error: String(err) });
    }
  } catch (err) {
    console.error('[shopifyOrders] Genel hata:', err);
    return res.status(500).json({ success: false, message: err.message || 'Bilinmeyen hata' });
  }
});

module.exports = router;
