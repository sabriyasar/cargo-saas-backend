const express = require('express');
const router = express.Router();
const { getShopifyOrdersFromAPI } = require('../../services/shopifyService');
const { ShopModel } = require('../../models/Shop');
const jwt = require('jsonwebtoken');

router.get('/', async (req, res) => {
  let shop = req.query.shop; // Öncelikle query’den alıyoruz

  try {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const payload = jwt.decode(token); // JWT decode

      // Shopify JWT payload’ında shop bilgisi dest veya iss alanında olabilir
      const shopFromJwt = payload?.dest || payload?.iss;
      if (shopFromJwt) {
        shop = shopFromJwt.replace(/^https?:\/\//, '').replace(/\/$/, ''); // https://shop.myshopify.com -> shop.myshopify.com
      }
    }

    if (!shop) {
      return res.status(400).json({ success: false, message: 'Shop parametre gerekli veya JWT geçerli değil' });
    }
  } catch (err) {
    return res.status(400).json({ success: false, message: 'JWT decode hatası', error: err.message });
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
