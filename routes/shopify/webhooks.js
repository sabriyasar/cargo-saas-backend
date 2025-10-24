const express = require('express');
const router = express.Router();
const { ShopModel } = require('../../models/Shop');
const { createMNGShipment } = require('../../services/shipmentService'); // mevcut kargo servisin
const axios = require('axios');
const crypto = require('crypto');

const SHOPIFY_SECRET = process.env.SHOPIFY_API_SECRET;

function verifyShopifyWebhook(req) {
  const hmac = req.headers['x-shopify-hmac-sha256'];
  const body = JSON.stringify(req.body);
  const hash = crypto
    .createHmac('sha256', SHOPIFY_SECRET)
    .update(body, 'utf8')
    .digest('base64');
  return hash === hmac;
}

router.post('/orders-create', async (req, res) => {
  try {
    if (!verifyShopifyWebhook(req)) return res.status(401).send('Webhook doğrulanamadı');

    const order = req.body;
    const shop = req.headers['x-shopify-shop-domain'];

    if (!shop) return res.status(400).send('Shop header yok');

    const shopRecord = await ShopModel.findOne({ shop });
    if (!shopRecord) return res.status(404).send('Shop bulunamadı');

    // 1️⃣ Kargo oluştur
    const shipmentRes = await createMNGShipment({
      orderId: order.id.toString(),
      courier: 'MNG',
      orderData: order,
    });

    const trackingNumber = shipmentRes.data.trackingNumber;

    // 2️⃣ Shopify Fulfillment oluştur
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
          headers: { 'X-Shopify-Access-Token': shopRecord.accessToken },
        }
      );
    }

    res.status(200).send('Webhook işlendi');
  } catch (err) {
    console.error('Webhook hata:', err);
    res.status(500).send('Hata oluştu');
  }
});

module.exports = router;
