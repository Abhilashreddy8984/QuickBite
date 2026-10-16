/**
 * QuickBite — Full-Stack End-to-End Integration Test Suite (Stage 6)
 * Simulates complete browser-to-backend user journey:
 * 1. Fetching live food menu catalog from MongoDB Atlas (GET /api/foods)
 * 2. Testing category filtering (?category=Pizza) and search (?search=biryani)
 * 3. New customer registration (POST /api/auth/register)
 * 4. Customer login and session token validation (POST /api/auth/login, GET /api/auth/profile)
 * 5. Order placement with server-side price calculation (POST /api/orders)
 * 6. Order history inspection (GET /api/orders/myorders)
 * 7. Live customer order cancellation (PUT /api/orders/:id/cancel)
 * 8. Privacy guard: Another user probing order returns 404
 */

require("dotenv").config();
const http = require("http");
const mongoose = require("mongoose");
const { connectDB } = require("./config/db");
const app = require("./server");
const User = require("./models/User");
const Food = require("./models/Food");
const Order = require("./models/Order");

async function runIntegrationTest() {
  console.log("==========================================================");
  console.log("🚀 QUICKBITE STAGE 6 FULL-STACK INTEGRATION TEST SUITE");
  console.log("==========================================================");

  const connected = await connectDB();
  if (!connected) {
    throw new Error("Could not connect to MongoDB Atlas.");
  }

  // Start server on port 5000 (or random if port 5000 is occupied)
  const server = http.createServer(app);
  let port = 5000;
  try {
    await new Promise((resolve, reject) => {
      server.listen(port, resolve).on("error", (err) => {
        if (err.code === "EADDRINUSE") {
          console.log("Port 5000 in use, selecting ephemeral port...");
          server.listen(0, resolve);
        } else {
          reject(err);
        }
      });
    });
  } catch (e) {
    await new Promise((resolve) => server.listen(0, resolve));
  }
  port = server.address().port;
  const baseUrl = `http://localhost:${port}/api`;
  console.log(`📡 Test server active at: ${baseUrl}\n`);

  let customerToken;
  let customerUser;
  let createdOrderId;

  try {
    // ------------------------------------------------------------------------
    // STEP 1: Food Catalog Fetching (TASK 1)
    // ------------------------------------------------------------------------
    console.log("--- STEP 1: Fetching Live Menu Catalog from MongoDB Atlas ---");
    const resFoods = await fetch(`${baseUrl}/foods`);
    const dataFoods = await resFoods.json();
    console.log(`Status: ${resFoods.status} (Expected: 200)`);
    console.log(`Dishes loaded from MongoDB Atlas: ${dataFoods.count}`);
    if (resFoods.status !== 200 || !dataFoods.foods || dataFoods.foods.length === 0) {
      throw new Error("Menu loading failed: No dishes returned from database.");
    }
    const sampleItem1 = dataFoods.foods[0];
    const sampleItem2 = dataFoods.foods[1];
    console.log(`Sample item 1: "${sampleItem1.name}" (₹${sampleItem1.price}, Cat: ${sampleItem1.category})`);
    console.log(`Sample item 2: "${sampleItem2.name}" (₹${sampleItem2.price}, Cat: ${sampleItem2.category})`);

    // ------------------------------------------------------------------------
    // STEP 2: Category Filtering and Search (TASK 1)
    // ------------------------------------------------------------------------
    console.log("\n--- STEP 2: Testing Category Filtering and Search ---");
    const resPizzas = await fetch(`${baseUrl}/foods?category=Pizza`);
    const dataPizzas = await resPizzas.json();
    console.log(`Filter ?category=Pizza returned: ${dataPizzas.count} items`);
    const onlyPizzas = dataPizzas.foods.every((f) => f.category.toLowerCase() === "pizza");
    console.log(`All items match Pizza category: ${onlyPizzas}`);
    if (!onlyPizzas) throw new Error("Category filter returned wrong category.");

    const resSearch = await fetch(`${baseUrl}/foods?search=biryani`);
    const dataSearch = await resSearch.json();
    console.log(`Search ?search=biryani returned: ${dataSearch.count} items`);
    const foundBiryani = dataSearch.foods.some((f) => f.name.toLowerCase().includes("biryani"));
    console.log(`Search matches Biryani keyword: ${foundBiryani}`);
    if (!foundBiryani) throw new Error("Search failed for keyword 'biryani'.");

    // ------------------------------------------------------------------------
    // STEP 3: Customer Registration (TASK 2)
    // ------------------------------------------------------------------------
    console.log("\n--- STEP 3: Registering a New Customer Account ---");
    const testEmail = `e2e_student_${Date.now()}@college.edu`;
    const resRegister = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Priya Sharma",
        email: testEmail,
        password: "securePassword123"
      })
    });
    const dataRegister = await resRegister.json();
    console.log(`Registration Status: ${resRegister.status} (Expected: 201)`);
    console.log(`Message: ${dataRegister.message}`);
    console.log(`Registered User Name: ${dataRegister.user.name}`);
    console.log(`Registered User Role: ${dataRegister.user.role} (Customer - uncompromised)`);
    console.log(`Password excluded from response: ${dataRegister.user.password === undefined}`);
    if (resRegister.status !== 201 || !dataRegister.token) {
      throw new Error("Registration failed.");
    }
    customerToken = dataRegister.token;
    customerUser = dataRegister.user;

    // ------------------------------------------------------------------------
    // STEP 4: Customer Login & Session Verification (TASK 2)
    // ------------------------------------------------------------------------
    console.log("\n--- STEP 4: Authenticating Customer via Login ---");
    const resLogin = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: "securePassword123"
      })
    });
    const dataLogin = await resLogin.json();
    console.log(`Login Status: ${resLogin.status} (Expected: 200)`);
    console.log(`Login Message: ${dataLogin.message}`);
    if (resLogin.status !== 200 || !dataLogin.token) {
      throw new Error("Login failed.");
    }

    // Verify session with /auth/profile
    const resProfile = await fetch(`${baseUrl}/auth/profile`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    const dataProfile = await resProfile.json();
    console.log(`Profile check status: ${resProfile.status} (Expected: 200)`);
    console.log(`Authenticated as: ${dataProfile.user.name} (${dataProfile.user.email})`);
    if (resProfile.status !== 200) throw new Error("Profile verification failed.");

    // ------------------------------------------------------------------------
    // STEP 5: Placing Authenticated Order with Server-Side Pricing (TASKS 3, 4, 7)
    // ------------------------------------------------------------------------
    console.log("\n--- STEP 5: Submitting Order (Cash on Delivery) ---");
    const qty1 = 2;
    const qty2 = 1;
    const expectedSubtotal = sampleItem1.price * qty1 + sampleItem2.price * qty2;
    const expectedDelivery = expectedSubtotal >= 500 ? 0 : 40;
    const expectedTax = Math.round(expectedSubtotal * 0.05);
    const expectedTotal = expectedSubtotal + expectedDelivery + expectedTax;

    const resPlaceOrder = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerToken}`
      },
      body: JSON.stringify({
        items: [
          { foodId: sampleItem1._id, quantity: qty1, price: 5 }, // Client tries to fake ₹5 price
          { foodId: sampleItem2._id, quantity: qty2, price: 5 }
        ],
        deliveryAddress: "Flat 204, Campus Towers, Hyderabad (Phone: 9876543210)",
        paymentMethod: "COD"
      })
    });

    const dataPlaceOrder = await resPlaceOrder.json();
    console.log(`Order Placement Status: ${resPlaceOrder.status} (Expected: 201)`);
    console.log(`Server-calculated Subtotal: ₹${dataPlaceOrder.order.subtotal} (Expected: ₹${expectedSubtotal})`);
    console.log(`Server-calculated Delivery Fee: ₹${dataPlaceOrder.order.deliveryFee} (Expected: ₹${expectedDelivery})`);
    console.log(`Server-calculated Tax (5% GST): ₹${dataPlaceOrder.order.tax} (Expected: ₹${expectedTax})`);
    console.log(`Server-calculated Grand Total: ₹${dataPlaceOrder.order.totalAmount} (Expected: ₹${expectedTotal})`);
    console.log(`Payment Method: ${dataPlaceOrder.order.paymentMethod} (COD active)`);
    console.log(`Payment Status: ${dataPlaceOrder.order.paymentStatus} (PENDING until doorstep arrival)`);

    if (
      resPlaceOrder.status !== 201 ||
      dataPlaceOrder.order.totalAmount !== expectedTotal
    ) {
      throw new Error("Server-side order calculation mismatch!");
    }
    createdOrderId = dataPlaceOrder.order._id;

    // ------------------------------------------------------------------------
    // STEP 6: Customer Retrieves Order History (TASK 5)
    // ------------------------------------------------------------------------
    console.log("\n--- STEP 6: Retrieving Customer's Order History (/myorders) ---");
    const resMyOrders = await fetch(`${baseUrl}/orders/myorders`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    const dataMyOrders = await resMyOrders.json();
    console.log(`My Orders Status: ${resMyOrders.status} (Expected: 200)`);
    console.log(`Total orders for customer: ${dataMyOrders.count}`);
    const foundCreatedOrder = dataMyOrders.orders.some((o) => o._id === createdOrderId);
    console.log(`Created order found in history: ${foundCreatedOrder}`);
    if (resMyOrders.status !== 200 || !foundCreatedOrder) {
      throw new Error("Created order missing from /myorders.");
    }

    // ------------------------------------------------------------------------
    // STEP 7: Customer Cancels Order (TASK 5)
    // ------------------------------------------------------------------------
    console.log("\n--- STEP 7: Customer Cancels Their Own Order (/cancel) ---");
    const resCancel = await fetch(`${baseUrl}/orders/${createdOrderId}/cancel`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    const dataCancel = await resCancel.json();
    console.log(`Cancel Status: ${resCancel.status} (Expected: 200)`);
    console.log(`Updated Order Status: ${dataCancel.order.orderStatus} (Expected: CANCELLED)`);
    if (resCancel.status !== 200 || dataCancel.order.orderStatus !== "CANCELLED") {
      throw new Error("Failed to cancel order.");
    }

    // ------------------------------------------------------------------------
    // STEP 8: Security Check: Cross-Customer Privacy (TASK 6)
    // ------------------------------------------------------------------------
    console.log("\n--- STEP 8: Cross-Customer Privacy Guard ---");
    const secondUser = await User.create({
      name: "Another Student",
      email: `other_${Date.now()}@college.edu`,
      password: "password123",
      role: "customer"
    });
    const otherToken = require("jsonwebtoken").sign(
      { userId: secondUser._id },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    const resPrivacy = await fetch(`${baseUrl}/orders/${createdOrderId}`, {
      headers: { Authorization: `Bearer ${otherToken}` }
    });
    console.log(`Unauthorized order lookup status: ${resPrivacy.status} (Expected: 404 Not Found)`);
    if (resPrivacy.status !== 404) {
      throw new Error("Privacy vulnerability: Customer B could see Customer A's order!");
    }
    console.log("✅ Privacy guard verified: Another user gets 404 Not Found.");

    console.log("\n==========================================================");
    console.log("🎉 ALL STAGE 6 INTEGRATION TESTS PASSED WITH 100% SUCCESS!");
    console.log("==========================================================");
  } finally {
    console.log("\n[CLEANUP] Cleaning up test orders and temporary users...");
    if (createdOrderId) {
      await Order.findByIdAndDelete(createdOrderId);
    }
    if (customerUser) {
      await User.findByIdAndDelete(customerUser.id);
    }
    await User.deleteMany({ email: { $regex: /@college\.edu$/ } });
    server.close();
    await mongoose.connection.close();
  }
}

runIntegrationTest().catch((err) => {
  console.error("\n❌ INTEGRATION TEST FAILED:", err);
  process.exit(1);
});
