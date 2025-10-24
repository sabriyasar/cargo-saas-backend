// routes/shopify/token.js
const express = require("express");
const router = express.Router();
const axios = require("axios");
const { ShopModel } = require("../../models/Shop");

router.post("/", async (req, res) => {
  const { shop, code } = req.body;

  try {
    const response = await axios.post(`https://${shop}/admin/oauth/access_token`, {
      client_id: process.env.SHOPIFY_API_KEY,
      client_secret: process.env.SHOPIFY_API_SECRET,
      code,
    });

    const accessToken = response.data.access_token;

    await ShopModel.updateOne(
      { shop },
      { shop, accessToken, installedAt: new Date() },
      { upsert: true }
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ success: false });
  }
});

module.exports = router;
