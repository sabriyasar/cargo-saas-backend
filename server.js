require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 3003;
const MONGO_URI = process.env.MONGO_URI;

// MongoDB bağlan
mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log("MongoDB bağlandı"))
.catch(err => console.log("MongoDB bağlantı hatası:", err));

// Basit test endpoint
app.get('/', (req, res) => {
    res.send("Return SaaS Backend çalışıyor!");
});

// ✅ Route'ları ekle
const MNGreturns = require('./routes/MNGreturns');      // /returns
const MNGshipments = require('./routes/MNGshipments');  // /shipments
const shopifyOrdersRoute = require('./routes/shopify/shopifyOrders');


app.use('/returns', MNGreturns);
app.use('/shipments', MNGshipments);
app.use('/shopify/orders', shopifyOrdersRoute);

app.listen(PORT, () => {
    console.log(`Server ${PORT} portunda çalışıyor`);
});
