/**
 * QuickBite — Food Model
 * Defines food items schema, validation, pricing, and catalog categorizations.
 */

const mongoose = require("mongoose");

const foodSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Food item name is required"],
      trim: true,
      maxlength: [120, "Food name cannot exceed 120 characters"]
    },
    description: {
      type: String,
      trim: true,
      default: ""
    },
    price: {
      type: Number,
      required: [true, "Food item price is required"],
      min: [0, "Price must be a positive number or zero"]
    },
    image: {
      type: String,
      trim: true,
      default: ""
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true
    },
    isAvailable: {
      type: Boolean,
      default: true
    },
    preparationTime: {
      type: Number,
      default: 20,
      min: [1, "Preparation time must be at least 1 minute"]
    }
  },
  {
    timestamps: true
  }
);

// Indexes for category filtering and search queries
foodSchema.index({ category: 1, isAvailable: 1 });
foodSchema.index({ name: "text", description: "text" });

const Food = mongoose.model("Food", foodSchema);

module.exports = Food;
