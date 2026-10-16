/**
 * QuickBite — Food Catalog Routes
 * Maps /api/foods endpoints to controller actions.
 */

const express = require("express");
const router = express.Router();
const {
  getFoods,
  getFoodById,
  createFood,
  updateFood,
  deleteFood
} = require("../controllers/foodController");
const { protect, adminOnly } = require("../middleware/authMiddleware");

// Public routes for customers and browsing
router.get("/", getFoods);
router.get("/:id", getFoodById);

// Protected routes (Admin only)
router.post("/", protect, adminOnly, createFood);
router.put("/:id", protect, adminOnly, updateFood);
router.delete("/:id", protect, adminOnly, deleteFood);

module.exports = router;
