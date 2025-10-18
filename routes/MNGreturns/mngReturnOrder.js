// routes/MNGreturns/MNGroutes.js
const express = require('express');
const router = express.Router();
const { checkReturnOrder } = require('../../services/mngService'); // require ile

// 🔹 İade kargo sorgulama endpointi
router.post('/check-return-order', async (req, res) => {
  try {
    const criteria = req.body;
    const result = await checkReturnOrder(criteria);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'İade kargo sorgulama başarısız' });
  }
});

module.exports = router;
