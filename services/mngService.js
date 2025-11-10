const axios = require("axios");
const NodeCache = require("node-cache");

const BASE_URL = "https://api.mngkargo.com.tr/mngapi/api";
const DEFAULT_API_VERSION = process.env.MNG_API_VERSION || "1.0";

let identityTokenCache = null;
const cbsCache = new NodeCache({ stdTTL: 86400, checkperiod: 3600 });

function normalize(str) {
  return str
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

async function findCityAndDistrictCodes(cityName, districtName) {
  const cacheKey = `${cityName.toLowerCase()}_${districtName.toLowerCase()}`;
  const cached = cbsCache.get(cacheKey);
  if (cached) return cached;

  const headers = {
    "X-IBM-Client-Id": process.env.MNG_CBS_CLIENT_ID,
    "X-IBM-Client-Secret": process.env.MNG_CBS_CLIENT_SECRET,
    "x-api-version": DEFAULT_API_VERSION,
    Accept: "application/json",
  };

  const citiesRes = await axios.get(`${BASE_URL}/cbsinfoapi/getcities`, { headers });
  const cities = citiesRes.data || [];
  const city = cities.find((c) => normalize(c.name) === normalize(cityName));
  if (!city) throw new Error(`Şehir bulunamadı: ${cityName}`);

  const districtsRes = await axios.get(`${BASE_URL}/cbsinfoapi/getdistricts/${city.code}`, { headers });
  const district = (districtsRes.data || []).find((d) => normalize(d.name) === normalize(districtName));
  if (!district) throw new Error(`İlçe bulunamadı: ${districtName}`);

  const result = { cityCode: city.code, districtCode: district.code };
  cbsCache.set(cacheKey, result);
  return result;
}

async function getIdentityToken() {
  if (process.env.MNG_ORDER_JWT) {
    console.log("🔑 Statik MNG_ORDER_JWT kullanılıyor.");
    return process.env.MNG_ORDER_JWT;
  }

  if (identityTokenCache && new Date() < identityTokenCache.expireDate) {
    console.log("♻️ Cached MNG token kullanılıyor.");
    return identityTokenCache.token;
  }

  console.log("🔐 Yeni MNG identity token alınıyor...");
  const response = await axios.post(
    `${BASE_URL}/token`,
    {
      CustomerNumber: process.env.MNG_CUSTOMER_NUMBER,
      Password: process.env.MNG_PASSWORD,
      IdentityType: process.env.MNG_IDENTITY_TYPE || 1,
    },
    {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-IBM-Client-Id": process.env.MNG_CLIENT_ID,
        "X-IBM-Client-Secret": process.env.MNG_CLIENT_SECRET,
        "x-api-version": DEFAULT_API_VERSION,
      },
    }
  );

  const { jwt, jwtExpireDate } = response.data;
  if (!jwt || !jwtExpireDate) throw new Error("MNG Identity Token eksik!");

  console.log("✅ MNG identity token başarıyla alındı.");
  identityTokenCache = { token: jwt, expireDate: new Date(jwtExpireDate) };
  return jwt;
}

// Opsiyonel, gerektiğinde kullan
async function createOrder(orderData) {
  console.log("📦 MNG createOrder() başladı:", orderData.referenceId);
  const identityToken = await getIdentityToken();
  const referenceId = orderData.referenceId || orderData._id || orderData.orderId?.toString();

  let cityCode, districtCode;
  if (!orderData.recipient?.customerId) {
    if (!orderData.recipient?.cityName || !orderData.recipient?.districtName) {
      throw new Error("Recipient cityName veya districtName eksik.");
    }
    const codes = await findCityAndDistrictCodes(orderData.recipient.cityName, orderData.recipient.districtName);
    cityCode = codes.cityCode;
    districtCode = codes.districtCode;
  }

  const recipient = orderData.recipient?.customerId
    ? { customerId: orderData.recipient.customerId, refCustomerId: orderData.recipient.refCustomerId || "" }
    : {
        cityCode,
        districtCode,
        cityName: orderData.recipient.cityName,
        districtName: orderData.recipient.districtName,
        address: orderData.recipient.address || "",
        email: orderData.recipient.email || "",
        fullName: orderData.recipient.fullName || "",
        mobilePhoneNumber: orderData.recipient.mobilePhoneNumber || "",
      };

  const apiBody = {
    order: {
      referenceId,
      barcode: referenceId,
      billOfLandingId: orderData.billOfLandingId || "İrsaliye 1",
      isCOD: orderData.isCOD || 0,
      codAmount: orderData.codAmount || 0,
      shipmentServiceType: 1,
      packagingType: orderData.packagingType || 1,
      content: orderData.content || "İçerik 1",
      paymentType: 1,
      deliveryType: 1,
      description: orderData.message || orderData.content || `Sipariş ${referenceId}`,
      marketPlaceShortCode: orderData.marketPlaceShortCode ?? "",
    },
    orderPieceList: orderData.pieces?.map((p, i) => ({
      barcode: `${referenceId}_PARCA${i + 1}`,
      desi: p.desi || 2,
      kg: p.kg || 1,
      content: p.content || "Parça açıklama",
    })) || [
      { barcode: `${referenceId}_PARCA1`, desi: 2, kg: 1, content: "Varsayılan Paket" },
    ],
    recipient,
  };

  try {
    const response = await axios.post(`${BASE_URL}/standardcmdapi/createOrder`, apiBody, {
      headers: {
        Authorization: `Bearer ${identityToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-IBM-Client-Id": process.env.MNG_CREATE_ORDER_CLIENT_ID,
        "X-IBM-Client-Secret": process.env.MNG_CREATE_ORDER_CLIENT_SECRET,
        "x-api-version": DEFAULT_API_VERSION,
      },
    });
    console.log("✅ MNG createOrder yanıtı alındı:", response.data);
    return response.data;
  } catch (err) {
    console.error("❌ MNG createOrder hatası:", err.response?.data || err.message);
    throw err;
  }
}

async function createBarcode(orderData) {
  console.log("🧾 MNG createBarcode() başladı:", orderData.referenceId);
  const token = await getIdentityToken();

  // recipient objesi customerId yoksa adres üzerinden doldurulacak
  const recipient = orderData.recipient?.customerId
    ? {
        customerId: orderData.recipient.customerId,
        refCustomerId: orderData.recipient.refCustomerId || "",
      }
    : {
        customerId: 0, // MNG için zorunlu ama 0 gönderebiliriz
        refCustomerId: "",
        cityCode: orderData.recipient?.cityCode || 0,
        districtCode: orderData.recipient?.districtCode || 0,
        cityName: orderData.recipient?.cityName || "",
        districtName: orderData.recipient?.districtName || "",
        address: orderData.recipient?.address || "",
        email: orderData.recipient?.email || "",
        fullName: orderData.recipient?.fullName || "",
        mobilePhoneNumber: orderData.recipient?.mobilePhoneNumber || "",
        homePhoneNumber: "",
        bussinessPhoneNumber: "",
        taxOffice: "",
        taxNumber: "",
      };

  const body = {
    referenceId: orderData.referenceId,
    billOfLandingId: orderData.billOfLandingId || "İrsaliye 1",
    isCOD: orderData.isCOD || 0,
    codAmount: orderData.codAmount || 0,
    packagingType: orderData.packagingType || 2,
    printReferenceBarcodeOnError: 0,
    message: orderData.message || orderData.content || "",
    additionalContent1: "",
    additionalContent2: "",
    additionalContent3: "",
    additionalContent4: "",
    orderPieceList:
      orderData.pieces?.map((p, i) => ({
        barcode: `${orderData.referenceId}_PARCA${i + 1}`,
        desi: p.desi || 2,
        kg: p.kg || 1,
        content: p.content || "Parça açıklama",
      })) || [],
    recipient,
  };

  try {
    const response = await axios.post(`${BASE_URL}/barcodecmdapi/createbarcode`, body, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-IBM-Client-Id": process.env.MNG_CREATE_ORDER_CLIENT_ID,
        "X-IBM-Client-Secret": process.env.MNG_CREATE_ORDER_CLIENT_SECRET,
        "x-api-version": DEFAULT_API_VERSION,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    console.log("✅ MNG createBarcode yanıtı alındı:", response.data);
    return response.data;
  } catch (err) {
    console.error("❌ MNG createBarcode hatası:", err.response?.data || err.message);
    throw err;
  }
}

async function createMNGShipment({ orderId, courier, orderData }) {
  console.log("🚚 createMNGShipment tetiklendi:", orderId, courier);

  // recipient objesi, customerId yoksa adres üzerinden doldurulacak
  const recipient = orderData.recipient?.customerId
    ? {
        customerId: orderData.recipient.customerId,
        refCustomerId: orderData.recipient.refCustomerId || "",
      }
    : {
        customerId: 0, // zorunlu alan, 0 gönderebiliriz
        refCustomerId: "",
        cityCode: orderData.recipient?.cityCode || 0,
        districtCode: orderData.recipient?.districtCode || 0,
        cityName: orderData.recipient?.cityName || "",
        districtName: orderData.recipient?.districtName || "",
        address: orderData.recipient?.address || "",
        email: orderData.recipient?.email || "",
        fullName: orderData.recipient?.fullName || "",
        mobilePhoneNumber: orderData.recipient?.mobilePhoneNumber || "",
        homePhoneNumber: "",
        bussinessPhoneNumber: "",
        taxOffice: "",
        taxNumber: "",
      };

  const shipmentData = {
    referenceId: orderId,
    content:
      orderData.content ||
      orderData.line_items?.map((i) => i.title).join(", ") ||
      "Ürün",
    pieces:
      orderData.pieces || [{ desi: 2, kg: 1, content: "Ürün paketi" }],
    recipient,
    marketPlaceShortCode: orderData.marketPlaceShortCode || "",
    billOfLandingId: orderData.billOfLandingId || "İrsaliye 1",
    isCOD: orderData.isCOD || 0,
    codAmount: orderData.codAmount || 0,
    packagingType: orderData.packagingType || 2,
    message: orderData.message || orderData.content || "",
  };

  console.log("🧾 MNG createBarcode çağrılıyor...");
  const barcodeResp = await createBarcode(shipmentData);

  const trackingNumber =
    barcodeResp.shipmentId || barcodeResp.barcodes?.[0]?.value || "";
  const barcode =
    barcodeResp.barcodes?.map((b) => b.value).join(", ") || "Barkod Yok";

  console.log(
    "✅ MNG shipment tamamlandı. TrackingNumber:",
    trackingNumber,
    "Barcode:",
    barcode
  );

  return { trackingNumber, barcode, ...barcodeResp };
}

module.exports = {
  getIdentityToken,
  createOrder,
  createBarcode,
  createMNGShipment,
};
