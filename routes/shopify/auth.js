const express = require('express');
const router = express.Router();

// auth.js
router.get('/', (req, res) => {
    const shop = req.query.shop;
    const apiKey = process.env.SHOPIFY_API_KEY;
    const scopes = 'read_products,write_orders';
    const redirectUri = process.env.SHOPIFY_REDIRECT_URI; // http://localhost:3003/shopify/callback
    const state = 'nonce123';
  
    const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${apiKey}&scope=${scopes}&redirect_uri=${redirectUri}&state=${state}&grant_options[]=per-user`;
    res.redirect(installUrl);
  });
  

module.exports = router;
