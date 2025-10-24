const express = require('express');
const router = express.Router();
const crypto = require('crypto');

router.get('/', (req, res) => {
  const shop = req.query.shop;
  if (!shop) {
    return res.status(400).send('Shop parametresi gerekli');
  }

  const apiKey = process.env.SHOPIFY_API_KEY;
  const scopes = 'read_products,write_orders';
  const redirectUri = process.env.SHOPIFY_REDIRECT_URI; // Örn: https://yourapp.com/shopify/callback

  // 🔹 Güvenlik için rastgele state
  const state = crypto.randomBytes(16).toString('hex');

  // 🔹 Eğer istersen bu state'i cookie veya session’da saklayabilirsin
  res.cookie('shopify_oauth_state', state, { httpOnly: true, secure: true });

  const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${apiKey}&scope=${scopes}&redirect_uri=${redirectUri}&state=${state}&grant_options[]=per-user`;

  res.redirect(installUrl);
});

module.exports = router;
