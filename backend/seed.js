/**
 * QuickBite — Database Seeder Script
 * Populates MongoDB Atlas with sample food items and an initial admin account.
 * 
 * Usage:
 *   node seed.js
 *   npm run seed
 */

require("dotenv").config();
const mongoose = require("mongoose");
const { connectDB } = require("./config/db");
const Food = require("./models/Food");
const User = require("./models/User");

const SAMPLE_FOODS = [
  {
    name: "Margherita Supreme Pizza",
    category: "Pizza",
    price: 299,
    preparationTime: 20,
    isAvailable: true,
    description: "Classic hand-tossed crust with rich tomato passata, fresh mozzarella cheese, and fragrant basil.",
    image: "https://images.unsplash.com/photo-1604382355076-af4b0eb60143?auto=format&fit=crop&w=600&q=80"
  },
  {
    name: "Double Cheese Smash Burger",
    category: "Burger",
    price: 199,
    preparationTime: 15,
    isAvailable: true,
    description: "Two grilled juicy patties topped with melted sharp cheddar, caramelized onions, and secret sauce.",
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80"
  },
  {
    name: "Hyderabadi Dum Biryani",
    category: "Biryani",
    price: 349,
    preparationTime: 30,
    isAvailable: true,
    description: "Fragrant basmati rice layered with slow-cooked marinated spices, saffron, and tender choice pieces.",
    image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80"
  },
  {
    name: "Pepperoni Feast Pizza",
    category: "Pizza",
    price: 399,
    preparationTime: 20,
    isAvailable: true,
    description: "Generously loaded with spicy Italian-style pepperoni, bubbling mozzarella, and oregano drizzle.",
    image: "https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&w=600&q=80"
  },
  {
    name: "Crispy Paneer Tikka Burger",
    category: "Burger",
    price: 179,
    preparationTime: 15,
    isAvailable: true,
    description: "Crunchy spiced cottage cheese patty, mint mayo, crunchy lettuce, and sliced red onions on brioche.",
    image: "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=600&q=80"
  },
  {
    name: "Royal Lucknowi Veg Biryani",
    category: "Biryani",
    price: 279,
    preparationTime: 25,
    isAvailable: true,
    description: "Aromatic long-grain basmati rice cooked with fresh seasonal garden vegetables and shahi spices.",
    image: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=600&q=80"
  },
  {
    name: "Molten Choco Lava Cake",
    category: "Dessert",
    price: 149,
    preparationTime: 10,
    isAvailable: true,
    description: "Decadent warm chocolate cake with a rich, velvety molten chocolate ganache center.",
    image: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=600&q=80"
  },
  {
    name: "New York Creamy Cheesecake",
    category: "Dessert",
    price: 189,
    preparationTime: 10,
    isAvailable: true,
    description: "Smooth and velvety baked cheesecake on a golden buttery graham cracker crust.",
    image: "https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=600&q=80"
  },
  {
    name: "Classic Mint Mojito Cooler",
    category: "Beverage",
    price: 99,
    preparationTime: 5,
    isAvailable: true,
    description: "Zesty lime, fresh crushed garden mint leaves, chilled sparkling soda, and cane sugar.",
    image: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80"
  },
  {
    name: "Mango Alphonso Thick Shake",
    category: "Beverage",
    price: 129,
    preparationTime: 5,
    isAvailable: true,
    description: "Real Alphonso mango pulp blended with rich vanilla ice cream and topped with pistachio flakes.",
    image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=600&q=80"
  },
  {
    name: "Farmhouse Veggie Delight Pizza",
    category: "Pizza",
    price: 329,
    preparationTime: 20,
    isAvailable: true,
    description: "Loaded with black olives, crunchy bell peppers, sweet corn, sliced button mushrooms, and extra cheese.",
    image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80"
  },
  {
    name: "Peri-Peri Crispy Chicken Burger",
    category: "Burger",
    price: 219,
    preparationTime: 15,
    isAvailable: true,
    description: "Crispy fried spiced chicken fillet tossed in fiery African peri-peri seasoning with garlic aioli.",
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80"
  }
];

async function seedDatabase() {
  console.log("==============================================");
  console.log("🌱 SEEDING QUICKBITE DATABASE (MONGODB ATLAS)");
  console.log("==============================================");

  const connected = await connectDB();
  if (!connected) {
    console.error("❌ Seeding failed: Could not connect to MongoDB Atlas.");
    process.exit(1);
  }

  try {
    // 1. Clear existing food catalog
    console.log("Clearing existing food items...");
    await Food.deleteMany({});

    // 2. Insert sample food items
    console.log(`Inserting ${SAMPLE_FOODS.length} sample food items...`);
    const insertedFoods = await Food.insertMany(SAMPLE_FOODS);
    console.log(`✅ Successfully seeded ${insertedFoods.length} food items into MongoDB Atlas!\n`);

    // 3. Ensure a demo Admin account exists
    const adminEmail = "admin@quickbite.com";
    const existingAdmin = await User.findOne({ email: adminEmail });
    if (!existingAdmin) {
      console.log(`Creating demo admin user (${adminEmail})...`);
      await User.create({
        name: "QuickBite Admin",
        email: adminEmail,
        password: "adminPassword123",
        role: "admin"
      });
      console.log("✅ Demo admin created: admin@quickbite.com / adminPassword123\n");
    } else {
      console.log(`ℹ️  Demo admin (${adminEmail}) already exists.\n`);
    }

    console.log("==============================================");
    console.log("🎉 DATABASE SEEDING COMPLETED SUCCESSFULLY!");
    console.log("==============================================");
    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed with error:", error);
    process.exit(1);
  }
}

seedDatabase();
