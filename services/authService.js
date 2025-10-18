// services/authService.js
const axios = require("axios");

let jwtToken = null;
let tokenExpireDate = null;

/**
 * MNG Identity API’den JWT token alır
 */
async function getToken() {
  // Eğer token var ve hala geçerliyse direkt geri döndür
  if (jwtToken && tokenExpireDate && new Date() < tokenExpireDate) {
    return jwtToken;
  }

  try {
    const response = await axios.post(
      "https://api.mngkargo.com.tr/mngapi/api/token",
      {
        CustomerNumber: process.env.MNG_CUSTOMER_NUMBER,
        Password: process.env.MNG_PASSWORD,
        IdentityType: Number(process.env.MNG_IDENTITY_TYPE) || 1
      },
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-IBM-Client-Id": process.env.MNG_CLIENT_ID,       // Identity API için
          "X-IBM-Client-Secret": process.env.MNG_CLIENT_SECRET, // Identity API için
          "x-api-version": process.env.MNG_API_VERSION
        },
        timeout: 10000
      }
    );

    const { jwt, jwtExpireDate } = response.data;

    if (!jwt || !jwtExpireDate) {
      throw new Error("MNG Token response eksik: " + JSON.stringify(response.data));
    }

    // Token ve expiration tarihini kaydet
    jwtToken = jwt;
    tokenExpireDate = new Date(jwtExpireDate);

    console.log("✅ MNG Token alındı");

    return jwtToken;
  } catch (err) {
    console.error("❌ MNG Token alınamadı:", err.response?.data || err.message);
    throw new Error("MNG Token alınamadı");
  }
}

module.exports = { getToken };
