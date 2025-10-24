const express = require('express');
const router = express.Router();
const { ShopModel } = require('../../models/Shop');

// 🔹 Aktif Shopify mağazalarını listele
router.get('/list', async (req, res) => {
  try {
    // MongoDB'den shop alanını ve tarihleri alıyoruz
    const shops = await ShopModel.find({}, { shop: 1, createdAt: 1, updatedAt: 1 }).sort({ createdAt: -1 });
    
    res.json({ success: true, data: shops });
  } catch (err) {
    console.error('Shop list fetch hatası:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
