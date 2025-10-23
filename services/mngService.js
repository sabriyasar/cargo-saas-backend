const axios = require("axios");
const NodeCache = require("node-cache");

const BASE_URL = "https://api.mngkargo.com.tr/mngapi/api";
const DEFAULT_API_VERSION = process.env.MNG_API_VERSION || "1.0";

// Token cache (identity için)
let identityTokenCache = null;

// CBS Info cache: 24 saat
const cbsCache = new NodeCache({ stdTTL: 86400, checkperiod: 3600 });

function normalize(str) {
  return str.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
}

/**
 * 🔹 CBS Info: cityCode ve districtCode bul
 */
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

/**
 * 🔹 Identity API’den JWT token al
 * (fallback: .env içindeki statik JWT kullanılabilir)
 */
async function getIdentityToken() {
  if (process.env.MNG_ORDER_JWT) {
    return process.env.MNG_ORDER_JWT;
  }

  if (identityTokenCache && new Date() < identityTokenCache.expireDate) {
    return identityTokenCache.token;
  }

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

  identityTokenCache = { token: jwt, expireDate: new Date(jwtExpireDate) };
  return jwt;
}

/**
 * 🔹 Yeni Standard Command API - createOrder
 */
async function createOrder(orderData) {
  const identityToken = await getIdentityToken();
  const referenceId = orderData.referenceId || orderData._id || orderData.orderId?.toString();

  // 🔹 CBS Info kodları sadece customerId yoksa alınacak
  let cityCode, districtCode;
  if (!orderData.recipient?.customerId) {
    if (!orderData.recipient?.cityName || !orderData.recipient?.districtName) {
      throw new Error("Recipient cityName veya districtName eksik.");
    }
    const codes = await findCityAndDistrictCodes(orderData.recipient.cityName, orderData.recipient.districtName);
    cityCode = codes.cityCode;
    districtCode = codes.districtCode;
  }

  // 🔹 Recipient bilgisi customerId’ye göre ayarlanıyor
  const recipient = orderData.recipient?.customerId
    ? {
        customerId: orderData.recipient.customerId,
        refCustomerId: orderData.recipient.refCustomerId || "",
        // customerId doluysa city/district ve fullName boş olmalı
        cityCode: undefined,
        districtCode: undefined,
        cityName: "",
        districtName: "",
        address: "",
        bussinessPhoneNumber: "",
        email: "",
        taxOffice: "",
        taxNumber: "",
        fullName: "",
        homePhoneNumber: "",
        mobilePhoneNumber: "",
      }
    : {
        customerId: undefined,
        refCustomerId: orderData.recipient.refCustomerId || "",
        cityCode,
        districtCode,
        cityName: orderData.recipient.cityName,
        districtName: orderData.recipient.districtName,
        address: orderData.recipient.address || "",
        bussinessPhoneNumber: orderData.recipient.bussinessPhoneNumber || "",
        email: orderData.recipient.email || "",
        taxOffice: orderData.recipient.taxOffice || "",
        taxNumber: orderData.recipient.taxNumber || "",
        fullName: orderData.recipient.fullName || "",
        homePhoneNumber: orderData.recipient.homePhoneNumber || "",
        mobilePhoneNumber: orderData.recipient.mobilePhoneNumber || "",
      };

  // 🔹 API body (dokümana uygun)
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
      smsPreference1: 1,
      smsPreference2: 0,
      smsPreference3: 0,
      paymentType: 1,
      deliveryType: 1,
      description: orderData.message || orderData.content || `Sipariş ${referenceId}`,
      marketPlaceShortCode: "",
      marketPlaceSaleCode: "",
      pudoId: "",
    },
    orderPieceList:
      orderData.pieces?.map((p, i) => ({
        barcode: `${referenceId}_PARCA${i + 1}`,
        desi: p.desi || 2,
        kg: p.kg || 1,
        content: p.content || "Parça açıklama",
      })) || [],
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

    const trackingNumber =
      response.data?.order?.barcode ||
      response.data?.shipmentId ||
      response.data?.barcodes?.[0]?.value ||
      "";

    return {
      ...response.data,
      trackingNumber,
    };
  } catch (err) {
    console.error("❌ MNG Standard Command createOrder hatası:", err.response?.data || err.message);
    throw err;
  }
}

module.exports = {
  getIdentityToken,
  createOrder,
};
