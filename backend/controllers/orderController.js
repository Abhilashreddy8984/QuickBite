/**
 * QuickBite — Order Controller
 * Handles order placement, server-calculated totals, customer order history,
 * customer cancellation, and admin order lifecycle management.
 */

const mongoose = require("mongoose");
const Order = require("../models/Order");
const Food = require("../models/Food");

/**
 * Valid order status values as defined in Order model schema.
 */
const VALID_ORDER_STATUSES = [
  "PLACED",
  "CONFIRMED",
  "PREPARING",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED"
];

/**
 * @desc    Create a new order for authenticated customer
 * @route   POST /api/orders
 * @access  Private (Customer / Authenticated User)
 */
async function createOrder(req, res, next) {
  try {
    const { items, deliveryAddress, paymentMethod } = req.body;

    // 1. Validate delivery address
    if (!deliveryAddress || typeof deliveryAddress !== "string" || deliveryAddress.trim().length < 5) {
      return res.status(400).json({
        success: false,
        message: "A valid delivery address is required (minimum 5 characters)."
      });
    }

    // 2. Validate items array
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Order must contain at least one item."
      });
    }

    // 3. Extract and validate food IDs and quantities
    const itemRequests = [];
    const foodIdSet = new Set();

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const foodId = item.foodId || item.food;

      if (!foodId || !mongoose.Types.ObjectId.isValid(foodId)) {
        return res.status(400).json({
          success: false,
          message: `Invalid food ID format at item index ${i}.`
        });
      }

      const quantity = parseInt(item.quantity, 10);
      if (isNaN(quantity) || quantity < 1) {
        return res.status(400).json({
          success: false,
          message: `Quantity for food item must be a positive integer (minimum 1).`
        });
      }

      itemRequests.push({ foodId: foodId.toString(), quantity });
      foodIdSet.add(foodId.toString());
    }

    // 4. Query current database prices from MongoDB (NEVER trust frontend prices)
    const foodDocs = await Food.find({ _id: { $in: Array.from(foodIdSet) } });
    const foodMap = new Map(foodDocs.map((doc) => [doc._id.toString(), doc]));

    // 5. Verify all requested food items exist and are currently available
    const verifiedOrderItems = [];
    let calculatedSubtotal = 0;

    for (const reqItem of itemRequests) {
      const foodDoc = foodMap.get(reqItem.foodId);

      if (!foodDoc) {
        return res.status(400).json({
          success: false,
          message: `Food item with ID '${reqItem.foodId}' does not exist.`
        });
      }

      if (!foodDoc.isAvailable) {
        return res.status(400).json({
          success: false,
          message: `Dish "${foodDoc.name}" is currently unavailable.`
        });
      }

      const lineTotal = foodDoc.price * reqItem.quantity;
      calculatedSubtotal += lineTotal;

      // Preserve snapshot of food name and price at purchase
      verifiedOrderItems.push({
        food: foodDoc._id,
        name: foodDoc.name,
        price: foodDoc.price,
        quantity: reqItem.quantity
      });
    }

    // 6. Transparent server-side billing rules
    // Subtotal: sum of trusted DB prices * quantity
    // Delivery fee: ₹0 (FREE) if subtotal >= 500, else ₹40
    // Tax: 5% GST
    // Total Amount: Subtotal + Delivery Fee + Tax
    calculatedSubtotal = Math.round(calculatedSubtotal * 100) / 100;
    const deliveryFee = calculatedSubtotal >= 500 ? 0 : 40;
    const tax = Math.round(calculatedSubtotal * 0.05);
    const totalAmount = calculatedSubtotal + deliveryFee + tax;

    // 7. Validate payment method
    let resolvedPaymentMethod = "COD";
    if (paymentMethod && ["COD", "ONLINE"].includes(paymentMethod.toUpperCase())) {
      resolvedPaymentMethod = paymentMethod.toUpperCase();
    }

    // 8. Persist order in MongoDB
    const order = await Order.create({
      user: req.user._id, // User ID strictly read from verified JWT
      items: verifiedOrderItems,
      deliveryAddress: deliveryAddress.trim(),
      subtotal: calculatedSubtotal,
      deliveryFee: deliveryFee,
      tax: tax,
      totalAmount: totalAmount,
      paymentMethod: resolvedPaymentMethod,
      paymentStatus: resolvedPaymentMethod === "ONLINE" ? "PAID" : "PENDING",
      orderStatus: "PLACED"
    });

    return res.status(201).json({
      success: true,
      message: "Order placed successfully.",
      order
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Get order history for authenticated customer
 * @route   GET /api/orders/myorders
 * @access  Private (Customer)
 */
async function getMyOrders(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const filter = { user: req.user._id };

    const totalItems = await Order.countDocuments(filter);
    const totalPages = Math.ceil(totalItems / limit) || 1;

    // Retrieve only this customer's orders, newest first
    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return res.status(200).json({
      success: true,
      count: orders.length,
      totalItems,
      totalPages,
      currentPage: page,
      orders
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Get single order details by ID
 * @route   GET /api/orders/:id
 * @access  Private (Owner customer or Admin)
 */
async function getOrderById(req, res, next) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID format."
      });
    }

    const order = await Order.findById(id).populate("user", "name email");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found."
      });
    }

    // Customer can only view their own order.
    // If it belongs to another customer, return 404 to avoid exposing existence.
    const isOwner = order.user && order.user._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(404).json({
        success: false,
        message: "Order not found."
      });
    }

    return res.status(200).json({
      success: true,
      order
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Cancel an order (Customer can cancel their own PLACED or CONFIRMED order)
 * @route   PUT /api/orders/:id/cancel
 * @access  Private (Owner customer or Admin)
 */
async function cancelOrder(req, res, next) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID format."
      });
    }

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found."
      });
    }

    // Ownership check (return 404 if not owner and not admin)
    const isOwner = order.user.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(404).json({
        success: false,
        message: "Order not found."
      });
    }

    // Validate lifecycle state transitions
    if (order.orderStatus === "CANCELLED") {
      return res.status(400).json({
        success: false,
        message: "Order has already been cancelled."
      });
    }

    if (order.orderStatus === "DELIVERED") {
      return res.status(400).json({
        success: false,
        message: "Delivered orders cannot be cancelled."
      });
    }

    if (order.orderStatus === "OUT_FOR_DELIVERY" || order.orderStatus === "PREPARING") {
      return res.status(400).json({
        success: false,
        message: `Order cannot be cancelled while it is '${order.orderStatus}'. Please contact support.`
      });
    }

    // Only PLACED or CONFIRMED can be cancelled
    order.orderStatus = "CANCELLED";
    await order.save();

    return res.status(200).json({
      success: true,
      message: "Order cancelled successfully.",
      order
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    List all orders with pagination (Admin only)
 * @route   GET /api/orders
 * @access  Private (Admin only)
 */
async function getAllOrders(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status && VALID_ORDER_STATUSES.includes(req.query.status.toUpperCase())) {
      filter.orderStatus = req.query.status.toUpperCase();
    }

    const totalItems = await Order.countDocuments(filter);
    const totalPages = Math.ceil(totalItems / limit) || 1;

    const orders = await Order.find(filter)
      .populate("user", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return res.status(200).json({
      success: true,
      count: orders.length,
      totalItems,
      totalPages,
      currentPage: page,
      orders
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Update order status (Admin only)
 * @route   PUT /api/orders/:id/status
 * @access  Private (Admin only)
 */
async function updateOrderStatus(req, res, next) {
  try {
    const { id } = req.params;
    const requestedStatus = (req.body.orderStatus || req.body.status || "").toUpperCase();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID format."
      });
    }

    if (!VALID_ORDER_STATUSES.includes(requestedStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid order status. Allowed values: ${VALID_ORDER_STATUSES.join(", ")}`
      });
    }

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found."
      });
    }

    // Guard against modifying terminal states
    if (order.orderStatus === "DELIVERED" && requestedStatus !== "DELIVERED") {
      return res.status(400).json({
        success: false,
        message: "Cannot modify status of a delivered order."
      });
    }

    if (order.orderStatus === "CANCELLED" && requestedStatus !== "CANCELLED") {
      return res.status(400).json({
        success: false,
        message: "Cannot modify status of a cancelled order."
      });
    }

    order.orderStatus = requestedStatus;

    // If order is delivered, update payment status for COD to PAID
    if (requestedStatus === "DELIVERED" && order.paymentMethod === "COD") {
      order.paymentStatus = "PAID";
    }

    await order.save();

    return res.status(200).json({
      success: true,
      message: `Order status updated to '${requestedStatus}'.`,
      order
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createOrder,
  getMyOrders,
  getOrderById,
  cancelOrder,
  getAllOrders,
  updateOrderStatus
};
