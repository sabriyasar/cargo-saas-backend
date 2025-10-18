const express = require('express');
const router = express.Router();
const { getShopifyOrdersFromAPI } = require('../../services/shopifyService');

router.get('/', async (req, res) => {
  try {
    const orders = await getShopifyOrdersFromAPI();
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
