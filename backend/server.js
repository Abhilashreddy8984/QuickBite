/**
 * QuickBite — Online Food Ordering Website
 * Backend Express Server Entrypoint
 */

// Load environment variables from backend/.env if present
const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");

// Try loading .env from current directory or backend directory
dotenv.config({ path: path.join(__dirname, ".env") });

const express = require("express");
const cors = require("cors");
const { connectDB, getDbStatus } = require("./config/db");
const { notFoundHandler, errorHandler } = require("./middleware/errorMiddleware");

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || "0.0.0.0";
const NODE_ENV = process.env.NODE_ENV || "development";

// ============================================================================
// 1. CORS CONFIGURATION
// ============================================================================
// Parse configured origins from FRONTEND_URL environment variable
const configuredOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(",").map((origin) => origin.trim().replace(/\/+$/, ""))
  : [];

const localDevOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5000",
  "http://127.0.0.1:5000",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://localhost:8080",
  "http://127.0.0.1:8080"
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no Origin header (e.g. mobile apps, curl, Postman, same-origin)
    if (!origin) return callback(null, true);

    const cleanOrigin = origin.replace(/\/+$/, "");

    // 1. Allow wildcard or configured FRONTEND_URL
    if (configuredOrigins.includes("*") || configuredOrigins.includes(cleanOrigin)) {
      return callback(null, true);
    }

    // 2. Allow Render domains (*.onrender.com) automatically
    if (cleanOrigin.endsWith(".onrender.com")) {
      return callback(null, true);
    }

    // 3. Allow standard local development origins
    if (localDevOrigins.includes(cleanOrigin) || cleanOrigin.startsWith("http://localhost:") || cleanOrigin.startsWith("http://127.0.0.1:")) {
      return callback(null, true);
    }

    callback(new Error(`CORS Error: Origin '${origin}' is not authorized by QuickBite CORS policy.`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
};

app.use(cors(corsOptions));

// ============================================================================
// 2. BODY PARSING MIDDLEWARE
// ============================================================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger for beginner-friendly debugging during demonstration
if (NODE_ENV !== "test") {
  app.use((req, res, next) => {
    console.log(`📡 [${new Date().toLocaleTimeString()}] ${req.method} ${req.originalUrl}`);
    next();
  });
}

// ============================================================================
// 3. STATIC FRONTEND SERVING
// ============================================================================
// Locate project root containing index.html, style.css, script.js, config.js
const frontendDir = fs.existsSync(path.join(__dirname, "..", "index.html"))
  ? path.join(__dirname, "..")
  : __dirname;

// Serve static assets (CSS, JS, images, config.js)
app.use(express.static(frontendDir));

// Explicit root route serving index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(frontendDir, "index.html"));
});

// ============================================================================
// 4. API STATUS & HEALTH CHECK ENDPOINTS
// ============================================================================
app.get("/api", (req, res) => {
  res.json({
    project: "QuickBite — Online Food Ordering Website API",
    version: "1.0.0",
    status: "Active",
    documentation: "Refer to README.md for endpoint details",
    healthCheck: "/api/health"
  });
});

app.get("/api/health", (req, res) => {
  const dbState = getDbStatus();
  res.status(200).json({
    status: "OK",
    message: "QuickBite Express API server is healthy and responding.",
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    database: {
      status: dbState,
      connected: dbState === "connected",
      note:
        dbState === "connected"
          ? "MongoDB connection active."
          : "Database not connected. Provide valid MONGODB_URI in backend/.env for database features."
    }
  });
});

// ============================================================================
// 5. API ROUTES
// ============================================================================
const authRoutes = require("./routes/authRoutes");
const foodRoutes = require("./routes/foodRoutes");
const orderRoutes = require("./routes/orderRoutes");

app.use("/api/auth", authRoutes);
app.use("/api/foods", foodRoutes);
app.use("/api/orders", orderRoutes);

// SPA fallback for any non-API routes (e.g. browser navigation)
app.get("*", (req, res, next) => {
  if (req.originalUrl.startsWith("/api")) {
    return next(); // Pass unknown /api/* requests to notFoundHandler
  }
  res.sendFile(path.join(frontendDir, "index.html"));
});

// ============================================================================
// 5. ERROR HANDLING MIDDLEWARE
// ============================================================================
app.use(notFoundHandler);
app.use(errorHandler);

// ============================================================================
// 6. SERVER INITIALIZATION & DATABASE CONNECTION
// ============================================================================
async function startServer() {
  console.log("\n=======================================================");
  console.log("🍔 QuickBite Online Food Ordering API Server");
  console.log("=======================================================");
  console.log(`⚙️  Environment: ${NODE_ENV}`);
  console.log(`🚪 Configured Host & Port: ${HOST}:${PORT}`);

  // Initiate database connection
  await connectDB();

  // Start Express HTTP listener on host 0.0.0.0 (required for Render)
  app.listen(PORT, HOST, () => {
    console.log(`🚀 Server running at: http://${HOST}:${PORT}`);
    console.log(`🩺 Health check URL:  http://${HOST}:${PORT}/api/health`);
    console.log("=======================================================\n");
  });
}

// Run server only when executed directly (not when required in test suites)
if (require.main === module) {
  startServer();
}

module.exports = app;
