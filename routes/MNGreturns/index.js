const express = require('express');
const router = express.Router();

// Alt rotalar
const returnsRoute = require('./returns');
const checkRoute = require('./MNGRoutes');

// Rotaları bağla
router.use('/', returnsRoute);       // /api/returns
router.use('/check', checkRoute);    // /api/returns/check

module.exports = router;
