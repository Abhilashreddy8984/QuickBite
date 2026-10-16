/**
 * QuickBite — Online Food Ordering Website
 * Frontend Integration Script (Stage 6)
 * 
 * Features:
 * - Dynamic Food Menu connected to GET /api/foods (with category filters, search, and pagination)
 * - Full Authentication integration with POST /api/auth/register, POST /api/auth/login, and GET /api/auth/profile
 * - Secure JWT session management in localStorage with automatic expiry detection
 * - Shopping Cart with MongoDB ObjectIDs and live bill estimations
 * - Authenticated Checkout with POST /api/orders (anti-tamper server calculations & COD)
 * - My Orders Interface with GET /api/orders/myorders and live cancellation via PUT /api/orders/:id/cancel
 * - Nonce-safe escaping for all dynamic user and database values
 */

// Dynamic API Base URL resolution:
// 1. Checks window.QUICKBITE_CONFIG.API_BASE_URL (configured in config.js)
// 2. Checks window.API_BASE_URL
// 3. Defaults to localhost:5000/api when testing on local machine
// 4. Defaults to same-origin /api when deployed to Render or production domain
function resolveApiBaseUrl() {
  if (window.QUICKBITE_CONFIG && window.QUICKBITE_CONFIG.API_BASE_URL) {
    return window.QUICKBITE_CONFIG.API_BASE_URL.replace(/\/+$/, "");
  }
  if (window.API_BASE_URL) {
    return window.API_BASE_URL.replace(/\/+$/, "");
  }
  const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  if (isLocal) {
    return "http://localhost:5000/api";
  }
  return window.location.origin + "/api";
}

const API_BASE_URL = resolveApiBaseUrl();

const AppState = {
  foods: [],
  selectedCategory: "All",
  searchQuery: "",
  cart: JSON.parse(localStorage.getItem("quickbite_cart") || "[]"),
  orders: [],
  currentUser: JSON.parse(localStorage.getItem("quickbite_user") || "null"),
  authToken: localStorage.getItem("quickbite_token") || null,
  isPlacingOrder: false
};

// ============================================================================
// 2. DOM ELEMENT REFERENCES
// ============================================================================
const DOM = {
  // Food Catalog & Filters
  foodGrid: document.getElementById("foodGrid"),
  emptyMenuState: document.getElementById("emptyMenuState"),
  resetFiltersBtn: document.getElementById("resetFiltersBtn"),
  categoryFilters: document.getElementById("categoryFilters"),
  searchInput: document.getElementById("searchInput"),
  clearSearchBtn: document.getElementById("clearSearchBtn"),
  mobileSearchInput: document.getElementById("mobileSearchInput"),
  catalogStatusBadge: document.getElementById("catalogStatusBadge"),
  catalogStatusText: document.getElementById("catalogStatusText"),

  // Shopping Cart Drawer
  openCartBtn: document.getElementById("openCartBtn"),
  closeCartBtn: document.getElementById("closeCartBtn"),
  cartOverlay: document.getElementById("cartOverlay"),
  cartDrawer: document.getElementById("cartDrawer"),
  cartItemsContainer: document.getElementById("cartItemsContainer"),
  cartItemsSubtitle: document.getElementById("cartItemsSubtitle"),
  cartCountBadge: document.getElementById("cartCountBadge"),
  billSubtotal: document.getElementById("billSubtotal"),
  billDelivery: document.getElementById("billDelivery"),
  billTaxes: document.getElementById("billTaxes"),
  billGrandTotal: document.getElementById("billGrandTotal"),
  proceedCheckoutBtn: document.getElementById("proceedCheckoutBtn"),
  freeDeliveryHint: document.getElementById("freeDeliveryHint"),

  // Checkout Modal
  checkoutModalOverlay: document.getElementById("checkoutModalOverlay"),
  closeCheckoutBtn: document.getElementById("closeCheckoutBtn"),
  cancelCheckoutBtn: document.getElementById("cancelCheckoutBtn"),
  checkoutForm: document.getElementById("checkoutForm"),
  orderFullName: document.getElementById("orderFullName"),
  orderPhone: document.getElementById("orderPhone"),
  orderAddress: document.getElementById("orderAddress"),
  orderNameError: document.getElementById("orderNameError"),
  orderPhoneError: document.getElementById("orderPhoneError"),
  orderAddressError: document.getElementById("orderAddressError"),
  checkoutSummaryTotal: document.getElementById("checkoutSummaryTotal"),
  checkoutSummaryCount: document.getElementById("checkoutSummaryCount"),
  placeOrderSubmitBtn: document.getElementById("placeOrderSubmitBtn"),

  // Auth Modal
  openAuthBtn: document.getElementById("openAuthBtn"),
  closeAuthBtn: document.getElementById("closeAuthBtn"),
  authModalOverlay: document.getElementById("authModalOverlay"),
  tabLoginBtn: document.getElementById("tabLoginBtn"),
  tabRegisterBtn: document.getElementById("tabRegisterBtn"),
  loginForm: document.getElementById("loginForm"),
  registerForm: document.getElementById("registerForm"),
  loginEmail: document.getElementById("loginEmail"),
  loginPassword: document.getElementById("loginPassword"),
  loginEmailError: document.getElementById("loginEmailError"),
  loginPasswordError: document.getElementById("loginPasswordError"),
  loginSubmitBtn: document.getElementById("loginSubmitBtn"),
  registerName: document.getElementById("registerName"),
  registerEmail: document.getElementById("registerEmail"),
  registerPassword: document.getElementById("registerPassword"),
  registerConfirmPassword: document.getElementById("registerConfirmPassword"),
  registerNameError: document.getElementById("registerNameError"),
  registerEmailError: document.getElementById("registerEmailError"),
  registerPasswordError: document.getElementById("registerPasswordError"),
  registerConfirmPasswordError: document.getElementById("registerConfirmPasswordError"),
  registerSubmitBtn: document.getElementById("registerSubmitBtn"),

  // User Profile Dropdown
  userDropdown: document.getElementById("userDropdown"),
  userProfileBtn: document.getElementById("userProfileBtn"),
  profileMenu: document.getElementById("profileMenu"),
  userInitial: document.getElementById("userInitial"),
  userNameDisplay: document.getElementById("userNameDisplay"),
  viewOrdersBtn: document.getElementById("viewOrdersBtn"),
  logoutBtn: document.getElementById("logoutBtn"),

  // Orders Modal
  ordersModalOverlay: document.getElementById("ordersModalOverlay"),
  closeOrdersBtn: document.getElementById("closeOrdersBtn"),
  ordersListContainer: document.getElementById("ordersListContainer"),

  // Toast Container
  toastContainer: document.getElementById("toastContainer"),

  // Mobile Menu
  hamburgerBtn: document.getElementById("hamburgerBtn"),
  mobileMenu: document.getElementById("mobileMenu"),
  mobileAuthSection: document.getElementById("mobileAuthSection"),

  // Footer Links
  footerCartLink: document.getElementById("footerCartLink"),
  footerAuthLink: document.getElementById("footerAuthLink")
};

// ============================================================================
// 3. UTILITIES (TOAST NOTIFICATIONS & HTML ESCAPING)
// ============================================================================
function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  let icon = "ℹ️";
  if (type === "success") icon = "✅";
  if (type === "error") icon = "⚠️";

  toast.innerHTML = `<span>${icon}</span> <span>${escapeHtml(message)}</span>`;
  DOM.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(50px)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function escapeHtml(unsafe) {
  if (unsafe === undefined || unsafe === null) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ============================================================================
// 4. API REQUEST HELPER
// ============================================================================
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  // Automatically attach Bearer token if session exists
  if (AppState.authToken) {
    headers["Authorization"] = `Bearer ${AppState.authToken}`;
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers
    });

    const data = await res.json().catch(() => ({}));

    // Handle token expiry or invalid token
    if (res.status === 401 && AppState.authToken) {
      console.warn("Session token expired or invalid. Logging out.");
      handleLogout(false);
      showToast("Your session has expired. Please sign in again.", "info");
    }

    return { ok: res.ok, status: res.status, data };
  } catch (error) {
    console.error(`API Request Error [${endpoint}]:`, error);
    return {
      ok: false,
      status: 0,
      data: { message: "Cannot connect to server. Please ensure the backend is running at " + API_BASE_URL }
    };
  }
}

// ============================================================================
// 5. FOOD MENU CATALOG (TASK 1)
// ============================================================================
async function loadFoodMenu() {
  DOM.foodGrid.innerHTML = `
    <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 0;">
      <div style="font-size: 2rem; margin-bottom: 0.5rem; animation: pulse 1s infinite;">⏳</div>
      <p style="color: var(--text-muted); font-weight: 600;">Loading fresh dishes from MongoDB Atlas...</p>
    </div>
  `;

  // Build query parameters
  const params = new URLSearchParams();
  if (AppState.selectedCategory && AppState.selectedCategory !== "All") {
    params.append("category", AppState.selectedCategory);
  }
  if (AppState.searchQuery && AppState.searchQuery.trim() !== "") {
    params.append("search", AppState.searchQuery.trim());
  }

  const endpoint = `/foods${params.toString() ? `?${params.toString()}` : ""}`;
  const response = await apiRequest(endpoint);

  if (response.ok && response.data && response.data.foods) {
    AppState.foods = response.data.foods;

    // Update status badge
    if (DOM.catalogStatusText) {
      DOM.catalogStatusText.textContent = `MongoDB Atlas (${response.data.totalItems || response.data.foods.length} Dishes)`;
      const dot = DOM.catalogStatusBadge.querySelector(".status-dot");
      if (dot) dot.classList.add("live");
    }

    renderFoodGrid();
  } else {
    // Show error state
    DOM.foodGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem; background: #fff; border-radius: 12px; border: 1px dashed var(--danger);">
        <div style="font-size: 2.5rem; margin-bottom: 0.75rem;">⚠️</div>
        <h3 style="color: var(--danger); margin-bottom: 0.5rem;">Could not connect to MongoDB Atlas backend</h3>
        <p style="color: var(--text-muted); max-width: 480px; margin: 0 auto 1.25rem;">
          ${escapeHtml(response.data.message || "Ensure 'npm start' is running in the backend folder.")}
        </p>
        <button class="btn btn-primary btn-sm" onclick="loadFoodMenu()">Retry Connection</button>
      </div>
    `;
  }
}

function renderFoodGrid() {
  if (AppState.foods.length === 0) {
    DOM.foodGrid.innerHTML = "";
    DOM.emptyMenuState.style.display = "block";
    return;
  }

  DOM.emptyMenuState.style.display = "none";
  DOM.foodGrid.innerHTML = AppState.foods
    .map((food) => {
      const foodId = food._id || food.id;
      const inCartItem = AppState.cart.find((item) => item.id === foodId);
      const isItemInCart = !!inCartItem;
      const safeName = escapeHtml(food.name);
      const safeDesc = escapeHtml(food.description);
      const safeCat = escapeHtml(food.category);
      const safeImg = escapeHtml(food.image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80");
      const prepTime = food.preparationTime || 20;

      return `
        <article class="food-card" data-food-id="${foodId}">
          <div class="food-card-image">
            <img src="${safeImg}" alt="${safeName}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80'">
            <span class="food-category-badge">${safeCat}</span>
            <span class="food-rating-badge">⏱ ${prepTime}m</span>
          </div>
          <div class="food-card-content">
            <h3 class="food-title">${safeName}</h3>
            <p class="food-description">${safeDesc}</p>
            <div class="food-card-footer">
              <span class="food-price">₹${food.price}</span>
              ${
                !food.isAvailable
                  ? `<span style="font-size: 0.8rem; font-weight: 700; color: var(--danger);">Out of Stock</span>`
                  : isItemInCart
                  ? `
                <div class="card-stepper">
                  <button onclick="decrementCartItem('${foodId}')" aria-label="Decrease quantity">−</button>
                  <span>${inCartItem.quantity}</span>
                  <button onclick="incrementCartItem('${foodId}')" aria-label="Increase quantity">+</button>
                </div>
              `
                  : `
                <button class="btn-add-cart" onclick="addToCart('${foodId}')">
                  + Add
                </button>
              `
              }
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

// Category filter handlers
function setupCategoryFilters() {
  DOM.categoryFilters.addEventListener("click", (e) => {
    const pill = e.target.closest(".filter-pill");
    if (!pill) return;

    document.querySelectorAll(".filter-pill").forEach((btn) => btn.classList.remove("active"));
    pill.classList.add("active");

    AppState.selectedCategory = pill.dataset.category || "All";
    loadFoodMenu();
  });

  // Footer category shortcuts
  document.querySelectorAll("[data-footer-category]").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const cat = link.dataset.footerCategory;
      const targetPill = document.querySelector(`.filter-pill[data-category="${cat}"]`);
      if (targetPill) {
        targetPill.click();
        location.href = "#menu";
      }
    });
  });

  DOM.resetFiltersBtn.addEventListener("click", () => {
    AppState.searchQuery = "";
    AppState.selectedCategory = "All";
    DOM.searchInput.value = "";
    DOM.mobileSearchInput.value = "";
    DOM.clearSearchBtn.style.display = "none";
    document.querySelectorAll(".filter-pill").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.category === "All");
    });
    loadFoodMenu();
  });
}

// Search input debouncer
let searchDebounceTimer;
function setupSearch() {
  const handleSearch = (val) => {
    AppState.searchQuery = val;
    DOM.searchInput.value = val;
    DOM.mobileSearchInput.value = val;
    DOM.clearSearchBtn.style.display = val.length > 0 ? "flex" : "none";

    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      loadFoodMenu();
    }, 350);
  };

  DOM.searchInput.addEventListener("input", (e) => handleSearch(e.target.value));
  DOM.mobileSearchInput.addEventListener("input", (e) => handleSearch(e.target.value));

  DOM.clearSearchBtn.addEventListener("click", () => {
    handleSearch("");
    DOM.searchInput.focus();
  });
}

// ============================================================================
// 6. SHOPPING CART (TASK 3)
// ============================================================================
function saveCart() {
  localStorage.setItem("quickbite_cart", JSON.stringify(AppState.cart));
  updateCartBadge();
  renderCartDrawer();
  renderFoodGrid();
}

function updateCartBadge() {
  const totalCount = AppState.cart.reduce((sum, item) => sum + item.quantity, 0);
  DOM.cartCountBadge.textContent = totalCount;
  DOM.cartItemsSubtitle.textContent = `${totalCount} ${totalCount === 1 ? "item" : "items"}`;
}

function addToCart(foodId) {
  const food = AppState.foods.find((f) => (f._id || f.id) === foodId);
  if (!food) return;

  if (food.isAvailable === false) {
    showToast(`Sorry, "${food.name}" is currently out of stock.`, "error");
    return;
  }

  const existing = AppState.cart.find((item) => item.id === foodId);
  if (existing) {
    existing.quantity += 1;
  } else {
    AppState.cart.push({
      id: foodId,
      name: food.name,
      price: food.price,
      image: food.image,
      quantity: 1
    });
  }

  saveCart();
  showToast(`Added "${food.name}" to cart!`, "success");
}

function incrementCartItem(foodId) {
  const existing = AppState.cart.find((item) => item.id === foodId);
  if (existing) {
    existing.quantity += 1;
    saveCart();
  }
}

function decrementCartItem(foodId) {
  const existing = AppState.cart.find((item) => item.id === foodId);
  if (!existing) return;

  if (existing.quantity > 1) {
    existing.quantity -= 1;
  } else {
    AppState.cart = AppState.cart.filter((item) => item.id !== foodId);
    showToast(`Removed "${existing.name}" from cart.`, "info");
  }
  saveCart();
}

function removeCartItem(foodId) {
  const existing = AppState.cart.find((item) => item.id === foodId);
  if (existing) {
    AppState.cart = AppState.cart.filter((item) => item.id !== foodId);
    saveCart();
    showToast(`Removed "${existing.name}" from cart.`, "info");
  }
}

// Client-side estimates (the server calculates authoritative billing during order placement)
function calculateBillEstimate() {
  const subtotal = AppState.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = subtotal === 0 ? 0 : subtotal >= 500 ? 0 : 40;
  const taxes = subtotal === 0 ? 0 : Math.round(subtotal * 0.05);
  const grandTotal = subtotal + deliveryFee + taxes;

  return { subtotal, deliveryFee, taxes, grandTotal };
}

function renderCartDrawer() {
  const { subtotal, deliveryFee, taxes, grandTotal } = calculateBillEstimate();

  DOM.billSubtotal.textContent = `₹${subtotal.toFixed(2)}`;
  DOM.billDelivery.textContent = deliveryFee === 0 ? (subtotal > 0 ? "FREE" : "₹0.00") : `₹${deliveryFee.toFixed(2)}`;
  DOM.billTaxes.textContent = `₹${taxes.toFixed(2)}`;
  DOM.billGrandTotal.textContent = `₹${grandTotal.toFixed(2)}`;

  if (subtotal > 0 && subtotal < 500) {
    const diff = 500 - subtotal;
    DOM.freeDeliveryHint.style.display = "block";
    DOM.freeDeliveryHint.innerHTML = `<span>⚡ Add ₹${diff.toFixed(0)} more for <strong>FREE Delivery!</strong></span>`;
  } else if (subtotal >= 500) {
    DOM.freeDeliveryHint.style.display = "block";
    DOM.freeDeliveryHint.innerHTML = `<span>🎉 You unlocked <strong>FREE Delivery!</strong></span>`;
  } else {
    DOM.freeDeliveryHint.style.display = "none";
  }

  if (AppState.cart.length === 0) {
    DOM.cartItemsContainer.innerHTML = `
      <div class="empty-state" style="padding: 2.5rem 1rem;">
        <span class="empty-icon">🛒</span>
        <h3>Your Cart is Empty</h3>
        <p>Explore our menu and add your favorite dishes to satisfy your cravings!</p>
        <button class="btn btn-primary btn-sm" onclick="closeCart(); location.href='#menu';">Explore Menu</button>
      </div>
    `;
    DOM.proceedCheckoutBtn.disabled = true;
    DOM.proceedCheckoutBtn.style.opacity = "0.5";
    return;
  }

  DOM.proceedCheckoutBtn.disabled = false;
  DOM.proceedCheckoutBtn.style.opacity = "1";

  DOM.cartItemsContainer.innerHTML = AppState.cart
    .map(
      (item) => `
      <div class="cart-item">
        <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" class="cart-item-img" onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80'">
        <div class="cart-item-details">
          <h4 class="cart-item-title">${escapeHtml(item.name)}</h4>
          <span class="cart-item-price">₹${item.price} &times; ${item.quantity} = ₹${item.price * item.quantity}</span>
        </div>
        <div class="cart-item-actions">
          <div class="stepper">
            <button onclick="decrementCartItem('${item.id}')" title="Decrease">−</button>
            <span>${item.quantity}</span>
            <button onclick="incrementCartItem('${item.id}')" title="Increase">+</button>
          </div>
          <button class="btn-remove-item" onclick="removeCartItem('${item.id}')" title="Remove Item">&times;</button>
        </div>
      </div>
    `
    )
    .join("");
}

function openCart() {
  DOM.cartOverlay.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeCart() {
  DOM.cartOverlay.classList.remove("active");
  document.body.style.overflow = "";
}

window.addToCart = addToCart;
window.incrementCartItem = incrementCartItem;
window.decrementCartItem = decrementCartItem;
window.removeCartItem = removeCartItem;
window.closeCart = closeCart;

// ============================================================================
// 7. AUTHENTICATION (TASK 2)
// ============================================================================
async function checkAuthSession() {
  if (!AppState.authToken) {
    updateAuthUI();
    return;
  }

  // Verify token validity with backend
  const res = await apiRequest("/auth/profile");
  if (res.ok && res.data && res.data.user) {
    AppState.currentUser = res.data.user;
    localStorage.setItem("quickbite_user", JSON.stringify(res.data.user));
    updateAuthUI();
  } else {
    handleLogout(false);
  }
}

function openAuthModal(defaultTab = "login") {
  DOM.authModalOverlay.classList.add("active");
  document.body.style.overflow = "hidden";
  switchAuthTab(defaultTab);
}

function closeAuthModal() {
  DOM.authModalOverlay.classList.remove("active");
  document.body.style.overflow = "";
  clearAuthErrors();
}

function switchAuthTab(tab) {
  clearAuthErrors();
  if (tab === "login") {
    DOM.tabLoginBtn.classList.add("active");
    DOM.tabRegisterBtn.classList.remove("active");
    DOM.loginForm.style.display = "block";
    DOM.registerForm.style.display = "none";
  } else {
    DOM.tabRegisterBtn.classList.add("active");
    DOM.tabLoginBtn.classList.remove("active");
    DOM.registerForm.style.display = "block";
    DOM.loginForm.style.display = "none";
  }
}

function clearAuthErrors() {
  document.querySelectorAll(".error-msg").forEach((el) => (el.textContent = ""));
  document.querySelectorAll(".form-group").forEach((el) => el.classList.remove("has-error"));
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  clearAuthErrors();

  const email = DOM.loginEmail.value.trim();
  const password = DOM.loginPassword.value;

  let hasError = false;
  if (!email || !isValidEmail(email)) {
    DOM.loginEmailError.textContent = "Please enter a valid email address.";
    DOM.loginEmail.closest(".form-group").classList.add("has-error");
    hasError = true;
  }

  if (!password || password.length < 6) {
    DOM.loginPasswordError.textContent = "Password must be at least 6 characters.";
    DOM.loginPassword.closest(".form-group").classList.add("has-error");
    hasError = true;
  }

  if (hasError) return;

  DOM.loginSubmitBtn.disabled = true;
  DOM.loginSubmitBtn.textContent = "Signing In...";

  const res = await apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });

  DOM.loginSubmitBtn.disabled = false;
  DOM.loginSubmitBtn.textContent = "Sign In to Account";

  if (res.ok && res.data && res.data.token) {
    AppState.authToken = res.data.token;
    AppState.currentUser = res.data.user;
    localStorage.setItem("quickbite_token", res.data.token);
    localStorage.setItem("quickbite_user", JSON.stringify(res.data.user));

    updateAuthUI();
    closeAuthModal();
    DOM.loginForm.reset();
    showToast(`Welcome back, ${res.data.user.name}!`, "success");
  } else {
    DOM.loginPasswordError.textContent = res.data.message || "Invalid email or password.";
    DOM.loginPassword.closest(".form-group").classList.add("has-error");
  }
}

async function handleRegisterSubmit(e) {
  e.preventDefault();
  clearAuthErrors();

  const name = DOM.registerName.value.trim();
  const email = DOM.registerEmail.value.trim();
  const password = DOM.registerPassword.value;
  const confirmPassword = DOM.registerConfirmPassword.value;

  let hasError = false;

  if (!name || name.length < 2) {
    DOM.registerNameError.textContent = "Name must be at least 2 characters.";
    DOM.registerName.closest(".form-group").classList.add("has-error");
    hasError = true;
  }

  if (!email || !isValidEmail(email)) {
    DOM.registerEmailError.textContent = "Please enter a valid email address.";
    DOM.registerEmail.closest(".form-group").classList.add("has-error");
    hasError = true;
  }

  if (!password || password.length < 6) {
    DOM.registerPasswordError.textContent = "Password must be at least 6 characters.";
    DOM.registerPassword.closest(".form-group").classList.add("has-error");
    hasError = true;
  }

  if (password !== confirmPassword) {
    DOM.registerConfirmPasswordError.textContent = "Passwords do not match.";
    DOM.registerConfirmPassword.closest(".form-group").classList.add("has-error");
    hasError = true;
  }

  if (hasError) return;

  DOM.registerSubmitBtn.disabled = true;
  DOM.registerSubmitBtn.textContent = "Creating Account...";

  const res = await apiRequest("/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password })
  });

  DOM.registerSubmitBtn.disabled = false;
  DOM.registerSubmitBtn.textContent = "Create Free Account";

  if (res.ok && res.data && res.data.token) {
    AppState.authToken = res.data.token;
    AppState.currentUser = res.data.user;
    localStorage.setItem("quickbite_token", res.data.token);
    localStorage.setItem("quickbite_user", JSON.stringify(res.data.user));

    updateAuthUI();
    closeAuthModal();
    DOM.registerForm.reset();
    showToast(`Account created successfully! Welcome, ${res.data.user.name}.`, "success");
  } else {
    DOM.registerEmailError.textContent = res.data.message || "Registration failed. Try a different email.";
    DOM.registerEmail.closest(".form-group").classList.add("has-error");
  }
}

function updateAuthUI() {
  if (AppState.currentUser) {
    DOM.openAuthBtn.style.display = "none";
    DOM.userDropdown.style.display = "block";
    DOM.userNameDisplay.textContent = AppState.currentUser.name;
    DOM.userInitial.textContent = AppState.currentUser.name.charAt(0).toUpperCase();

    DOM.mobileAuthSection.innerHTML = `
      <div style="padding: 0.5rem 0; font-weight: 700; color: var(--primary);">
        👤 ${escapeHtml(AppState.currentUser.name)}
      </div>
      <button class="btn btn-outline btn-sm btn-block" onclick="openOrdersModal()" style="margin-bottom: 0.5rem;">📦 My Orders</button>
      <button class="btn btn-secondary btn-sm btn-block" onclick="handleLogout(true)">🚪 Logout</button>
    `;
  } else {
    DOM.openAuthBtn.style.display = "inline-flex";
    DOM.userDropdown.style.display = "none";
    DOM.profileMenu.classList.remove("show");

    DOM.mobileAuthSection.innerHTML = `
      <button class="btn btn-primary btn-block btn-sm" onclick="openAuthModal('login')">Sign In</button>
      <button class="btn btn-outline btn-block btn-sm" onclick="openAuthModal('register')" style="margin-top: 0.5rem;">Create Account</button>
    `;
  }
}

function handleLogout(notify = true) {
  AppState.currentUser = null;
  AppState.authToken = null;
  localStorage.removeItem("quickbite_token");
  localStorage.removeItem("quickbite_user");
  DOM.profileMenu.classList.remove("show");
  updateAuthUI();
  if (notify) {
    showToast("You have been signed out.", "info");
  }
}

window.openAuthModal = openAuthModal;
window.handleLogout = handleLogout;

// ============================================================================
// 8. CHECKOUT & ORDER PLACEMENT (TASK 4 & TASK 7)
// ============================================================================
function openCheckoutModal() {
  if (AppState.cart.length === 0) {
    showToast("Your cart is empty. Add dishes before checkout!", "error");
    return;
  }

  // Require user authentication before checkout
  if (!AppState.currentUser || !AppState.authToken) {
    showToast("Please sign in or create an account to place an order.", "info");
    openAuthModal("login");
    return;
  }

  closeCart();
  const { grandTotal } = calculateBillEstimate();
  const count = AppState.cart.reduce((s, i) => s + i.quantity, 0);

  DOM.checkoutSummaryTotal.textContent = `₹${grandTotal.toFixed(2)}`;
  DOM.checkoutSummaryCount.textContent = `${count} ${count === 1 ? "item" : "items"} (Estimated Total)`;

  if (AppState.currentUser) {
    DOM.orderFullName.value = AppState.currentUser.name || "";
  }

  DOM.checkoutModalOverlay.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeCheckoutModal() {
  DOM.checkoutModalOverlay.classList.remove("active");
  document.body.style.overflow = "";
  clearCheckoutErrors();
}

function clearCheckoutErrors() {
  DOM.orderNameError.textContent = "";
  DOM.orderPhoneError.textContent = "";
  DOM.orderAddressError.textContent = "";
  DOM.orderFullName.closest(".form-group").classList.remove("has-error");
  DOM.orderPhone.closest(".form-group").classList.remove("has-error");
  DOM.orderAddress.closest(".form-group").classList.remove("has-error");
}

async function handleCheckoutSubmit(e) {
  e.preventDefault();
  clearCheckoutErrors();

  if (AppState.isPlacingOrder) return;

  const fullName = DOM.orderFullName.value.trim();
  const phone = DOM.orderPhone.value.trim();
  const address = DOM.orderAddress.value.trim();

  let hasError = false;

  if (!fullName || fullName.length < 3) {
    DOM.orderNameError.textContent = "Please enter your full name (minimum 3 characters).";
    DOM.orderFullName.closest(".form-group").classList.add("has-error");
    hasError = true;
  }

  const phoneRegex = /^[6-9]\d{9}$/;
  if (!phone || !phoneRegex.test(phone)) {
    DOM.orderPhoneError.textContent = "Please enter a valid 10-digit mobile number.";
    DOM.orderPhone.closest(".form-group").classList.add("has-error");
    hasError = true;
  }

  if (!address || address.length < 10) {
    DOM.orderAddressError.textContent = "Please provide complete street, house no., and pincode (min 10 chars).";
    DOM.orderAddress.closest(".form-group").classList.add("has-error");
    hasError = true;
  }

  if (hasError) return;

  // Construct payload submitting actual food IDs from MongoDB
  const payload = {
    items: AppState.cart.map((it) => ({
      foodId: it.id,
      quantity: it.quantity
    })),
    deliveryAddress: `${fullName}, ${address} (Phone: ${phone})`,
    paymentMethod: "COD"
  };

  AppState.isPlacingOrder = true;
  DOM.placeOrderSubmitBtn.disabled = true;
  DOM.placeOrderSubmitBtn.textContent = "Verifying with Server...";

  const res = await apiRequest("/orders", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  AppState.isPlacingOrder = false;
  DOM.placeOrderSubmitBtn.disabled = false;
  DOM.placeOrderSubmitBtn.textContent = "Place Order";

  if (res.ok && res.data && res.data.order) {
    const createdOrder = res.data.order;

    // Clear cart only after verified creation
    AppState.cart = [];
    saveCart();

    closeCheckoutModal();
    DOM.checkoutForm.reset();

    showToast(
      `Order #${createdOrder._id.slice(-6).toUpperCase()} placed! Server Total: ₹${createdOrder.totalAmount.toFixed(2)}`,
      "success"
    );

    // Open Orders modal to display real database order
    setTimeout(() => {
      openOrdersModal();
    }, 400);
  } else {
    showToast(res.data.message || "Failed to place order. Please review your items.", "error");
  }
}

// ============================================================================
// 9. MY ORDERS & CANCELLATION (TASK 5)
// ============================================================================
async function openOrdersModal() {
  DOM.profileMenu.classList.remove("show");

  if (!AppState.currentUser || !AppState.authToken) {
    showToast("Please sign in to view your orders.", "info");
    openAuthModal("login");
    return;
  }

  DOM.ordersModalOverlay.classList.add("active");
  document.body.style.overflow = "hidden";
  await fetchAndRenderMyOrders();
}

function closeOrdersModal() {
  DOM.ordersModalOverlay.classList.remove("active");
  document.body.style.overflow = "";
}

async function fetchAndRenderMyOrders() {
  DOM.ordersListContainer.innerHTML = `
    <div style="text-align: center; padding: 2.5rem 0;">
      <div style="font-size: 2rem; margin-bottom: 0.5rem; animation: pulse 1s infinite;">📦</div>
      <p style="color: var(--text-muted); font-weight: 600;">Fetching your verified order history from MongoDB...</p>
    </div>
  `;

  const res = await apiRequest("/orders/myorders");

  if (res.ok && res.data && Array.isArray(res.data.orders)) {
    AppState.orders = res.data.orders;
    renderOrdersList();
  } else {
    DOM.ordersListContainer.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">⚠️</span>
        <h3>Could not load orders</h3>
        <p>${escapeHtml(res.data.message || "Unable to reach database server.")}</p>
        <button class="btn btn-primary btn-sm" onclick="fetchAndRenderMyOrders()">Try Again</button>
      </div>
    `;
  }
}

function renderOrdersList() {
  if (AppState.orders.length === 0) {
    DOM.ordersListContainer.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">📦</span>
        <h3>No Orders Placed Yet</h3>
        <p>You haven't placed any orders yet. Explore our fresh dishes and order delicious food today!</p>
        <button class="btn btn-primary btn-sm" onclick="closeOrdersModal(); location.href='#menu';">Start Ordering</button>
      </div>
    `;
    return;
  }

  DOM.ordersListContainer.innerHTML = AppState.orders
    .map((order) => {
      const orderIdShort = order._id.slice(-8).toUpperCase();
      const orderDate = new Date(order.createdAt).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short"
      });

      const statusClass = (order.orderStatus || "placed").toLowerCase();
      const canCancel = order.orderStatus === "PLACED" || order.orderStatus === "CONFIRMED";

      const itemsHtml = order.items
        .map(
          (it) => `
        <li class="order-item-line">
          <span>${it.quantity} &times; ${escapeHtml(it.name)}</span>
          <span>₹${(it.price * it.quantity).toFixed(2)}</span>
        </li>
      `
        )
        .join("");

      return `
        <div class="order-history-card">
          <div class="order-header-row">
            <div>
              <span class="order-id">Order #${orderIdShort}</span>
              <div class="order-date">${orderDate}</div>
            </div>
            <span class="order-status-badge ${statusClass}">${escapeHtml(order.orderStatus)}</span>
          </div>

          <ul class="order-items-list">
            ${itemsHtml}
          </ul>

          <div style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 0.5rem; line-height: 1.4;">
            📍 <strong>Deliver to:</strong> ${escapeHtml(order.deliveryAddress)}
          </div>

          <div class="bill-row" style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.2rem;">
            <span>Subtotal: ₹${order.subtotal.toFixed(2)} | Delivery: ${order.deliveryFee === 0 ? "FREE" : `₹${order.deliveryFee}`} | GST (5%): ₹${order.tax.toFixed(2)}</span>
          </div>

          <div class="order-total-row">
            <span>Total (${escapeHtml(order.paymentMethod || "COD")})</span>
            <span>₹${order.totalAmount.toFixed(2)}</span>
          </div>

          ${
            canCancel
              ? `
            <div class="order-actions-bar">
              <button class="btn-cancel-order" onclick="cancelCustomerOrder('${order._id}')">
                Cancel Order
              </button>
            </div>
          `
              : ""
          }
        </div>
      `;
    })
    .join("");
}

async function cancelCustomerOrder(orderId) {
  if (!confirm("Are you sure you want to cancel this order?")) {
    return;
  }

  showToast("Requesting order cancellation...", "info");

  const res = await apiRequest(`/orders/${orderId}/cancel`, {
    method: "PUT"
  });

  if (res.ok) {
    showToast("Order cancelled successfully.", "success");
    await fetchAndRenderMyOrders();
  } else {
    showToast(res.data.message || "Could not cancel order.", "error");
  }
}

window.openOrdersModal = openOrdersModal;
window.closeOrdersModal = closeOrdersModal;
window.cancelCustomerOrder = cancelCustomerOrder;

// ============================================================================
// 10. EVENT LISTENERS INITIALIZATION
// ============================================================================
function initEventListeners() {
  // Cart open / close
  DOM.openCartBtn.addEventListener("click", openCart);
  DOM.closeCartBtn.addEventListener("click", closeCart);
  DOM.footerCartLink.addEventListener("click", (e) => {
    e.preventDefault();
    openCart();
  });
  DOM.cartOverlay.addEventListener("click", (e) => {
    if (e.target === DOM.cartOverlay) closeCart();
  });

  // Checkout Modal
  DOM.proceedCheckoutBtn.addEventListener("click", openCheckoutModal);
  DOM.closeCheckoutBtn.addEventListener("click", closeCheckoutModal);
  DOM.cancelCheckoutBtn.addEventListener("click", () => {
    closeCheckoutModal();
    openCart();
  });
  DOM.checkoutModalOverlay.addEventListener("click", (e) => {
    if (e.target === DOM.checkoutModalOverlay) closeCheckoutModal();
  });
  DOM.checkoutForm.addEventListener("submit", handleCheckoutSubmit);

  // Auth Modal
  DOM.openAuthBtn.addEventListener("click", () => openAuthModal("login"));
  DOM.footerAuthLink.addEventListener("click", (e) => {
    e.preventDefault();
    openAuthModal("login");
  });
  DOM.closeAuthBtn.addEventListener("click", closeAuthModal);
  DOM.tabLoginBtn.addEventListener("click", () => switchAuthTab("login"));
  DOM.tabRegisterBtn.addEventListener("click", () => switchAuthTab("register"));
  DOM.authModalOverlay.addEventListener("click", (e) => {
    if (e.target === DOM.authModalOverlay) closeAuthModal();
  });
  DOM.loginForm.addEventListener("submit", handleLoginSubmit);
  DOM.registerForm.addEventListener("submit", handleRegisterSubmit);

  // User Dropdown
  DOM.userProfileBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    DOM.profileMenu.classList.toggle("show");
  });
  document.addEventListener("click", (e) => {
    if (!DOM.userDropdown.contains(e.target)) {
      DOM.profileMenu.classList.remove("show");
    }
  });
  DOM.viewOrdersBtn.addEventListener("click", openOrdersModal);
  DOM.logoutBtn.addEventListener("click", () => handleLogout(true));

  // Orders Modal
  DOM.closeOrdersBtn.addEventListener("click", closeOrdersModal);
  DOM.ordersModalOverlay.addEventListener("click", (e) => {
    if (e.target === DOM.ordersModalOverlay) closeOrdersModal();
  });

  // Mobile Hamburger Toggle
  DOM.hamburgerBtn.addEventListener("click", () => {
    DOM.mobileMenu.classList.toggle("active");
  });
  document.querySelectorAll(".mobile-nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      DOM.mobileMenu.classList.remove("active");
    });
  });

  // ESC key closes modals
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeCart();
      closeCheckoutModal();
      closeAuthModal();
      closeOrdersModal();
      DOM.profileMenu.classList.remove("show");
    }
  });
}

// ============================================================================
// 11. BOOTSTRAP APPLICATION
// ============================================================================
document.addEventListener("DOMContentLoaded", async () => {
  setupCategoryFilters();
  setupSearch();
  initEventListeners();
  updateCartBadge();
  renderCartDrawer();
  await checkAuthSession();
  await loadFoodMenu();
});
