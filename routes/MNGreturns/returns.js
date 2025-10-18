// routes/returns.js
const express = require('express');
const router = express.Router();
const Return = require('../../models/Return');
const Customer = require('../../models/Customer'); // ← ekledik

// 1️⃣ Tüm iade taleplerini listele
router.get('/', async (req, res) => {
    try {
        const returns = await Return.find()
            .populate('order')
            .populate('customer')
            .populate('shipment');
        res.json(returns);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 2️⃣ Yeni iade talebi oluştur
router.post('/', async (req, res) => {
    const { order, customer, reason } = req.body;
  
    if (!order || !reason) return res.status(400).json({ message: 'Order ve reason gerekli' });
  
    let customerId = null;
    if (customer) {
      const customerDoc = await Customer.findOne({ name: customer }); // ya da id kontrolü
      if (customerDoc) customerId = customerDoc._id;
    }
  
    const newReturn = new Return({
      order,
      customer: customerId,
      reason,
      status: 'pending'
    });
  
    try {
      const savedReturn = await newReturn.save();
      res.status(201).json(savedReturn);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  });

// 3️⃣ İade durumu güncelle
router.patch('/:id', async (req, res) => {
    const { status } = req.body;

    if (!status) {
        return res.status(400).json({ message: 'Status gerekli' });
    }

    try {
        const updatedReturn = await Return.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        );
        if (!updatedReturn) return res.status(404).json({ message: 'İade bulunamadı' });
        res.json(updatedReturn);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// 4️⃣ Tek bir iade detayını al
router.get('/:id', async (req, res) => {
    try {
        const singleReturn = await Return.findById(req.params.id)
            .populate('order')
            .populate('customer')
            .populate('shipment');
        if (!singleReturn) return res.status(404).json({ message: 'İade bulunamadı' });
        res.json(singleReturn);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
