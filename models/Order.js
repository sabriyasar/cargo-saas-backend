// models/Order.js
const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
    orderNumber: { type: String, required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    items: [
        {
            productId: String,
            productName: String,
            quantity: Number,
            price: Number
        }
    ],
    status: { type: String, enum: ['pending', 'fulfilled', 'cancelled'], default: 'pending' },
    totalAmount: Number
}, { timestamps: true });

module.exports = mongoose.model('Order', OrderSchema);
