/**
 * QuickBite — Food API Automated Test Suite
 * Tests all Stage 4 endpoints:
 * 1. Listing foods (GET /api/foods)
 * 2. Category filtering & search (?category=, ?search=)
 * 3. Retrieving single food item (GET /api/foods/:id)
 * 4. Error handling for invalid IDs & non-existent food items
 * 5. Creating & updating food with admin authorization (POST / PUT)
 * 6. Rejecting unauthorized modifications (no token, customer token)
 * 7. Deleting food with admin authorization (DELETE)
 */

require("dotenv").config();
const http = require("http");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { connectDB } = require("./config/db");
const app = require("./server");
const User = require("./models/User");
const Food = require("./models/Food");

async function runTests() {
  console.log("=================================================");
  console.log("🧪 STARTING QUICKBITE STAGE 4 FOOD API TEST SUITE");
  console.log("=================================================");

  // Connect to database
  const connected = await connectDB();
  if (!connected) {
    throw new Error("Could not connect to MongoDB Atlas. Please check network/IP whitelist.");
  }

  // Start ephemeral server
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  let createdAdmin;
  let createdCustomer;
  let adminToken;
  let customerToken;
  let testFoodItem;

  try {
    // ------------------------------------------------------------------------
    // SETUP: Create test users (one Admin, one Customer)
    // ------------------------------------------------------------------------
    console.log("\n[SETUP] Creating test users for authorization checks...");
    await User.deleteMany({ email: { $in: ["testadmin@quickbite.test", "testcustomer@quickbite.test"] } });

    createdAdmin = await User.create({
      name: "Test Administrator",
      email: "testadmin@quickbite.test",
      password: "adminPassword123",
      role: "admin"
    });

    createdCustomer = await User.create({
      name: "Test Customer",
      email: "testcustomer@quickbite.test",
      password: "customerPassword123",
      role: "customer"
    });

    adminToken = jwt.sign({ userId: createdAdmin._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
    customerToken = jwt.sign({ userId: createdCustomer._id }, process.env.JWT_SECRET, { expiresIn: "1h" });

    console.log("✅ Test Admin & Customer created successfully.");

    // ------------------------------------------------------------------------
    // TEST 1: Reject food creation without token (401)
    // ------------------------------------------------------------------------
    console.log("\n--- TEST 1: Reject food creation without authorization token ---");
    const resNoToken = await fetch(`${baseUrl}/api/foods`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Unauthorized Pizza", price: 299, category: "Pizza" })
    });
    const dataNoToken = await resNoToken.json();
    console.log(`Status: ${resNoToken.status} (Expected: 401)`);
    console.log(`Message: ${dataNoToken.message}`);
    if (resNoToken.status !== 401) throw new Error("Expected 401 Unauthorized");

    // ------------------------------------------------------------------------
    // TEST 2: Reject food creation by customer (403 Forbidden)
    // ------------------------------------------------------------------------
    console.log("\n--- TEST 2: Reject food creation by non-admin customer ---");
    const resCustomer = await fetch(`${baseUrl}/api/foods`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerToken}`
      },
      body: JSON.stringify({ name: "Hacked Burger", price: 150, category: "Burger" })
    });
    const dataCustomer = await resCustomer.json();
    console.log(`Status: ${resCustomer.status} (Expected: 403)`);
    console.log(`Message: ${dataCustomer.message}`);
    if (resCustomer.status !== 403) throw new Error("Expected 403 Forbidden");

    // ------------------------------------------------------------------------
    // TEST 3: Create food with admin authorization (POST /api/foods -> 201)
    // ------------------------------------------------------------------------
    console.log("\n--- TEST 3: Create food item with Admin token ---");
    const resAdminCreate = await fetch(`${baseUrl}/api/foods`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: "Stage4 Tandoori Paneer Pizza",
        description: "Wood-fired crust with spiced paneer cubes and bell peppers",
        price: 349,
        category: "Pizza",
        image: "https://images.unsplash.com/photo-1513104890138-7c749659a591",
        preparationTime: 25
      })
    });
    const dataAdminCreate = await resAdminCreate.json();
    console.log(`Status: ${resAdminCreate.status} (Expected: 201)`);
    console.log(`Created Food ID: ${dataAdminCreate.food._id}`);
    console.log(`Food Name: ${dataAdminCreate.food.name}`);
    console.log(`Price: ₹${dataAdminCreate.food.price}`);
    if (resAdminCreate.status !== 201 || !dataAdminCreate.food) {
      throw new Error("Failed to create food as admin");
    }
    testFoodItem = dataAdminCreate.food;

    // Create a secondary item for category/search testing
    await fetch(`${baseUrl}/api/foods`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: "Stage4 Truffle Smash Burger",
        description: "Juicy double patty burger with black truffle mayo",
        price: 249,
        category: "Burger",
        image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd"
      })
    });

    // ------------------------------------------------------------------------
    // TEST 4: Listing all foods (GET /api/foods)
    // ------------------------------------------------------------------------
    console.log("\n--- TEST 4: Listing food catalog with pagination ---");
    const resList = await fetch(`${baseUrl}/api/foods?page=1&limit=10`);
    const dataList = await resList.json();
    console.log(`Status: ${resList.status} (Expected: 200)`);
    console.log(`Total Items: ${dataList.totalItems}`);
    console.log(`Returned Items count: ${dataList.count}`);
    console.log(`Current Page: ${dataList.currentPage} of ${dataList.totalPages}`);
    if (resList.status !== 200 || dataList.foods.length === 0) {
      throw new Error("Failed to list foods");
    }

    // ------------------------------------------------------------------------
    // TEST 5: Category filtering (?category=Pizza)
    // ------------------------------------------------------------------------
    console.log("\n--- TEST 5: Category filtering (?category=Pizza) ---");
    const resCat = await fetch(`${baseUrl}/api/foods?category=Pizza`);
    const dataCat = await resCat.json();
    console.log(`Status: ${resCat.status} (Expected: 200)`);
    console.log(`Pizzas found: ${dataCat.count}`);
    const allPizzas = dataCat.foods.every((f) => f.category.toLowerCase() === "pizza");
    console.log(`All returned items belong to category 'Pizza': ${allPizzas}`);
    if (!allPizzas) throw new Error("Category filter returned non-pizza item");

    // ------------------------------------------------------------------------
    // TEST 6: Keyword search (?search=truffle)
    // ------------------------------------------------------------------------
    console.log("\n--- TEST 6: Search query (?search=truffle) ---");
    const resSearch = await fetch(`${baseUrl}/api/foods?search=truffle`);
    const dataSearch = await resSearch.json();
    console.log(`Status: ${resSearch.status} (Expected: 200)`);
    console.log(`Search matches found: ${dataSearch.count}`);
    const foundBurger = dataSearch.foods.some((f) => f.name.includes("Truffle"));
    console.log(`Found Truffle Burger in search results: ${foundBurger}`);
    if (!foundBurger) throw new Error("Search failed to return matching food");

    // ------------------------------------------------------------------------
    // TEST 7: Retrieve single food item (GET /api/foods/:id)
    // ------------------------------------------------------------------------
    console.log("\n--- TEST 7: Retrieve single food item by ID ---");
    const resSingle = await fetch(`${baseUrl}/api/foods/${testFoodItem._id}`);
    const dataSingle = await resSingle.json();
    console.log(`Status: ${resSingle.status} (Expected: 200)`);
    console.log(`Retrieved Food Name: ${dataSingle.food.name}`);
    if (resSingle.status !== 200 || dataSingle.food._id !== testFoodItem._id) {
      throw new Error("Failed to retrieve single food item");
    }

    // ------------------------------------------------------------------------
    // TEST 8: Invalid ID format and non-existent item (400 & 404)
    // ------------------------------------------------------------------------
    console.log("\n--- TEST 8: Error handling for invalid IDs and missing food ---");
    const resInvalidId = await fetch(`${baseUrl}/api/foods/invalid-mongo-id-123`);
    const dataInvalidId = await resInvalidId.json();
    console.log(`Invalid ID Status: ${resInvalidId.status} (Expected: 400)`);
    console.log(`Invalid ID Message: ${dataInvalidId.message}`);

    const nonExistentId = new mongoose.Types.ObjectId();
    const resNotFound = await fetch(`${baseUrl}/api/foods/${nonExistentId}`);
    const dataNotFound = await resNotFound.json();
    console.log(`Non-existent ID Status: ${resNotFound.status} (Expected: 404)`);
    console.log(`Not Found Message: ${dataNotFound.message}`);

    if (resInvalidId.status !== 400 || resNotFound.status !== 404) {
      throw new Error("Invalid ID or 404 handling failed");
    }

    // ------------------------------------------------------------------------
    // TEST 9: Update food item with Admin token (PUT /api/foods/:id)
    // ------------------------------------------------------------------------
    console.log("\n--- TEST 9: Update food item with Admin authorization ---");
    const resUpdate = await fetch(`${baseUrl}/api/foods/${testFoodItem._id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        price: 399,
        description: "Updated: Now with extra gourmet cheese blend!"
      })
    });
    const dataUpdate = await resUpdate.json();
    console.log(`Status: ${resUpdate.status} (Expected: 200)`);
    console.log(`Updated Price: ₹${dataUpdate.food.price} (Old was: ₹${testFoodItem.price})`);
    console.log(`Updated Description: ${dataUpdate.food.description}`);
    if (resUpdate.status !== 200 || dataUpdate.food.price !== 399) {
      throw new Error("Failed to update food item");
    }

    // ------------------------------------------------------------------------
    // TEST 10: Delete food item with Admin token (DELETE /api/foods/:id)
    // ------------------------------------------------------------------------
    console.log("\n--- TEST 10: Delete food item with Admin authorization ---");
    const resDelete = await fetch(`${baseUrl}/api/foods/${testFoodItem._id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${adminToken}`
      }
    });
    const dataDelete = await resDelete.json();
    console.log(`Status: ${resDelete.status} (Expected: 200)`);
    console.log(`Message: ${dataDelete.message}`);
    if (resDelete.status !== 200) throw new Error("Failed to delete food item");

    // Verify it is actually deleted (should return 404 now)
    const resVerifyDelete = await fetch(`${baseUrl}/api/foods/${testFoodItem._id}`);
    console.log(`Fetch deleted item status: ${resVerifyDelete.status} (Expected: 404)`);
    if (resVerifyDelete.status !== 404) throw new Error("Food item was not deleted");

    console.log("\n=================================================");
    console.log("🎉 ALL STAGE 4 FOOD API TESTS PASSED SUCCESSFULLY!");
    console.log("=================================================");
  } finally {
    // Clean up test data
    console.log("\n[CLEANUP] Removing test records...");
    await User.deleteMany({ email: { $in: ["testadmin@quickbite.test", "testcustomer@quickbite.test"] } });
    await Food.deleteMany({ name: { $regex: /^Stage4/ } });
    server.close();
    await mongoose.connection.close();
  }
}

runTests().catch((err) => {
  console.error("\n❌ TEST SUITE FAILED:", err);
  process.exit(1);
});
