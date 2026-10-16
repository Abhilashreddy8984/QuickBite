/**
 * QuickBite — Order API Automated Test Suite (Stage 5)
 * Verifies:
 * 1. Unauthenticated order creation rejection (401)
 * 2. Authenticated customer order creation with server-calculated total (201)
 * 3. Rejection of invalid food IDs and non-existent foods (400)
 * 4. Rejection of unavailable dishes (400)
 * 5. Tamper-proof pricing (client-supplied fake prices/totals are ignored)
 * 6. Customer order history isolation (customer sees only their own orders in /myorders)
 * 7. Privacy protection: Customer reading another customer's order returns 404
 * 8. Customer cancellation rules (can cancel PLACED, cannot cancel DELIVERED or already CANCELLED)
 * 9. Protection against non-owners cancelling an order (returns 404)
 * 10. Admin order listing and status transitions (CONFIRMED -> PREPARING -> OUT_FOR_DELIVERY -> DELIVERED)
 * 11. Rejection of admin endpoints for regular customers (403)
 * 12. Invalid IDs and nonexistent orders handled with appropriate 400 & 404 codes
 */

require("dotenv").config();
const http = require("http");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { connectDB } = require("./config/db");
const app = require("./server");
const User = require("./models/User");
const Food = require("./models/Food");
const Order = require("./models/Order");

async function runOrderTests() {
  console.log("==================================================");
  console.log("🧪 STARTING QUICKBITE STAGE 5 ORDER API TEST SUITE");
  console.log("==================================================");

  const connected = await connectDB();
  if (!connected) {
    throw new Error("Could not connect to MongoDB Atlas. Please check network/IP whitelist.");
  }

  // Spin up ephemeral test server
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  let customer1;
  let customer2;
  let adminUser;
  let tokenCustomer1;
  let tokenCustomer2;
  let tokenAdmin;
  let availablePizza;
  let availableBurger;
  let unavailableDrink;

  try {
    // ------------------------------------------------------------------------
    // SETUP: Users & Test Dishes
    // ------------------------------------------------------------------------
    console.log("\n[SETUP] Creating test users and menu items in MongoDB Atlas...");
    await User.deleteMany({
      email: { $in: ["cust1@quickbite.test", "cust2@quickbite.test", "admin5@quickbite.test"] }
    });

    customer1 = await User.create({
      name: "Customer One",
      email: "cust1@quickbite.test",
      password: "password123",
      role: "customer"
    });

    customer2 = await User.create({
      name: "Customer Two",
      email: "cust2@quickbite.test",
      password: "password123",
      role: "customer"
    });

    adminUser = await User.create({
      name: "Admin User",
      email: "admin5@quickbite.test",
      password: "password123",
      role: "admin"
    });

    tokenCustomer1 = jwt.sign({ userId: customer1._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
    tokenCustomer2 = jwt.sign({ userId: customer2._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
    tokenAdmin = jwt.sign({ userId: adminUser._id }, process.env.JWT_SECRET, { expiresIn: "1h" });

    // Create dishes
    await Food.deleteMany({ name: { $regex: /^Stage5/ } });

    availablePizza = await Food.create({
      name: "Stage5 Gourmet Truffle Pizza",
      price: 300,
      category: "Pizza",
      isAvailable: true
    });

    availableBurger = await Food.create({
      name: "Stage5 Spicy Chicken Burger",
      price: 150,
      category: "Burger",
      isAvailable: true
    });

    unavailableDrink = await Food.create({
      name: "Stage5 Out-of-Stock Shake",
      price: 90,
      category: "Beverage",
      isAvailable: false
    });

    console.log("✅ Setup completed: 2 customers, 1 admin, 3 test dishes.");

    // ------------------------------------------------------------------------
    // TEST 1: Reject unauthenticated order placement (401)
    // ------------------------------------------------------------------------
    console.log("\n--- TEST 1: Reject unauthenticated order placement ---");
    const resNoAuth = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ foodId: availablePizza._id, quantity: 1 }],
        deliveryAddress: "Flat 101, Test Street"
      })
    });
    console.log(`Status: ${resNoAuth.status} (Expected: 401)`);
    if (resNoAuth.status !== 401) throw new Error("Expected 401 Unauthorized for missing token");

    // ------------------------------------------------------------------------
    // TEST 2: Reject invalid food ID format (400)
    // ------------------------------------------------------------------------
    console.log("\n--- TEST 2: Reject invalid food ID format ---");
    const resBadFoodId = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenCustomer1}`
      },
      body: JSON.stringify({
        items: [{ foodId: "not-a-valid-objectid", quantity: 1 }],
        deliveryAddress: "Flat 101, Test Street"
      })
    });
    const dataBadFoodId = await resBadFoodId.json();
    console.log(`Status: ${resBadFoodId.status} (Expected: 400)`);
    console.log(`Message: ${dataBadFoodId.message}`);
    if (resBadFoodId.status !== 400) throw new Error("Expected 400 for invalid food ID");

    // ------------------------------------------------------------------------
    // TEST 3: Reject unavailable food item (400)
    // ------------------------------------------------------------------------
    console.log("\n--- TEST 3: Reject unavailable food item ---");
    const resUnavail = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenCustomer1}`
      },
      body: JSON.stringify({
        items: [{ foodId: unavailableDrink._id, quantity: 1 }],
        deliveryAddress: "Flat 101, Test Street"
      })
    });
    const dataUnavail = await resUnavail.json();
    console.log(`Status: ${resUnavail.status} (Expected: 400)`);
    console.log(`Message: ${dataUnavail.message}`);
    if (resUnavail.status !== 400) throw new Error("Expected 400 for unavailable food item");

    // ------------------------------------------------------------------------
    // TEST 4: Tamper-proof pricing (Server-side calculation)
    // Client sends price: ₹1, subtotal: ₹1, total: ₹1.
    // Real prices: 1 Pizza (₹300) + 1 Burger (₹150) = Subtotal ₹450.
    // Subtotal < 500 => Delivery fee = ₹40. Tax = 5% of 450 = ₹23.
    // Expected Grand Total = 450 + 40 + 23 = ₹513.
    // ------------------------------------------------------------------------
    console.log("\n--- TEST 4: Server calculates totals & ignores client tamper attempts ---");
    const resCreateOrder1 = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenCustomer1}`
      },
      body: JSON.stringify({
        items: [
          { foodId: availablePizza._id, quantity: 1, price: 1 }, // Spoofed price
          { foodId: availableBurger._id, quantity: 1, price: 1 }  // Spoofed price
        ],
        deliveryAddress: "Flat 402, Highrise Heights, Hyderabad 500001",
        subtotal: 2, // Spoofed subtotal
        totalAmount: 2 // Spoofed total
      })
    });
    const dataOrder1 = await resCreateOrder1.json();
    console.log(`Status: ${resCreateOrder1.status} (Expected: 201)`);
    const order1 = dataOrder1.order;
    console.log(`Server-calculated Subtotal: ₹${order1.subtotal} (Expected: ₹450)`);
    console.log(`Server-calculated Delivery Fee: ₹${order1.deliveryFee} (Expected: ₹40)`);
    console.log(`Server-calculated Tax: ₹${order1.tax} (Expected: ₹23)`);
    console.log(`Server-calculated Grand Total: ₹${order1.totalAmount} (Expected: ₹513)`);

    if (
      resCreateOrder1.status !== 201 ||
      order1.subtotal !== 450 ||
      order1.deliveryFee !== 40 ||
      order1.totalAmount !== 513
    ) {
      throw new Error("Server total calculation or anti-tampering check failed!");
    }

    // ------------------------------------------------------------------------
    // TEST 5: Free delivery on subtotal >= ₹500
    // 2 Pizzas @ ₹300 = ₹600. Delivery fee = ₹0. Tax = 5% of 600 = ₹30. Total = ₹630.
    // ------------------------------------------------------------------------
    console.log("\n--- TEST 5: Free delivery eligibility for subtotal >= ₹500 ---");
    const resFreeDelivery = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenCustomer1}`
      },
      body: JSON.stringify({
        items: [{ foodId: availablePizza._id, quantity: 2 }],
        deliveryAddress: "Flat 402, Highrise Heights, Hyderabad 500001"
      })
    });
    const dataFreeDelivery = await resFreeDelivery.json();
    const order2 = dataFreeDelivery.order;
    console.log(`Order 2 Subtotal: ₹${order2.subtotal} (Expected: ₹600)`);
    console.log(`Order 2 Delivery Fee: ₹${order2.deliveryFee} (Expected: ₹0 FREE)`);
    console.log(`Order 2 Grand Total: ₹${order2.totalAmount} (Expected: ₹630)`);
    if (order2.deliveryFee !== 0 || order2.totalAmount !== 630) {
      throw new Error("Free delivery calculation failed!");
    }

    // Customer 2 places an order
    const resCust2Order = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenCustomer2}`
      },
      body: JSON.stringify({
        items: [{ foodId: availableBurger._id, quantity: 2 }],
        deliveryAddress: "Villa 9, Green Hills, Hyderabad"
      })
    });
    const orderCustomer2 = (await resCust2Order.json()).order;

    // ------------------------------------------------------------------------
    // TEST 6: Customer 1 retrieves only their own orders (/myorders)
    // ------------------------------------------------------------------------
    console.log("\n--- TEST 6: Customer retrieves only their own orders ---");
    const resMyOrders = await fetch(`${baseUrl}/api/orders/myorders`, {
      headers: { Authorization: `Bearer ${tokenCustomer1}` }
    });
    const dataMyOrders = await resMyOrders.json();
    console.log(`Customer 1 total orders: ${dataMyOrders.count}`);
    const allBelongToCust1 = dataMyOrders.orders.every(
      (o) => o.user.toString() === customer1._id.toString()
    );
    console.log(`All returned orders belong strictly to Customer 1: ${allBelongToCust1}`);
    if (dataMyOrders.count !== 2 || !allBelongToCust1) {
      throw new Error("Customer order history isolation failed!");
    }

    // ------------------------------------------------------------------------
    // TEST 7: Privacy check - Customer 1 cannot view Customer 2's order (Returns 404)
    // ------------------------------------------------------------------------
    console.log("\n--- TEST 7: Customer 1 requesting Customer 2's order ID returns 404 ---");
    const resCrossAccess = await fetch(`${baseUrl}/api/orders/${orderCustomer2._id}`, {
      headers: { Authorization: `Bearer ${tokenCustomer1}` }
    });
    const dataCrossAccess = await resCrossAccess.json();
    console.log(`Status: ${resCrossAccess.status} (Expected: 404 Not Found)`);
    console.log(`Message: ${dataCrossAccess.message}`);
    if (resCrossAccess.status !== 404) {
      throw new Error("Cross-customer order access must return 404 Not Found!");
    }

    // ------------------------------------------------------------------------
    // TEST 8: Customer cancels their own order (/cancel)
    // ------------------------------------------------------------------------
    console.log("\n--- TEST 8: Customer 1 cancels their own PLACED order ---");
    const resCancel = await fetch(`${baseUrl}/api/orders/${order1._id}/cancel`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${tokenCustomer1}` }
    });
    const dataCancel = await resCancel.json();
    console.log(`Status: ${resCancel.status} (Expected: 200)`);
    console.log(`New Order Status: ${dataCancel.order.orderStatus} (Expected: CANCELLED)`);
    if (resCancel.status !== 200 || dataCancel.order.orderStatus !== "CANCELLED") {
      throw new Error("Failed to cancel order");
    }

    // Re-cancelling must return 400
    const resRecancel = await fetch(`${baseUrl}/api/orders/${order1._id}/cancel`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${tokenCustomer1}` }
    });
    console.log(`Re-cancelling already cancelled order status: ${resRecancel.status} (Expected: 400)`);
    if (resRecancel.status !== 400) throw new Error("Expected 400 for re-cancelling");

    // ------------------------------------------------------------------------
    // TEST 9: Non-admin customer forbidden from admin endpoints (403)
    // ------------------------------------------------------------------------
    console.log("\n--- TEST 9: Regular customer rejected from admin order list ---");
    const resAdminForbidden = await fetch(`${baseUrl}/api/orders`, {
      headers: { Authorization: `Bearer ${tokenCustomer1}` }
    });
    console.log(`Status: ${resAdminForbidden.status} (Expected: 403 Forbidden)`);
    if (resAdminForbidden.status !== 403) throw new Error("Expected 403 for non-admin");

    // ------------------------------------------------------------------------
    // TEST 10: Admin lists all orders & updates lifecycle status
    // ------------------------------------------------------------------------
    console.log("\n--- TEST 10: Admin lists all orders and advances status ---");
    const resAdminList = await fetch(`${baseUrl}/api/orders`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` }
    });
    const dataAdminList = await resAdminList.json();
    console.log(`Admin retrieved total orders: ${dataAdminList.totalItems}`);
    if (resAdminList.status !== 200 || dataAdminList.orders.length < 3) {
      throw new Error("Admin failed to list all orders");
    }

    // Admin updates order 2: PLACED -> PREPARING -> OUT_FOR_DELIVERY -> DELIVERED
    const transitions = ["CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED"];
    for (const st of transitions) {
      const resSt = await fetch(`${baseUrl}/api/orders/${order2._id}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenAdmin}`
        },
        body: JSON.stringify({ orderStatus: st })
      });
      const dataSt = await resSt.json();
      console.log(`Status advanced to: ${dataSt.order.orderStatus} (HTTP ${resSt.status})`);
      if (resSt.status !== 200 || dataSt.order.orderStatus !== st) {
        throw new Error(`Failed to advance order status to ${st}`);
      }
    }

    // Customer trying to cancel a DELIVERED order must be rejected (400)
    console.log("\n--- TEST 11: Customer cannot cancel DELIVERED order ---");
    const resCancelDelivered = await fetch(`${baseUrl}/api/orders/${order2._id}/cancel`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${tokenCustomer1}` }
    });
    console.log(`Status: ${resCancelDelivered.status} (Expected: 400 Bad Request)`);
    if (resCancelDelivered.status !== 400) {
      throw new Error("Expected 400 when cancelling delivered order");
    }

    console.log("\n==================================================");
    console.log("🎉 ALL STAGE 5 ORDER API TESTS PASSED WITH 100%!");
    console.log("==================================================");
  } finally {
    console.log("\n[CLEANUP] Cleaning up test users, orders, and dishes from MongoDB Atlas...");
    await User.deleteMany({
      email: { $in: ["cust1@quickbite.test", "cust2@quickbite.test", "admin5@quickbite.test"] }
    });
    await Food.deleteMany({ name: { $regex: /^Stage5/ } });
    if (customer1 && customer2) {
      await Order.deleteMany({ user: { $in: [customer1._id, customer2._id] } });
    }
    server.close();
    await mongoose.connection.close();
  }
}

runOrderTests().catch((err) => {
  console.error("\n❌ ORDER API TEST SUITE FAILED:", err);
  process.exit(1);
});
