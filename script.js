const API_BASE_URL = 'http://localhost:5000/api';

const state = {
  products: [],
  cart: JSON.parse(localStorage.getItem('cart') || '[]'),
  token: localStorage.getItem('token'),
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  currentView: 'home'
};

const refs = {
  // Navigation
  navLinks: document.querySelectorAll('.nav-link'),
  cartIcon: document.getElementById('cartIcon'),
  cartCount: document.getElementById('cartCount'),
  loginBtn: document.getElementById('loginBtn'),
  registerBtn: document.getElementById('registerBtn'),
  logoutBtn: document.getElementById('logoutBtn'),

  // Hero
  heroStats: document.querySelectorAll('.stat-number'),

  // Products
  productsGrid: document.getElementById('productsGrid'),
  productsSection: document.getElementById('productsSection'),

  // Cart Sidebar
  cartSidebar: document.getElementById('cartSidebar'),
  closeCart: document.getElementById('closeCart'),
  cartItems: document.getElementById('cartItems'),
  cartTotal: document.getElementById('cartTotal'),
  checkoutBtn: document.getElementById('checkoutBtn'),

  // Auth Modal
  authModal: document.getElementById('authModal'),
  closeModal: document.getElementById('closeModal'),
  loginTab: document.getElementById('loginTab'),
  registerTab: document.getElementById('registerTab'),
  loginPanel: document.getElementById('loginPanel'),
  registerPanel: document.getElementById('registerPanel'),
  loginForm: document.getElementById('loginForm'),
  registerForm: document.getElementById('registerForm'),
  otpSection: document.getElementById('otpSection'),
  otpForm: document.getElementById('otpForm'),
  otpInput: document.getElementById('otpInput'),
  resendOtpBtn: document.getElementById('resendOtpBtn'),
  showRegisterLink: document.getElementById('showRegister'),
  showLoginLink: document.getElementById('showLogin'),

  // Toast
  toastContainer: document.getElementById('toastContainer')
};

// Utility Functions
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type} show`;
  toast.innerHTML = `
    <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
    <span>${message}</span>
  `;

  refs.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

async function fetchWithTimeout(url, options = {}, timeout = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timed out. Please check your connection.');
    }
    throw error;
  }
}

function handleFetchError(error) {
  console.error('Fetch error:', error);
  if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
    showToast('Network error. Please check your internet connection.', 'error');
  } else if (error.message.includes('timeout')) {
    showToast('Request timed out. Please try again.', 'error');
  } else {
    showToast(error.message || 'An error occurred', 'error');
  }
}

function scrollToProducts() {
  const section = document.getElementById('productsSection');
  if (section) {
    section.scrollIntoView({ behavior: 'smooth' });
  }
}

// Authentication Functions
function updateAuthUI() {
  const signedIn = Boolean(state.token && state.user);

  if (refs.loginBtn) refs.loginBtn.classList.toggle('hidden', signedIn);
  if (refs.registerBtn) refs.registerBtn.classList.toggle('hidden', signedIn);
  if (refs.logoutBtn) refs.logoutBtn.classList.toggle('hidden', !signedIn);

  // Update navigation links
  refs.navLinks.forEach(link => {
    if (link.getAttribute('href') === '#orders') {
      link.classList.toggle('hidden', !signedIn);
    }
  });
}

function openAuthModal(tab = 'login') {
  refs.authModal.classList.add('show');
  setAuthTab(tab);
}

function closeAuthModal() {
  refs.authModal.classList.remove('show');
  // Reset forms
  if (refs.loginForm) refs.loginForm.reset();
  if (refs.registerForm) refs.registerForm.reset();
  if (refs.otpSection) refs.otpSection.classList.add('hidden');
}

function setAuthTab(tab) {
  const loginActive = tab === 'login';
  refs.loginTab.classList.toggle('active', loginActive);
  refs.registerTab.classList.toggle('active', !loginActive);

  if (refs.loginPanel) {
    refs.loginPanel.classList.toggle('hidden', !loginActive);
  }
  if (refs.registerPanel) {
    refs.registerPanel.classList.toggle('hidden', loginActive);
  }

  if (refs.otpSection) {
    refs.otpSection.classList.add('hidden');
  }
}

function saveAuth(user, token) {
  state.token = token;
  state.user = user;
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
  updateAuthUI();
}

function clearAuth() {
  state.token = null;
  state.user = null;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  updateAuthUI();
  showToast('Logged out successfully', 'success');
}

// Product Functions
async function fetchProducts() {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/products`);
    const products = await response.json();
    state.products = Array.isArray(products) ? products : [];
    renderProducts();
    updateHeroStats();
  } catch (error) {
    handleFetchError(error);
  }
}

function renderProducts() {
  if (!refs.productsGrid) return;
  refs.productsGrid.innerHTML = '';

  if (state.products.length === 0) {
    refs.productsGrid.innerHTML = '<p class="no-products">No products available</p>';
    return;
  }

  state.products.forEach((product) => {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
      <img src="${product.image || '/api/placeholder/300/250'}" alt="${product.title}" />
      <div class="product-info">
        <h3 class="product-title">${product.title}</h3>
        <p class="product-description">${product.description}</p>
        <p class="product-price">$${product.price.toFixed(2)}</p>
        <div class="product-actions">
          <button class="btn btn-secondary add-to-cart" data-id="${product._id}">
            <i class="fas fa-cart-plus"></i> Add to Cart
          </button>
        </div>
      </div>
    `;
    refs.productsGrid.appendChild(card);
  });

  // Attach event listeners
  refs.productsGrid.querySelectorAll('.add-to-cart').forEach((button) => {
    button.addEventListener('click', () => addToCart(button.dataset.id));
  });
}

function updateHeroStats() {
  // Update hero statistics with actual data
  const totalProducts = state.products.length;
  const totalValue = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  // Animate numbers
  animateNumber(refs.heroStats[0], totalProducts);
  animateNumber(refs.heroStats[1], state.cart.length);
  animateNumber(refs.heroStats[2], totalValue);
}

function animateNumber(element, target) {
  if (!element) return;
  const start = parseInt(element.textContent) || 0;
  const duration = 1000;
  const step = (target - start) / (duration / 16);
  let current = start;

  const timer = setInterval(() => {
    current += step;
    if ((step > 0 && current >= target) || (step < 0 && current <= target)) {
      element.textContent = target;
      clearInterval(timer);
    } else {
      element.textContent = Math.floor(current);
    }
  }, 16);
}

// Cart Functions
function saveCart() {
  localStorage.setItem('cart', JSON.stringify(state.cart));
}

function addToCart(productId) {
  const existingItem = state.cart.find(item => item.productId === productId);
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    const product = state.products.find(p => p._id === productId);
    if (!product) return;
    state.cart.push({
      productId,
      title: product.title,
      price: product.price,
      image: product.image,
      quantity: 1
    });
  }
  saveCart();
  updateCartUI();
  showToast('Added to cart!', 'success');
}

function removeFromCart(productId) {
  state.cart = state.cart.filter(item => item.productId !== productId);
  saveCart();
  updateCartUI();
}

function updateQuantity(productId, delta) {
  const item = state.cart.find(item => item.productId === productId);
  if (!item) return;
  item.quantity = Math.max(1, item.quantity + delta);
  saveCart();
  updateCartUI();
}

function updateCartUI() {
  // Update cart count
  const totalItems = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  if (refs.cartCount) {
    refs.cartCount.textContent = totalItems;
    refs.cartCount.classList.toggle('hidden', totalItems === 0);
  }

  // Update cart sidebar
  if (!refs.cartItems) return;
  refs.cartItems.innerHTML = '';

  if (state.cart.length === 0) {
    refs.cartItems.innerHTML = `
      <div class="empty-cart">
        <i class="fas fa-shopping-cart"></i>
        <p>Your cart is empty</p>
      </div>
    `;
    if (refs.cartTotal) refs.cartTotal.textContent = '$0.00';
    return;
  }

  let total = 0;
  state.cart.forEach(item => {
    total += item.price * item.quantity;

    const cartItem = document.createElement('div');
    cartItem.className = 'cart-item';
    cartItem.innerHTML = `
      <img src="${item.image || '/api/placeholder/60/60'}" alt="${item.title}" />
      <div class="cart-item-info">
        <h4 class="cart-item-title">${item.title}</h4>
        <p class="cart-item-price">$${(item.price * item.quantity).toFixed(2)}</p>
        <div class="cart-item-quantity">
          <button class="quantity-btn" data-id="${item.productId}" data-action="decrease">-</button>
          <span>${item.quantity}</span>
          <button class="quantity-btn" data-id="${item.productId}" data-action="increase">+</button>
          <button class="remove-item" data-id="${item.productId}">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `;
    refs.cartItems.appendChild(cartItem);
  });

  if (refs.cartTotal) refs.cartTotal.textContent = `$${total.toFixed(2)}`;

  // Attach event listeners
  refs.cartItems.querySelectorAll('.quantity-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      const productId = btn.dataset.id;
      updateQuantity(productId, action === 'increase' ? 1 : -1);
    });
  });

  refs.cartItems.querySelectorAll('.remove-item').forEach(btn => {
    btn.addEventListener('click', () => removeFromCart(btn.dataset.id));
  });
}

function toggleCart() {
  refs.cartSidebar.classList.toggle('open');
}

// Auth Form Handlers
async function handleRegister(event) {
  event.preventDefault();
  const form = event.target;
  const submitBtn = form.querySelector('button[type="submit"]');
  const name = document.getElementById('registerName').value.trim();
  const email = document.getElementById('registerEmail').value.trim();
  const password = document.getElementById('registerPassword').value;

  if (!name || !email || !password) {
    showToast('Please fill in all fields', 'warning');
    return;
  }

  submitBtn.classList.add('loading');
  submitBtn.disabled = true;

  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Registration failed');

    // Show OTP verification
    if (refs.registerPanel) refs.registerPanel.classList.add('hidden');
    if (refs.otpSection) refs.otpSection.classList.remove('hidden');
    showToast('Registration successful! Please check your email for OTP.', 'success');

  } catch (error) {
    handleFetchError(error);
  } finally {
    submitBtn.classList.remove('loading');
    submitBtn.disabled = false;
  }
}

async function handleOtpVerification(event) {
  event.preventDefault();
  const otp = refs.otpInput.value.trim();

  if (!otp || otp.length !== 6) {
    showToast('Please enter a valid 6-digit OTP', 'warning');
    return;
  }

  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: document.getElementById('registerEmail').value.trim(), otp })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'OTP verification failed');

    saveAuth(data.user, data.token);
    closeAuthModal();
    showToast('Account verified and logged in!', 'success');

  } catch (error) {
    handleFetchError(error);
  }
}

async function handleResendOtp() {
  const email = document.getElementById('registerEmail').value.trim();
  if (!email) {
    showToast('Email not found', 'error');
    return;
  }

  refs.resendOtpBtn.disabled = true;
  refs.resendOtpBtn.textContent = 'Sending...';

  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/auth/resend-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to resend OTP');

    showToast('OTP sent! Check your email.', 'success');

  } catch (error) {
    handleFetchError(error);
  } finally {
    refs.resendOtpBtn.disabled = false;
    refs.resendOtpBtn.textContent = 'Resend OTP';
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const form = event.target;
  const submitBtn = form.querySelector('button[type="submit"]');
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!email || !password) {
    showToast('Please enter email and password', 'warning');
    return;
  }

  submitBtn.classList.add('loading');
  submitBtn.disabled = true;

  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Login failed');

    saveAuth(data.user, data.token);
    closeAuthModal();
    showToast('Login successful!', 'success');

  } catch (error) {
    handleFetchError(error);
  } finally {
    submitBtn.classList.remove('loading');
    submitBtn.disabled = false;
  }
}

async function handleCheckout() {
  if (state.cart.length === 0) {
    showToast('Your cart is empty', 'warning');
    return;
  }

  if (!state.token) {
    openAuthModal('login');
    showToast('Please login to checkout', 'warning');
    return;
  }

  refs.checkoutBtn.classList.add('loading');
  refs.checkoutBtn.disabled = true;

  try {
    // Calculate total amount
    const totalAmount = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Default shipping address (can be expanded with a form later)
    const shippingAddress = {
      street: '123 Main Street',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      country: 'USA'
    };

    const response = await fetchWithTimeout(`${API_BASE_URL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({
        items: state.cart,
        totalAmount: parseFloat(totalAmount.toFixed(2)),
        shippingAddress
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Checkout failed');

    state.cart = [];
    saveCart();
    updateCartUI();
    refs.cartSidebar.classList.remove('open');
    showToast('Order placed successfully!', 'success');

  } catch (error) {
    handleFetchError(error);
  } finally {
    refs.checkoutBtn.classList.remove('loading');
    refs.checkoutBtn.disabled = false;
  }
}

// Navigation
function handleNavigation(event) {
  event.preventDefault();
  const target = event.target.closest('a');
  if (!target) return;

  const href = target.getAttribute('href');
  if (href === '#cart') {
    toggleCart();
  } else if (href === '#login') {
    openAuthModal('login');
  } else if (href === '#register') {
    openAuthModal('register');
  } else if (href === '#logout') {
    clearAuth();
  } else if (href === '#orders') {
    // Handle orders view
    showToast('Orders feature coming soon!', 'info');
  }
}

// Event Listeners
function attachEventHandlers() {
  // Navigation
  document.addEventListener('click', handleNavigation);

  // Cart
  if (refs.cartIcon) refs.cartIcon.addEventListener('click', toggleCart);
  if (refs.closeCart) refs.closeCart.addEventListener('click', () => refs.cartSidebar.classList.remove('open'));
  if (refs.checkoutBtn) refs.checkoutBtn.addEventListener('click', handleCheckout);

  // Auth Modal
  if (refs.loginBtn) refs.loginBtn.addEventListener('click', () => openAuthModal('login'));
  if (refs.registerBtn) refs.registerBtn.addEventListener('click', () => openAuthModal('register'));
  if (refs.logoutBtn) refs.logoutBtn.addEventListener('click', clearAuth);
  if (refs.closeModal) refs.closeModal.addEventListener('click', closeAuthModal);
  if (refs.authModal) refs.authModal.addEventListener('click', (e) => {
    if (e.target === refs.authModal) closeAuthModal();
  });
  if (refs.loginTab) refs.loginTab.addEventListener('click', () => setAuthTab('login'));
  if (refs.registerTab) refs.registerTab.addEventListener('click', () => setAuthTab('register'));
  if (refs.showRegisterLink) refs.showRegisterLink.addEventListener('click', (e) => { e.preventDefault(); openAuthModal('register'); });
  if (refs.showLoginLink) refs.showLoginLink.addEventListener('click', (e) => { e.preventDefault(); openAuthModal('login'); });
  if (refs.loginForm) refs.loginForm.addEventListener('submit', handleLogin);
  if (refs.registerForm) refs.registerForm.addEventListener('submit', handleRegister);
  if (refs.otpForm) refs.otpForm.addEventListener('submit', handleOtpVerification);
  if (refs.resendOtpBtn) refs.resendOtpBtn.addEventListener('click', handleResendOtp);

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAuthModal();
      refs.cartSidebar.classList.remove('open');
    }
  });
}

// Initialize
function initialize() {
  attachEventHandlers();
  updateAuthUI();
  fetchProducts();
  updateCartUI();
}

document.addEventListener('DOMContentLoaded', initialize);
