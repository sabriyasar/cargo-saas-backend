// models/Customer.js
const mongoose = require('mongoose');

const CustomerSchema = new mongoose.Schema({
    name: String,
    email: String,
    phone: String,
    orders: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }]
}, { timestamps: true });

module.exports = mongoose.model('Customer', CustomerSchema);
