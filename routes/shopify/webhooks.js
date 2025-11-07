const express = require('express');
const router = express.Router();
const { ShopModel } = require('../../models/Shop');
const { createMNGShipment } = require('../../services/mngService'); // veya servisinizin wrapper'ı
const axios = require('axios');
const crypto = require('crypto');

const SHOPIFY_SECRET = process.env.SHOPIFY_API_SECRET;
const HMAC_BYPASS = process.env.HMAC_BYPASS === 'true'; // test için true yap
const FORCE_DUMMY_RECIPIENT = process.env.FORCE_DUMMY_RECIPIENT === 'true'; // test için true yap

/**
 * Yardımcı: order içinden mümkünse recipient bilgisi çıkar
 * Öncelik: order.recipient -> order.shipping_address -> order.customer.default_address
 */
function extractRecipientFromOrder(order) {
  if (!order) return null;
  if (order.recipient) return order.recipient;

  const shipping = order.shipping_address || (order.customer && order.customer.default_address) || null;
  if (!shipping) return null;

  return {
    cityName: shipping.city || '',
    districtName: shipping.province || shipping.district || '',
    address: shipping.address1 || shipping.address || '',
    fullName: (shipping.first_name || '') + (shipping.last_name ? ' ' + shipping.last_name : ''),
    mobilePhoneNumber: shipping.phone || order.phone || (order.customer && order.customer.phone) || '',
    email: order.email || (order.customer && order.customer.email) || '',
  };
}

/**
 * Dummy recipient (test) — dilerseniz env üzerinden değiştirin
 */
function dummyRecipient() {
  return {
    cityName: process.env.DUMMY_CITY_NAME || 'İSTANBUL',
    districtName: process.env.DUMMY_DISTRICT_NAME || 'KADIKÖY',
    address: process.env.DUMMY_ADDRESS || 'Test Adresi 1',
    fullName: process.env.DUMMY_FULLNAME || 'Test Alıcı',
    mobilePhoneNumber: process.env.DUMMY_MOBILE || '5550000000',
    email: process.env.DUMMY_EMAIL || 'test@example.com',
  };
}

/**
 * 🔒 Shopify webhook doğrulama - raw body üzerinden
 */
function verifyShopifyWebhook(req) {
  const hmacHeader = req.headers['x-shopify-hmac-sha256'];
  if (!req.rawBody) {
    console.error('❌ req.rawBody undefined! Webhook doğrulaması başarısız.');
    return false;
  }

  if (HMAC_BYPASS) {
    console.log('⚠️ HMAC bypass aktif — doğrulama atlandı (test modunda).');
    return true;
  }

  try {
    const digest = crypto
      .createHmac('sha256', SHOPIFY_SECRET)
      .update(req.rawBody) // Buffer olarak kullanılıyor
      .digest('base64');

    const valid = digest === hmacHeader;
    if (!valid) console.error('❌ Shopify HMAC doğrulaması başarısız!');
    return valid;
  } catch (err) {
    console.error('❌ Shopify HMAC doğrulama hatası:', err && err.message ? err.message : err);
    return false;
  }
}

/**
 * NOT: server.js'de `/shopify/webhooks` route'u için `bodyParser.json({ verify: (req,res,buf)=>req.rawBody=buf })`
 * şeklinde raw body middleware eklenmiş olmalı. Eğer eklenmediyse server.js'i de güncelleyin.
 */

/**
 * 🔹 Shopify "orders/create" webhook
 */
router.post('/orders-create', async (req, res) => {
  console.log('📦 [Webhook] Yeni "orders/create" isteği alındı.');

  try {
    // 1️⃣ Shopify doğrulaması
    if (!verifyShopifyWebhook(req)) {
      console.error('❌ Shopify webhook doğrulanamadı!');
      return res.status(401).send('Webhook doğrulanamadı');
    }
    console.log('✅ Shopify webhook doğrulaması başarılı veya bypass edildi.');

    const order = req.body;
    const shop = req.headers['x-shopify-shop-domain'];

    if (!shop) {
      console.error('❌ Shopify shop domain header eksik!');
      return res.status(400).send('Shop header yok');
    }
    console.log(`🏪 Shop domain: ${shop}`);
    console.log(`🧾 Order ID: ${order && order.id ? order.id : '(yok)'}`);

    // 2️⃣ Shop kaydını kontrol et
    const shopRecord = await ShopModel.findOne({ shop });
    if (!shopRecord) {
      console.error(`❌ Shop kaydı bulunamadı: ${shop}`);
      return res.status(404).send('Shop bulunamadı');
    }
    console.log('✅ Shop kaydı bulundu.');

    // 3️⃣ recipient çıkar / yoksa test modunda dummy ekle
    let recipient = extractRecipientFromOrder(order);
    if (!recipient) {
      if (FORCE_DUMMY_RECIPIENT || HMAC_BYPASS) {
        recipient = dummyRecipient();
        console.log('⚠️ Recipient bilgisi eksikti — dummy recipient kullanılıyor (test).', recipient);
      } else {
        console.error('❌ Recipient cityName veya districtName eksik ve dummy kullanımı kapalı.');
        return res.status(400).send('Recipient bilgisi eksik');
      }
    } else {
      // Log daha temiz: hangi alanlar geldiğini göster
      console.log('📍 Extracted recipient from order:', {
        cityName: recipient.cityName,
        districtName: recipient.districtName,
        address: recipient.address,
        mobilePhoneNumber: recipient.mobilePhoneNumber,
      });
    }

    // 4️⃣ MNG gönderi oluşturma
    console.log('🚚 MNG gönderi oluşturma başlatıldı...');
    const orderDataForMNG = {
      // MNG servisine beklenen shape: recipient + pieces/referenceId vs.
      referenceId: order.id ? order.id.toString() : `order-${Date.now()}`,
      content: `Shopify order ${order.id || 'unknown'}`,
      pieces: [
        {
          barcode: `${order.id || Date.now()}_1`,
          desi: 2,
          kg: 1,
          content: 'Parça 1',
        },
      ],
      recipient: {
        ...recipient,
        // ensure keys expected by mngService are present
        refCustomerId: recipient.refCustomerId || '',
        bussinessPhoneNumber: recipient.bussinessPhoneNumber || '',
        taxOffice: recipient.taxOffice || '',
        taxNumber: recipient.taxNumber || '',
        homePhoneNumber: recipient.homePhoneNumber || '',
      },
    };

    console.log('🚀 createMNGShipment tetikleniyor — orderDataForMNG preview:', {
      referenceId: orderDataForMNG.referenceId,
      cityName: orderDataForMNG.recipient.cityName,
      districtName: orderDataForMNG.recipient.districtName,
      mobile: orderDataForMNG.recipient.mobilePhoneNumber,
    });

    let shipmentRes;
    try {
      shipmentRes = await createMNGShipment({
        orderId: order.id ? order.id.toString() : orderDataForMNG.referenceId,
        courier: 'MNG',
        orderData: orderDataForMNG,
      });
    } catch (mngErr) {
      console.error('❌ createMNGShipment hatası:', mngErr && mngErr.response?.data ? mngErr.response.data : mngErr.message || mngErr);
      // MNG hatası durumunda yine 200 dönmek yerine 500/422 dönebilirsiniz; burada log sonrası hata döndürüyoruz.
      return res.status(500).send('MNG createOrder hatası');
    }

    console.log('📦 MNG yanıtı (kısaltılmış):', shipmentRes && shipmentRes.data ? { trackingNumber: shipmentRes.data.trackingNumber } : shipmentRes);

    const trackingNumber = (shipmentRes && (shipmentRes.trackingNumber || (shipmentRes.data && shipmentRes.data.trackingNumber))) || null;
    if (!trackingNumber) {
      console.warn('⚠️ MNG yanıtında trackingNumber bulunamadı!');
    } else {
      console.log(`✅ MNG takip numarası: ${trackingNumber}`);
    }

    // 5️⃣ Shopify fulfillment oluşturma (varsa store token)
    if (shopRecord.accessToken && trackingNumber) {
      try {
        console.log('🔄 Shopify fulfillment oluşturuluyor...');
        await axios.post(
          `https://${shop}/admin/api/2025-10/orders/${order.id}/fulfillments.json`,
          {
            fulfillment: {
              tracking_number: trackingNumber,
              notify_customer: true,
            },
          },
          {
            headers: {
              'X-Shopify-Access-Token': shopRecord.accessToken,
              'Content-Type': 'application/json',
            },
          }
        );
        console.log('✅ Shopify fulfillment başarıyla oluşturuldu.');
      } catch (shopifyErr) {
        console.error('❌ Shopify fulfillment oluşturma hatası:', shopifyErr.response?.data || shopifyErr.message || shopifyErr);
      }
    } else {
      console.warn('⚠️ Shopify fulfillment oluşturulmadı — accessToken veya trackingNumber eksik.');
    }

    console.log('🎯 Webhook başarıyla işlendi.');
    res.status(200).send('Webhook işlendi');
  } catch (err) {
    console.error('❌ Webhook hata (catch):', err.response?.data || err.message || err);
    res.status(500).send('Hata oluştu');
  }
});

module.exports = router;
