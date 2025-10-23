const axios = require("axios");
const NodeCache = require("node-cache");

const BASE_URL = "https://api.mngkargo.com.tr/mngapi/api";
const DEFAULT_API_VERSION = process.env.MNG_API_VERSION || "1.0";
const cache = new NodeCache({ stdTTL: 86400, checkperiod: 3600 });

function normalize(str) {
  return str.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
}

// Tüm şehirleri al
async function getAllCities() {
  const cached = cache.get("cities");
  if (cached) return cached;

  const res = await axios.get(`${BASE_URL}/cbsinfoapi/getcities`, {
    headers: {
      "X-IBM-Client-Id": process.env.MNG_CBS_CLIENT_ID,
      "X-IBM-Client-Secret": process.env.MNG_CBS_CLIENT_SECRET,
      "x-api-version": DEFAULT_API_VERSION,
      Accept: "application/json",
    },
  });

  const cities = res.data || [];
  cache.set("cities", cities);
  return cities;
}

// Belirli bir şehir için ilçeleri al
async function getDistrictsByCityName(cityName) {
  const normalizedCity = normalize(cityName);
  const cacheKey = `districts_${normalizedCity}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const cities = await getAllCities();
  const city = cities.find(c => normalize(c.name) === normalizedCity);
  if (!city) throw new Error(`Şehir bulunamadı: ${cityName}`);

  const res = await axios.get(`${BASE_URL}/cbsinfoapi/getdistricts/${city.code}`, {
    headers: {
      "X-IBM-Client-Id": process.env.MNG_CBS_CLIENT_ID,
      "X-IBM-Client-Secret": process.env.MNG_CBS_CLIENT_SECRET,
      "x-api-version": DEFAULT_API_VERSION,
      Accept: "application/json",
    },
  });

  const districts = res.data || [];
  cache.set(cacheKey, districts);
  return districts;
}

module.exports = { getAllCities, getDistrictsByCityName };
