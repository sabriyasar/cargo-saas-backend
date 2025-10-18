const express = require('express');
const router = express.Router();
const { getToken, createReturnOrder } = require('../../services/mngService');
const Shipment = require('../../models/Shipment');

router.post('/', async (req, res) => {
  const { orderId, courier } = req.body;
  try {
    const token = await getToken(); // MNG token
    const shipmentData = await createReturnOrder({ orderId, courier, token });
    
    const shipment = new Shipment({
      orderId,
      courier,
      trackingNumber: shipmentData.orderInvoiceId,
      labelUrl: shipmentData.returnOrderLabelURL,
    });
    await shipment.save();
    res.json(shipment);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
