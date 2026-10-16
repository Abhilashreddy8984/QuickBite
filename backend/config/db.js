/**
 * QuickBite — Database Configuration
 * Connects to MongoDB Atlas or local MongoDB using Mongoose.
 */

const mongoose = require("mongoose");

// Track live connection state
let isConnected = false;

/**
 * Safely sanitizes MongoDB URI for logging (redacts username & password).
 * E.g., mongodb+srv://user:pass@cluster.mongodb.net/quickbite -> mongodb+srv://***:***@cluster.mongodb.net/quickbite
 */
function sanitizeMongoUri(uri) {
  if (!uri) return "(none provided)";
  return uri.replace(/\/\/(.*?):(.*?)@/, "//***:***@");
}

/**
 * Connect to MongoDB with error handling and status reporting.
 */
async function connectDB() {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri || mongoUri.includes("your_username") || mongoUri.includes("your_password")) {
    console.warn("⚠️  [DATABASE WARNING]: MONGODB_URI is not configured in backend/.env.");
    console.warn("👉 Please set a valid MongoDB Atlas connection string in 'backend/.env'.");
    console.warn("ℹ️  Server will continue running so you can test health & CORS endpoints.\n");
    isConnected = false;
    return false;
  }

  try {
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 15000 // 15 seconds timeout for reliable cloud connection
    });

    isConnected = true;
    console.log(`✅ [DATABASE SUCCESS]: Connected to MongoDB at host: ${conn.connection.host}`);
    console.log(`📦 [DATABASE NAME]: ${conn.connection.name}\n`);
    return true;
  } catch (error) {
    isConnected = false;
    console.error("❌ [DATABASE ERROR]: Failed to connect to MongoDB.");
    console.error(`   Error message: ${error.message}`);
    console.warn(`   Target URI: ${sanitizeMongoUri(mongoUri)}`);
    console.warn("👉 Check your network, IP whitelist on MongoDB Atlas (0.0.0.0/0 for dev), and credentials.\n");
    return false;
  }
}

/**
 * Helper to check connection status synchronously
 */
function getDbStatus() {
  // 1 = connected, 2 = connecting, 0 = disconnected, 3 = disconnecting
  const state = mongoose.connection.readyState;
  if (state === 1) return "connected";
  if (state === 2) return "connecting";
  return "disconnected";
}

module.exports = { connectDB, getDbStatus };
