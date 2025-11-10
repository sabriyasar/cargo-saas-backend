const allowedOrigins = [
  "http://localhost:3003",
  "https://cargo-saas-backend.onrender.com",
  "https://cargo-saas-frontend.vercel.app",
];

const corsOptions = {
  origin: function (origin, callback) {
    if (
      !origin ||
      allowedOrigins.includes(origin) ||
      origin.startsWith("http://localhost")
    ) {
      callback(null, true);
    } else {
      console.log("❌ Engellenen Origin:", origin);
      callback(new Error("CORS hatası: Bu origin izinli değil"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
};

module.exports = corsOptions;
