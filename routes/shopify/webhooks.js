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
  const body = req.rawBody; // ham gövdeyi kullanıyoruz
  const digest = crypto
    .createHmac('sha256', SHOPIFY_SECRET)
    .update(body, 'utf8')
    .digest('base64');

  return digest === hmacHeader;
}

/**
 * Shopify webhook'larının raw body ile gelmesi için özel middleware
 */
router.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf.toString(); // ham body'yi sakla
    },
  })
);

router.post('/orders-create', async (req, res) => {
  try {
    if (!verifyShopifyWebhook(req)) {
      console.error('❌ Shopify webhook doğrulanamadı!');
      return res.status(401).send('Webhook doğrulanamadı');
    }

    const order = req.body;
    const shop = req.headers['x-shopify-shop-domain'];

    if (!shop) return res.status(400).send('Shop header yok');

    const shopRecord = await ShopModel.findOne({ shop });
    if (!shopRecord) return res.status(404).send('Shop bulunamadı');

    // 1️⃣ MNG gönderi oluştur
    const shipmentRes = await createMNGShipment({
      orderId: order.id.toString(),
      courier: 'MNG',
      orderData: order,
    });

    const trackingNumber = shipmentRes?.data?.trackingNumber;

    // 2️⃣ Shopify fulfillment oluştur
    if (shopRecord.accessToken && trackingNumber) {
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
    }

    console.log('✅ Webhook başarıyla işlendi');
    res.status(200).send('Webhook işlendi');
  } catch (err) {
    console.error('❌ Webhook hata:', err);
    res.status(500).send('Hata oluştu');
  }
});

module.exports = router;
