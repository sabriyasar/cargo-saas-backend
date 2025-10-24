require('dotenv').config();
console.log("Mongo URI:", process.env.MONGO_URI);

const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(cookieParser());

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
const MNGreturns = require('./routes/MNGreturns/returns');      // /returns
const MNGshipments = require('./routes/MNGshipments/mng-shipments');  // /shipments
const shopifyOrdersRoute = require('./routes/shopify/shopifyOrders');
const cbsRoute = require('./routes/MNGcbs/cbs');
const shopifySettingsRoute = require('./routes/shopify/settings');
const shopifyWebhooksRoute = require('./routes/shopify/webhooks'); // /shopify/webhooks

app.use('/returns', MNGreturns);
app.use('/shipments', MNGshipments);
app.use('/shopify/orders', shopifyOrdersRoute);
app.use('/cbs', cbsRoute);
app.use('/shopify/settings', shopifySettingsRoute);
app.use('/shopify/webhooks', shopifyWebhooksRoute);


// ✅ Shopify OAuth route'ları
const shopifyAuthRoute = require('./routes/shopify/auth');       // /shopify/auth
const shopifyCallbackRoute = require('./routes/shopify/callback'); // /shopify/callback

app.use('/shopify/auth', shopifyAuthRoute);
app.use('/shopify/callback', shopifyCallbackRoute);

app.listen(PORT, () => {
    console.log(`Server ${PORT} portunda çalışıyor`);
});
