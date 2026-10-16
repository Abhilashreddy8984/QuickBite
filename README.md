# QuickBite — Online Food Ordering Website

A full-stack college project demonstrating modern web development principles, responsive UI/UX, RESTful API architecture, and database persistence.

---

## 📌 Project Overview

**QuickBite** is an online food ordering platform designed for college and academic demonstrations. It enables customers to explore diverse food menus, filter by categories, search dishes in real time, customize cart quantities, and place orders with server-side bill verification.

### Key Objectives
* **Responsive Frontend**: Built with semantic HTML5, modern CSS3 (Flexbox/Grid, variables, mobile-first responsiveness), and vanilla JavaScript.
* **Separation of Concerns**: Dedicated client frontend and isolated Node.js/Express backend.
* **Secure Authentication**: User registration and login utilizing `bcrypt` password hashing and stateless `jsonwebtoken` (JWT).
* **Integrity in Billing**: Server-side price calculation fetching verified item prices from MongoDB to prevent client-side cart tampering.
* **Database Persistence**: MongoDB Atlas / local MongoDB with Mongoose schemas for Users, Food Items, and Orders.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | HTML5, CSS3, Vanilla JavaScript (ES6+) |
| **Backend** | Node.js, Express.js |
| **Database** | MongoDB Atlas / MongoDB Community with Mongoose ODM |
| **Authentication** | JSON Web Tokens (JWT) & bcrypt password hashing |
| **Environment** | `dotenv`, `cors` |

---

## 📁 Project Structure

```
quickbite/
├── index.html          # Main HTML structure with semantic sections and modals
├── style.css           # Custom responsive styles, CSS variables, and layout rules
├── script.js           # Client-side state, cart engine, search/filter, and modal logic
├── README.md           # Project documentation and setup guide
└── backend/            # (Stages 2–5) Express & MongoDB API server
    ├── config/         # Database connection configuration
    ├── controllers/    # Request handlers (auth, foods, orders)
    ├── middleware/     # JWT authentication & error handling
    ├── models/         # Mongoose schemas (User, Food, Order)
    ├── routes/         # Express API route declarations
    ├── seed.js         # Food catalog database populator
    └── server.js       # Express application entrypoint
```

---

## 🚀 Stage 1: Frontend Preview & Testing

The frontend is fully functional in standalone preview mode. It includes sample menu data so you can test all UI interactions before the backend is connected.

### Option A: Using Python Simple HTTP Server
If you have Python installed:
```powershell
python -m http.server 3000
```
Then open your browser at: `http://localhost:3000`

### Option B: Using Node.js `npx serve`
If you have Node.js installed:
```powershell
npx serve .
```

### Option C: Direct File Opening
You can double-click `index.html` or open it directly in Chrome, Edge, Firefox, or Safari.

---

## 🧪 Features Implemented in Stage 1

1. **Responsive Navbar**:
   * Brand identity with animated badge.
   * Real-time search bar with instant clear button.
   * Dynamic Cart Counter badge reflecting active quantity.
   * User profile state with dropdown menu (My Orders & Logout).
   * Mobile-responsive collapsible navigation drawer.

2. **Hero Section**:
   * Value proposition highlights ("30 Min Delivery", "4.9★ Customer Rating").
   * Call to action buttons with smooth scrolling to `#menu`.

3. **Food Catalog & Filtering**:
   * Category filter pills (*All Dishes, Pizzas, Burgers, Biryani, Desserts, Beverages*).
   * Live keyword search filtering through food names, descriptions, and categories.
   * Interactive food cards with high-definition food imagery, category tags, ratings, and price tags in ₹.
   * In-card quantity steppers (`−` and `+`) when an item is added to the cart.

4. **Interactive Shopping Cart Drawer**:
   * Slide-in overlay drawer with full screen-reader accessibility.
   * Item list with thumbnails, individual prices, total per line, and quantity controls.
   * Transparent bill summary breakdown: **Subtotal**, **Delivery Fee** (Free above ₹500), **Taxes & GST (5%)**, and **Grand Total**.
   * Automatic persistence via `localStorage`.

5. **Client-Side Validated Checkout**:
   * Full Name, 10-digit Phone, and Delivery Address validation.
   * Demo Cash on Delivery (COD) payment method selector.
   * Order summary preview.

6. **Authentication Modals (Sign In / Register)**:
   * Tabbed interface for switching between Sign In and Account Creation.
   * Regex email format verification and minimum password length enforcement.
   * Password confirmation matching validation.

7. **My Orders Interface**:
   * Modal displaying order history, date/time timestamps, delivery address, ordered items, and total amount.
   * Clean empty state illustration when no orders exist.

8. **Toast Notifications**:
   * Non-intrusive animated status alerts for cart additions, removals, validation errors, and order placements.

---

## ⚙️ Stage 2: Express Backend Setup & Verification

The Node.js and Express backend server is configured in the `backend/` directory.

### Quick Start: Backend Server

1. **Navigate to the backend directory**:
   ```powershell
   cd backend
   ```

2. **Configure Environment Variables**:
   Copy `.env.example` to `.env`:
   ```powershell
   Copy-Item .env.example .env
   ```
   Open `backend/.env` and configure:
   * `PORT`: Server port (default: `5000`)
   * `MONGODB_URI`: Your MongoDB Atlas or local MongoDB connection URI
   * `JWT_SECRET`: A secure random secret key (minimum 32 characters)
   * `FRONTEND_URL`: Allowed origins for CORS (e.g. `http://localhost:3000,http://127.0.0.1:3000`)

3. **Install Dependencies** (already installed in workspace):
   ```powershell
   npm install
   ```

4. **Run the Development Server**:
   ```powershell
   npm run dev
   ```
   Or production mode:
   ```powershell
   npm start
   ```

5. **Test the Health Check Endpoint**:
   ```powershell
   curl http://localhost:5000/api/health
   ```
   Or in PowerShell:
   ```powershell
   Invoke-RestMethod -Uri "http://localhost:5000/api/health"
   ```

   **Expected Health Check Output**:
   ```json
   {
     "status": "OK",
     "message": "QuickBite Express API server is healthy and responding.",
     "timestamp": "2026-10-16T13:50:12.238Z",
     "environment": "development",
     "database": {
       "status": "disconnected",
       "connected": false,
       "note": "Database not connected. Provide valid MONGODB_URI in backend/.env for database features."
     }
   }
   ```

---

## 🍽️ Stage 4: Food Catalog & Management API

### Endpoints Reference

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/foods` | Public | Returns available food items. Supports `?category=Pizza`, `?search=burger`, `?page=1&limit=10`. |
| `GET` | `/api/foods/:id` | Public | Returns single food item details by MongoDB ID. |
| `POST` | `/api/foods` | Private (Admin) | Creates a new food item. Requires JWT token with `role: "admin"`. |
| `PUT` | `/api/foods/:id` | Private (Admin) | Updates existing food item. Requires JWT token with `role: "admin"`. |
| `DELETE` | `/api/foods/:id` | Private (Admin) | Deletes food item. Requires JWT token with `role: "admin"`. |

### Running Automated Food API Tests
```powershell
cd backend
npm run test:food
```

---

## 📦 Stage 5: Order Processing & Lifecycle API

### Server-Side Integrity & Pricing Rules
* **Client Anti-Tampering**: Food prices, subtotals, delivery fees, and grand totals sent in request payloads are completely ignored. All prices are read freshly from the MongoDB `Food` collection.
* **Delivery Fee**: Free (₹0) on orders with subtotal ₹500 or greater; ₹40 on orders under ₹500.
* **Taxes**: Transparent 5% GST calculated on the subtotal.
* **Customer Isolation**: A customer can only access their own orders in `GET /api/orders/myorders` and `GET /api/orders/:id`. Accessing another customer's order ID returns `404 Not Found` to prevent order existence probing.
* **Order Cancellation Rules**: Customers can cancel their own orders while in `PLACED` or `CONFIRMED` status. Once an order reaches `PREPARING`, `OUT_FOR_DELIVERY`, or `DELIVERED`, cancellation is blocked with `400 Bad Request`.

### Order Endpoints Reference

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/orders` | Private (Customer) | Places order with server-calculated totals. Body: `{ items: [{ foodId, quantity }], deliveryAddress, paymentMethod }`. |
| `GET` | `/api/orders/myorders` | Private (Customer) | Retrieves the authenticated customer's order history (newest first) with pagination. |
| `GET` | `/api/orders/:id` | Private (Owner/Admin) | Retrieves single order details. Returns `404` if requested by another customer. |
| `PUT` | `/api/orders/:id/cancel` | Private (Owner/Admin) | Cancels an order (allowed only if `PLACED` or `CONFIRMED`). |
| `GET` | `/api/orders` | Private (Admin only) | Lists all customer orders across the platform with pagination. |
| `PUT` | `/api/orders/:id/status` | Private (Admin only) | Updates order lifecycle status (`CONFIRMED`, `PREPARING`, `OUT_FOR_DELIVERY`, `DELIVERED`, `CANCELLED`). |

### Running Order API Tests
```powershell
cd backend
npm run test:order
```
Or run the entire backend test suite (Food + Order APIs):
```powershell
npm test
```

---

## 🚀 Stage 6: Full-Stack Integration & Live Operation

The vanilla HTML/CSS/JavaScript frontend is fully wired to the Express.js and MongoDB Atlas backend.

### Full-Stack Architecture Flow

```
[Browser Frontend (index.html / script.js)]
       │
       ├── 1. Dynamic Catalog:  GET /api/foods (Search, Category Filter, MongoDB IDs)
       ├── 2. Authentication:   POST /api/auth/register & POST /api/auth/login (JWT stored in localStorage)
       ├── 3. Session Check:    GET /api/auth/profile (Bearer <token>)
       ├── 4. Order Placement:  POST /api/orders (Food IDs + quantities, server-calculated totals, COD)
       ├── 5. Order History:    GET /api/orders/myorders (Customer's orders only, newest first)
       └── 6. Cancellation:     PUT /api/orders/:id/cancel (Live cancellation of unfulfilled orders)
       │
[Express Backend Server (http://localhost:5000/api)]
       │
[MongoDB Atlas Cloud Database ("quickbite")]
       ├── Users (bcrypt salted hashes, customer & admin roles)
       ├── Foods (dishes, categories, verified prices, availability)
       └── Orders (user reference, frozen item snapshots, server totals, tracking status)
```

---

## 🏃‍♂️ Step-by-Step Instructions to Run the Project Locally

### 1. Database Seeding (First Time Setup)
Populate your MongoDB Atlas cluster with 12 authentic dishes and a demo admin account:
```powershell
cd c:\Users\abhil\OneDrive\Desktop\25r21a66e3\quickbite\backend
npm run seed
```

### 2. Start the Backend API Server
```powershell
npm run dev
# (or for standard mode: npm start)
```
* The backend will listen at `http://localhost:5000`.
* Verify health check: `http://localhost:5000/api/health`.

### 3. Open the Frontend
In a second terminal, start an HTTP server in the project root:
```powershell
cd c:\Users\abhil\OneDrive\Desktop\25r21a66e3\quickbite
python -m http.server 3000
```
Then visit **`http://localhost:3000`** in your browser.

---

## 🧪 Running the Complete Automated Test Suite

QuickBite includes dedicated test suites for the Food API, Order API, and Full-Stack End-to-End integration:

```powershell
cd c:\Users\abhil\OneDrive\Desktop\25r21a66e3\quickbite\backend

# Run Food API tests (10 test scenarios)
npm run test:food

# Run Order API tests (11 test scenarios)
npm run test:order

# Run End-to-End Full-Stack Integration tests (8 test scenarios)
npm run test:e2e

# Run all test suites sequentially
npm test
```

---

## 🎓 Viva & College Project Demonstration Highlights

1. **How is password security handled?**
   * Passwords are salted with 10 rounds and hashed using `bcryptjs` in a Mongoose pre-save hook before being written to MongoDB. Raw passwords or hashes are **never** returned in API responses.
2. **How is price tampering prevented?**
   * The client only submits food IDs and quantities. The backend server queries the database for the active prices, recalculates the subtotal, calculates taxes (5% GST), applies the delivery fee rule (free above ₹500), and computes the total amount. Client-supplied totals are strictly ignored.
3. **How does authentication work?**
   * Stateless JSON Web Tokens (JWT) signed with `process.env.JWT_SECRET` and a 1-hour expiration. The client sends `Authorization: Bearer <token>` for protected actions.
4. **How are customer orders kept private?**
   * In `GET /api/orders/myorders`, queries filter by `req.user._id`. If a user attempts to access another customer's order ID in `GET /api/orders/:id`, the server responds with `404 Not Found` rather than `403` to prevent ID harvesting.



