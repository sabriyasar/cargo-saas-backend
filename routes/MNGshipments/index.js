const express = require('express');
const router = express.Router();

// Dosya isimleri case-sensitive olmalı
const MNGshipments = require('./MNGshipments'); // MNGshipments.js
const MNGorders = require('./MNGorders');       // MNGorders.js
const shopifyOrders = require('../shopify/shopifyOrders'); // Shopify siparişleri

router.use('/mng', MNGshipments);     // /api/shipments/mng
router.use('/orders', MNGorders);     // /api/shipments/orders
router.use('/shopify', shopifyOrders); // /api/shipments/shopify

module.exports = router;
