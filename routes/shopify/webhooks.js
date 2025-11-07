const express = require('express');
const router = express.Router();
const { ShopModel } = require('../../models/Shop');
const { createMNGShipment } = require('../../services/mngService');
const axios = require('axios');
const crypto = require('crypto');

const SHOPIFY_SECRET = process.env.SHOPIFY_API_SECRET;

/**
 * 🔒 Shopify webhook doğrulama - raw body üzerinden
 */
function verifyShopifyWebhook(req) {
  const hmacHeader = req.headers['x-shopify-hmac-sha256'];
  if (!req.rawBody) {
    console.error('❌ req.rawBody undefined! Webhook doğrulaması başarısız.');
    return false;
  }

  const digest = crypto
    .createHmac('sha256', SHOPIFY_SECRET)
    .update(req.rawBody) // Buffer olarak kullanıyoruz
    .digest('base64');

  return digest === hmacHeader;
}

/**
 * Shopify webhook'larının raw body ile gelmesi için özel middleware
 */
router.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf; // Buffer olarak sakla
    },
  })
);

/**
 * 🔹 Shopify "orders/create" webhook
 */
router.post('/orders-create', async (req, res) => {
  console.log('📦 [Webhook] Yeni "orders/create" isteği alındı.');

  try {
    // 1️⃣ Shopify doğrulaması
    if (!verifyShopifyWebhook(req)) {
      console.error('❌ Shopify webhook doğrulanamadı!');
      return res.status(401).send('Webhook doğrulanamadı');
    }
    console.log('✅ Shopify webhook doğrulaması başarılı.');

    const order = req.body;
    const shop = req.headers['x-shopify-shop-domain'];

    if (!shop) {
      console.error('❌ Shopify shop domain header eksik!');
      return res.status(400).send('Shop header yok');
    }
    console.log(`🏪 Shop domain: ${shop}`);
    console.log(`🧾 Order ID: ${order.id}`);

    // 2️⃣ Shop kaydını kontrol et
    const shopRecord = await ShopModel.findOne({ shop });
    if (!shopRecord) {
      console.error(`❌ Shop kaydı bulunamadı: ${shop}`);
      return res.status(404).send('Shop bulunamadı');
    }
    console.log('✅ Shop kaydı bulundu.');

    // 3️⃣ MNG gönderi oluşturma
    console.log('🚚 MNG gönderi oluşturma başlatıldı...');
    const shipmentRes = await createMNGShipment({
      orderId: order.id.toString(),
      courier: 'MNG',
      orderData: order,
    });

    console.log('📦 MNG gönderi yanıtı:', JSON.stringify(shipmentRes.data, null, 2));

    const trackingNumber = shipmentRes?.data?.trackingNumber;
    if (!trackingNumber) {
      console.warn('⚠️ MNG yanıtında trackingNumber bulunamadı!');
    } else {
      console.log(`✅ MNG takip numarası: ${trackingNumber}`);
    }

    // 4️⃣ Shopify fulfillment oluştur
    if (shopRecord.accessToken && trackingNumber) {
      console.log('🔄 Shopify fulfillment oluşturuluyor...');
      await axios.post(
        `https://${shop}/admin/api/2025-10/orders/${order.id}/fulfillments.json`,
        {
          fulfillment: {
            tracking_number: trackingNumber,
            notify_customer: true,
          },
        },
        {
          headers: {
            'X-Shopify-Access-Token': shopRecord.accessToken,
            'Content-Type': 'application/json',
          },
        }
      );
      console.log('✅ Shopify fulfillment başarıyla oluşturuldu.');
    } else {
      console.warn('⚠️ Shopify fulfillment oluşturulmadı — accessToken veya trackingNumber eksik.');
    }

    console.log('🎯 Webhook başarıyla işlendi.');
    res.status(200).send('Webhook işlendi');
  } catch (err) {
    console.error('❌ Webhook hata:', err.response?.data || err.message);
    res.status(500).send('Hata oluştu');
  }
});

module.exports = router;
