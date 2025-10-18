// models/Shipment.js
const mongoose = require('mongoose');

const ShipmentSchema = new mongoose.Schema({
    return: { type: mongoose.Schema.Types.ObjectId, ref: 'Return' },
    trackingNumber: String,
    courier: String, // Yurtiçi, Aras, MNG vb.
    status: { type: String, enum: ['created', 'in_transit', 'delivered'], default: 'created' },
    labelUrl: String
}, { timestamps: true });

module.exports = mongoose.model('Shipment', ShipmentSchema);
