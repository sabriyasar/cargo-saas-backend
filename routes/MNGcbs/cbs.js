const express = require('express');
const router = express.Router();
const { getAllCities } = require('../../services/mngLocationService'); // servis yolunu kontrol et
const axios = require('axios');

const BASE_URL = "https://api.mngkargo.com.tr/mngapi/api";
const DEFAULT_API_VERSION = process.env.MNG_API_VERSION || "1.0";

// 🔹 Tüm şehirleri al
router.get('/cities', async (req, res) => {
  try {
    const cities = await getAllCities();
    res.json(cities);
  } catch (err) {
    console.error('Şehirler alınamadı:', err);
    res.status(500).json({ error: 'Şehirler alınamadı' });
  }
});

// 🔹 Belirli bir cityCode ile ilçeleri al
router.get('/districts/:cityCode', async (req, res) => {
  const { cityCode } = req.params;
  try {
    const cities = await getAllCities();
    const city = cities.find(c => c.code === cityCode);
    if (!city) return res.status(404).json({ error: `Şehir bulunamadı: ${cityCode}` });

    // MNG API'den ilçeleri al
    const response = await axios.get(`${BASE_URL}/cbsinfoapi/getdistricts/${city.code}`, {
      headers: {
        "X-IBM-Client-Id": process.env.MNG_CBS_CLIENT_ID,
        "X-IBM-Client-Secret": process.env.MNG_CBS_CLIENT_SECRET,
        "x-api-version": DEFAULT_API_VERSION,
        Accept: "application/json",
      },
    });

    const districts = response.data || [];
    res.json(districts);
  } catch (err) {
    console.error('İlçeler alınamadı:', err);
    res.status(500).json({ error: 'İlçeler alınamadı' });
  }
});

module.exports = router;
