// routes/MNGshipments/mng-shipments.js (güncelleme)
const express = require("express");
const router = express.Router();
const Shipment = require("../../models/Shipment");
const { createOrder } = require("../../services/mngService");
const axios = require("axios");
const { ShopModel } = require("../../models/Shop"); // eklendi

/**
 * Shopify siparişine fulfillment update atar (mağaza bazlı token)
 */
async function updateShopifyFulfillment(shop, orderId, trackingNumber, courier) {
  if (!shop) throw new Error("shop parametresi gerekli");
  const shopRecord = await ShopModel.findOne({ shop });
  if (!shopRecord || !shopRecord.accessToken) {
    throw new Error("Mağaza token bulunamadı");
  }
  const accessToken = shopRecord.accessToken;

  try {
    const res = await axios.post(
      `https://${shop}/admin/api/2025-10/orders/${orderId}/fulfillments.json`,
      {
        fulfillment: {
          location_id: Number(process.env.SHOPIFY_LOCATION_ID),
          tracking_number: trackingNumber,
          tracking_company: courier,
          notify_customer: true
        }
      },
      {
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
      }
    );
    console.log("✅ Shopify fulfillment güncellendi:", res.data);
    return res.data;
  } catch (err) {
    console.error("❌ Shopify fulfillment update hatası:", err.response?.data || err.message);
    throw err;
  }
}

/**
 * POST /shipments
 * body: { shop, orderId, courier, isReturn, orderData }
 */
router.post("/", async (req, res) => {
  const { shop, orderId, courier, isReturn, orderData } = req.body;

  if (!shop || !orderId || !courier || !orderData) {
    return res.status(400).json({ message: "shop, orderId, courier ve orderData zorunlu" });
  }

  try {
    // 1️⃣ MNG Barcode Command ile sipariş oluştur
    const shipmentData = await createOrder(orderData);
    console.log("✅ MNG dönen veri:", shipmentData);

    // 2️⃣ MongoDB kaydı
    const shipment = new Shipment({
      orderId: orderId.toString(),
      shop,
      courier,
      trackingNumber: shipmentData.trackingNumber || "",
      labelUrl: shipmentData.labelUrl || shipmentData.returnOrderLabelURL || "",
      status: "created"
    });
    await shipment.save();

    // 3️⃣ Shopify fulfillment update (mağaza token ile)
    if (shipment.trackingNumber) {
      await updateShopifyFulfillment(shop, orderId, shipment.trackingNumber, courier);
    }

    // 4️⃣ Frontend için id ekle
    const shipmentWithId = { ...shipment.toObject(), id: shipment._id.toString() };
    res.json(shipmentWithId);

  } catch (err) {
    console.error("❌ MNG shipment oluşturulamadı:", err.response?.data || err.message);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
