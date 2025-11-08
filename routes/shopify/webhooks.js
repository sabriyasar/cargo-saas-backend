const express = require("express");
const router = express.Router();
const { ShopModel } = require("../../models/Shop");
const { ShipmentModel } = require("../../models/Shipment"); // opsiyonel DB kaydı
const OrderModel = require("../../models/Order"); // ✅ Order model eklendi
const { createMNGShipment } = require("../../services/mngService");
const { generateBarcode } = require("../../services/MNG/barcodeService"); // ✅ Barkod servisi
const axios = require("axios");
const crypto = require("crypto");

const SHOPIFY_SECRET = process.env.SHOPIFY_API_SECRET;
const HMAC_BYPASS = process.env.HMAC_BYPASS === "true";

/**
 * 🔒 Shopify webhook doğrulama
 */
function verifyShopifyWebhook(req) {
  const hmacHeader = req.headers["x-shopify-hmac-sha256"];

  if (!req.rawBody) {
    console.error("❌ req.rawBody undefined! Webhook doğrulaması başarısız.");
    return false;
  }

  if (HMAC_BYPASS) {
    console.log("⚠️ HMAC bypass aktif — doğrulama atlandı (test modunda).");
    return true;
  }

  try {
    const digest = crypto
      .createHmac("sha256", SHOPIFY_SECRET)
      .update(req.rawBody)
      .digest("base64");

    const valid = digest === hmacHeader;
    if (!valid) console.error("❌ Shopify HMAC doğrulaması başarısız!");
    return valid;
  } catch (err) {
    console.error("❌ Shopify HMAC doğrulama hatası:", err.message);
    return false;
  }
}

/**
 * 🔹 Shopify "orders/create" webhook
 */
router.post("/orders-create", async (req, res) => {
  console.log('📦 [Webhook] Yeni "orders/create" isteği alındı.');

  try {
    // 1️⃣ Shopify doğrulaması
    if (!verifyShopifyWebhook(req)) {
      return res.status(401).send("Webhook doğrulanamadı");
    }
    console.log("✅ Shopify webhook doğrulaması başarılı veya bypass edildi.");

    const order = req.body;
    const shop = req.headers["x-shopify-shop-domain"];

    if (!shop) {
      console.error("❌ Shopify shop domain header eksik!");
      return res.status(400).send("Shop header yok");
    }
    console.log(`🏪 Shop domain: ${shop}`);
    console.log(`🧾 Order ID: ${order.id}`);

    // 2️⃣ Shop kaydını kontrol et
    const shopRecord = await ShopModel.findOne({ shop });
    if (!shopRecord) {
      console.error(`❌ Shop kaydı bulunamadı: ${shop}`);
      return res.status(404).send("Shop bulunamadı");
    }
    console.log("✅ Shop kaydı bulundu.");

    // 3️⃣ Recipient bilgilerini hazırla
    const shipping = order.shipping_address || order.customer?.default_address;

    if (!shipping || !shipping.city || !shipping.province) {
      console.warn(
        "⚠️ Recipient bilgisi eksik — dummy recipient kullanılacak (test)."
      );
      shipping = {
        city: "İSTANBUL",
        province: "KADIKÖY",
        address1: "Test Adresi 1",
        name: "Test Alıcı",
        phone: "5550000000",
        email: "test@example.com",
      };
    }

    // 4️⃣ Barkod üret
    const barcode = generateBarcode(order.id);

    // 5️⃣ MNG gönderi payload
    const orderDataForMNG = {
      referenceId: order.id.toString(),
      barcode, // ✅ Barkod gönderildi
      recipient: {
        cityName: shipping.city,
        districtName: shipping.province,
        address: shipping.address1,
        fullName: shipping.name,
        mobilePhoneNumber: shipping.phone,
        email: shipping.email,
      },
      pieces: order.line_items.map((item) => ({
        description: item.name,
        quantity: item.quantity,
        weight: item.grams ? item.grams / 1000 : 0.5,
      })),
    };

    console.log("🚚 MNG gönderi oluşturma başlatıldı...");
    const shipmentRes = await createMNGShipment(orderDataForMNG);
    console.log("📦 MNG createOrder yanıtı:", shipmentRes);

    const trackingNumber =
      shipmentRes?.trackingNumber || shipmentRes?.data?.trackingNumber;
    if (!trackingNumber) {
      console.error("❌ MNG shipment oluşturulamadı — trackingNumber yok.");
      return res.status(500).send("MNG shipment oluşturulamadı");
    }
    console.log(`✅ MNG takip numarası: ${trackingNumber}`);

    // 6️⃣ Shopify fulfillment oluştur
    if (shopRecord.accessToken) {
      console.log("🔄 Shopify fulfillment oluşturuluyor...");
      await axios.post(
        `https://${shop}/admin/api/2025-10/orders/${order.id}/fulfillments.json`,
        {
          fulfillment: {
            tracking_number: trackingNumber,
            notify_customer: true,
            line_items: order.line_items.map((item) => ({
              id: item.id,
              quantity: item.quantity,
            })),
          },
        },
        {
          headers: {
            "X-Shopify-Access-Token": shopRecord.accessToken,
            "Content-Type": "application/json",
          },
        }
      );
      console.log("✅ Shopify fulfillment başarıyla oluşturuldu.");
    }

    // 7️⃣ DB’ye shipment kaydet
    await ShipmentModel.create({
      orderId: order.id.toString(),
      trackingNumber,
      barcode, // ✅ Barkod kaydedildi
      courier: "MNG",
      shop: shopRecord.shop,
      createdAt: new Date(),
    });

    // 8️⃣ DB’de Order modelini de güncelle (opsiyonel)
    await OrderModel.findOneAndUpdate(
      { orderNumber: order.id.toString() },
      { barcode, trackingNumber, status: "fulfilled" },
      { upsert: true, new: true }
    );

    console.log("🎯 Webhook başarıyla işlendi.");
    res.status(200).send("Webhook işlendi");
  } catch (err) {
    console.error("❌ Webhook hata:", err.response?.data || err.message || err);
    res.status(500).send("Hata oluştu");
  }
});

module.exports = router;
