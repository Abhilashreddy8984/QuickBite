/**
 * QuickBite — Order Model
 * Defines customer orders schema, snapshot items, pricing totals, and order tracking.
 */

const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    food: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Food",
      required: [true, "Food reference is required"]
    },
    name: {
      type: String,
      required: [true, "Food item name snapshot is required"],
      trim: true
    },
    price: {
      type: Number,
      required: [true, "Food item price snapshot is required"],
      min: [0, "Item price cannot be negative"]
    },
    quantity: {
      type: Number,
      required: [true, "Item quantity is required"],
      min: [1, "Quantity must be at least 1"],
      default: 1
    }
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"]
    },
    items: {
      type: [orderItemSchema],
      required: [true, "Order must contain at least one item"],
      validate: {
        validator: function (items) {
          return Array.isArray(items) && items.length > 0;
        },
        message: "Order must contain at least one item"
      }
    },
    deliveryAddress: {
      type: String,
      required: [true, "Delivery address is required"],
      trim: true
    },
    subtotal: {
      type: Number,
      required: [true, "Subtotal is required"],
      min: [0, "Subtotal cannot be negative"]
    },
    deliveryFee: {
      type: Number,
      default: 0,
      min: [0, "Delivery fee cannot be negative"]
    },
    tax: {
      type: Number,
      default: 0,
      min: [0, "Tax cannot be negative"]
    },
    totalAmount: {
      type: Number,
      required: [true, "Total amount is required"],
      min: [0, "Total amount cannot be negative"]
    },
    paymentMethod: {
      type: String,
      enum: {
        values: ["COD", "ONLINE"],
        message: "Payment method must be either 'COD' or 'ONLINE'"
      },
      default: "COD"
    },
    paymentStatus: {
      type: String,
      enum: {
        values: ["PENDING", "PAID", "FAILED"],
        message: "Payment status must be 'PENDING', 'PAID', or 'FAILED'"
      },
      default: "PENDING"
    },
    orderStatus: {
      type: String,
      enum: {
        values: [
          "PLACED",
          "CONFIRMED",
          "PREPARING",
          "OUT_FOR_DELIVERY",
          "DELIVERED",
          "CANCELLED"
        ],
        message: "Invalid order status value"
      },
      default: "PLACED"
    }
  },
  {
    timestamps: true
  }
);

// Indexes for fast retrieval of customer order history and status filtering
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ orderStatus: 1 });

const Order = mongoose.model("Order", orderSchema);

module.exports = Order;
