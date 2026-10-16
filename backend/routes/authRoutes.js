/**
 * QuickBite — Authentication Routes
 * Maps /api/auth endpoints to controller actions.
 */

const express = require("express");
const router = express.Router();
const {
  registerUser,
  loginUser,
  getProfile
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");

// Public routes
router.post("/register", registerUser);
router.post("/login", loginUser);

// Protected route (requires valid JWT in Authorization header)
router.get("/profile", protect, getProfile);

module.exports = router;
