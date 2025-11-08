const express = require("express");
const router = express.Router();
const Shipment = require("../../models/Shipment");
const { createOrder, createBarcode } = require("../../services/mngService");
const axios = require("axios");

/**
 * Shopify siparişine fulfillment update atar
 */
async function updateShopifyFulfillment(orderId, trackingNumber, courier) {
  const accessToken = process.env.ADMIN_API_TOKEN;
  const store = process.env.SHOPIFY_STORE;

  if (!accessToken || !store) {
    throw new Error("Shopify token veya store bilgisi yok!");
  }

  try {
    const res = await axios.post(
      `https://${store}/admin/api/2025-10/orders/${orderId}/fulfillments.json`,
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
 * Yeni MNG shipment oluşturur ve Shopify siparişini update eder
 */
router.post("/", async (req, res) => {
  const { orderId, courier, isReturn, orderData } = req.body;

  if (!orderId || !courier || !orderData) {
    return res.status(400).json({ message: "orderId, courier ve orderData zorunlu" });
  }

  try {
    // 1️⃣ MNG Barcode Command ile sipariş oluştur
    const shipmentData = await createOrder(orderData);
    console.log("✅ MNG dönen veri:", shipmentData);

    // 2️⃣ MongoDB kaydı
    const shipment = new Shipment({
      orderId,
      courier,
      trackingNumber: shipmentData.trackingNumber || "",
      barcode: shipmentData.orderData?.pieces?.[0]?.barcode || "",
      labelUrl: shipmentData.labelUrl || shipmentData.returnOrderLabelURL || "",
      status: "created" // mevcut enum: created, in_transit, delivered
    });
    await shipment.save();

    // 3️⃣ Shopify fulfillment update
    if (shipment.trackingNumber) {
      await updateShopifyFulfillment(orderId, shipment.trackingNumber, courier);
    }

    // 4️⃣ Frontend için id ekle
    const shipmentWithId = { ...shipment.toObject(), id: shipment._id.toString() };
    res.json(shipmentWithId);

  } catch (err) {
    console.error("❌ MNG shipment oluşturulamadı:", err.response?.data || err.message);
    res.status(500).json({ message: err.message });
  }
});

/**
 * GET /shipments
 * orderIds parametresi ile shipment listeleme
 * Örnek: /shipments?orderIds=6041106350268,6041106350269
 */
router.get("/", async (req, res) => {
  try {
    const { orderIds } = req.query;
    if (!orderIds) return res.status(400).json({ message: "orderIds zorunlu" });

    const idsArray = String(orderIds).split(",");
    const shipments = await Shipment.find({ orderId: { $in: idsArray } });

    res.json(shipments.map(s => ({ ...s.toObject(), id: s._id.toString() })));
  } catch (err) {
    console.error("❌ Shipment listesi alınamadı:", err.message);
    res.status(500).json({ message: err.message });
  }
});

router.post("/barcode", async (req, res) => {
  try {
    const { orderData } = req.body;

    if (!orderData || !orderData.referenceId) {
      return res.status(400).json({ message: "orderData.referenceId zorunlu" });
    }

    console.log("🧩 createBarcode test başlatılıyor...", orderData.referenceId);
    const response = await createBarcode(orderData);
    console.log("✅ createBarcode yanıtı:", response);

    res.json(response);
  } catch (err) {
    console.error("❌ createBarcode test hatası:", err.response?.data || err.message);
    res.status(500).json({ error: err.message, detail: err.response?.data });
  }
});

module.exports = router;
