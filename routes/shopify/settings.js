const express = require('express');
const router = express.Router();
const { ShopModel } = require('../../models/Shop');

// Satıcının API key ve secret eklemesi/güncellemesi
router.post('/update-api', async (req, res) => {
  const { shop, apiKey, apiSecret } = req.body;

  if (!shop || !apiKey || !apiSecret) {
    return res.status(400).json({ success: false, message: 'Tüm alanlar gerekli' });
  }

  try {
    await ShopModel.updateOne(
      { shop },
      { apiKey, apiSecret, updatedAt: new Date() },
      { upsert: true }
    );

    res.json({ success: true, message: 'API bilgileri kaydedildi' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'API bilgileri kaydedilemedi' });
  }
});

// Satıcının mevcut API bilgilerini çekme
router.get('/:shop', async (req, res) => {
  const { shop } = req.params;

  try {
    const shopRecord = await ShopModel.findOne({ shop });
    if (!shopRecord) {
      return res.status(404).json({ success: false, message: 'Mağaza bulunamadı' });
    }

    res.json({
      success: true,
      data: {
        apiKey: shopRecord.apiKey || '',
        apiSecret: shopRecord.apiSecret || ''
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Hata oluştu' });
  }
});

module.exports = router;
