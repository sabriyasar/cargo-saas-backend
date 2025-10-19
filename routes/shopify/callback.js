const express = require('express');
const router = express.Router();
const axios = require('axios');
const { ShopModel } = require('../../models/Shop');

router.get('/', async (req, res) => {
  const { shop, code, state } = req.query;

  if (state !== 'nonce123') return res.status(403).send('State uyuşmadı');

  const apiKey = process.env.SHOPIFY_API_KEY;
  const apiSecret = process.env.SHOPIFY_API_SECRET;

  try {
    const response = await axios.post(`https://${shop}/admin/oauth/access_token`, {
      client_id: apiKey,
      client_secret: apiSecret,
      code
    });

    const accessToken = response.data.access_token;

    // MongoDB’ye kaydet
    await ShopModel.updateOne(
      { shop },
      { shop, accessToken, installedAt: new Date() },
      { upsert: true }
    );

    res.send('✅ Token alındı ve kaydedildi!');
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).send('❌ Token alınamadı');
  }
});

module.exports = router;
