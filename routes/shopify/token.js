// routes/shopify/token.js
const express = require("express");
const router = express.Router();
const axios = require("axios");
const { ShopModel } = require("../../models/Shop");

router.post("/", async (req, res) => {
  let { shop, code } = req.body;

  console.log("🔹 /shopify/token isteği alındı:", { shop, code });

  try {
    if (!shop || !code) {
      console.warn("⚠️ Eksik parametre:", { shop, code });
      return res.status(400).json({ success: false, message: "Eksik parametre (shop veya code)" });
    }

    // 🔧 shop değerini normalize et (örneğin sondaki '/' karakterini kaldır)
    shop = shop.replace(/\/$/, "");

    const tokenUrl = `https://${shop}/admin/oauth/access_token`;
    console.log("🌐 Shopify token URL:", tokenUrl);

    // Shopify'a token isteği gönder
    const response = await axios.post(tokenUrl, {
      client_id: process.env.SHOPIFY_API_KEY,
      client_secret: process.env.SHOPIFY_API_SECRET,
      code,
    });

    console.log("✅ Shopify token yanıtı:", response.data);

    const accessToken = response.data.access_token;

    if (!accessToken) {
      console.error("❌ Erişim tokenı alınamadı!");
      return res.status(500).json({ success: false, message: "Token alınamadı" });
    }

    // 🔹 MongoDB'ye kaydet veya güncelle
    await ShopModel.updateOne(
      { shop },
      { shop, accessToken, installedAt: new Date() },
      { upsert: true }
    );

    console.log(`💾 ${shop} için accessToken başarıyla kaydedildi.`);

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Shopify token alma hatası:");
    console.error("Hata detayı:", err.response?.data || err.message);

    res.status(500).json({
      success: false,
      message: err.response?.data?.error_description || err.message || "Token isteği başarısız",
    });
  }
});

module.exports = router;
