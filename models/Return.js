const mongoose = require('mongoose');
const Order = require('./Order');
const Customer = require('./Customer'); // ← Bunu ekle

const ReturnSchema = new mongoose.Schema({
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    reason: { type: String, required: true },
    status: { type: String, enum: ['pending', 'shipped', 'completed'], default: 'pending' },
    shipment: { type: mongoose.Schema.Types.ObjectId, ref: 'Shipment' }
}, { timestamps: true });

module.exports = mongoose.model('Return', ReturnSchema);
