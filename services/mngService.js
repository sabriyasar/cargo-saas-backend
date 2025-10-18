const axios = require("axios");

const BASE_URL = "https://api.mngkargo.com.tr/mngapi/api";
const DEFAULT_API_VERSION = process.env.MNG_API_VERSION || "1.0";

// Token cache: siteOwnerId -> { token, expireDate }
const tokenCache = {};

/**
 * 🔹 MNG Identity API’den JWT token al
 * @param {Object} siteOwner
 */
async function getToken(siteOwner) {
  const cache = tokenCache[siteOwner.id];
  if (cache && new Date() < cache.expireDate) return cache.token;

  try {
    const response = await axios.post(
      `${BASE_URL}/token`,
      {
        CustomerNumber: siteOwner.customerNumber,
        Password: siteOwner.password,
        IdentityType: siteOwner.identityType || 1,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-IBM-Client-Id": siteOwner.clientId,
          "X-IBM-Client-Secret": siteOwner.clientSecret,
          "x-api-version": siteOwner.apiVersion || DEFAULT_API_VERSION,
        },
      }
    );

    const { jwt, jwtExpireDate } = response.data;
    if (!jwt || !jwtExpireDate) throw new Error("MNG Token eksik!");

    tokenCache[siteOwner.id] = {
      token: jwt,
      expireDate: new Date(jwtExpireDate),
    };

    console.log(`✅ MNG Token alındı: ${jwt}`);
    return jwt;
  } catch (error) {
    console.error("❌ Token alma hatası:", error.response?.data || error.message);
    throw error;
  }
}

/**
 * 🔹 Check Return Order
 */
async function checkReturnOrder(siteOwner, criteria) {
  try {
    const jwt = await getToken(siteOwner);

    const response = await axios.post(
      `${BASE_URL}/plusqueryapi/checkReturnOrder`,
      criteria,
      {
        headers: {
          Authorization: `Bearer ${jwt}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-IBM-Client-Id": siteOwner.clientId,
          "X-IBM-Client-Secret": siteOwner.clientSecret,
          "x-api-version": siteOwner.apiVersion || DEFAULT_API_VERSION,
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error("❌ CheckReturnOrder hatası:", error.response?.data || error.message);
    throw error;
  }
}

/**
 * 🔹 Create Return Order
 */
async function createReturnOrder(siteOwner, returnData) {
  try {
    const jwt = await getToken(siteOwner);

    const apiBody = {
      order: {
        referenceId: returnData._id.toString(),
        barcode: returnData._id.toString(),
        billOfLandingId: "İrsaliye 1",
        isCOD: 0,
        codAmount: 0,
        shipmentServiceType: 1,
        packagingType: 1,
        content: returnData.reason,
        smsPreference1: 1,
        smsPreference2: 0,
        smsPreference3: 0,
        paymentType: 1,
        deliveryType: 1,
        description: `İade: ${returnData.reason}`,
        marketPlaceShortCode: "",
        marketPlaceSaleCode: "",
        pudoId: ""
      },
      orderPieceList: [
        {
          barcode: returnData._id.toString() + "_1",
          desi: 2,
          kg: 1,
          content: "Parça 1"
        }
      ],
      shipper: {
        customerId: siteOwner.customerId,
        fullName: "",
        cityName: "",
        districtName: "",
        address: "",
        email: "",
        mobilePhoneNumber: ""
      }
    };

    const response = await axios.post(
      `${BASE_URL}/standardcmdapi/createReturnOrder`,
      apiBody,
      {
        headers: {
          Authorization: `Bearer ${jwt}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-IBM-Client-Id": siteOwner.clientId,
          "X-IBM-Client-Secret": siteOwner.clientSecret,
          "x-api-version": siteOwner.apiVersion || DEFAULT_API_VERSION,
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error("❌ CreateReturnOrder hatası:", error.response?.data || error.message);
    throw error;
  }
}

module.exports = {
  getToken,
  checkReturnOrder,
  createReturnOrder
};
