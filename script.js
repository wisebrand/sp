// Auto-detect environment: Seamless support for both Local (port 5000 / Live Server) and Online (Render, Vercel, Railway, etc.)
const API_BASE = (() => {
    if (typeof window !== 'undefined' && window.location) {
        // If served over HTTP/HTTPS
        if (window.location.protocol.startsWith('http')) {
            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            // If running on a local dev server (like VSCode Live Server 5500/3000), target Express backend on 5000
            if (isLocal && window.location.port !== '5000') {
                return 'http://localhost:5000/api';
            }
            // If served directly by Express (port 5000) or online cloud hosting (Render/Railway/Vercel/Heroku)
            return '/api';
        }
    }
    return 'http://localhost:5000/api';
})();

// Safe JSON parser to prevent HTML response SyntaxError crashes
async function safeParseResponse(response) {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
        return await response.json();
    }
    const text = await response.text();
    if (text.trim().startsWith('<')) {
        throw new Error('Server endpoint returned HTML instead of JSON. Ensure Express server is running on http://localhost:5000');
    }
    try {
        return JSON.parse(text);
    } catch (e) {
        throw new Error('Invalid response received from server');
    }
}

// --- LOADING BAR & "PLEASE WAIT..." OVERLAY SYSTEM ---
let loadingProgressInterval = null;
let activeLoadingCount = 0;

function showLoading(title = 'Please wait', subtitle = 'Processing your request...') {
    activeLoadingCount++;
    
    // 1. Top Slim Progress Bar
    const topBar = document.getElementById('top-progress-bar');
    if (topBar) {
        topBar.classList.add('active');
        topBar.style.opacity = '1';
        topBar.style.width = '35%';
        clearInterval(loadingProgressInterval);
        loadingProgressInterval = setInterval(() => {
            const currentWidth = parseFloat(topBar.style.width) || 35;
            if (currentWidth < 88) {
                topBar.style.width = (currentWidth + Math.random() * 6) + '%';
            }
        }, 150);
    }

    // 2. Global Centered Overlay Modal
    const overlay = document.getElementById('global-loading-overlay');
    const titleEl = document.getElementById('loading-overlay-title');
    const subtitleEl = document.getElementById('loading-overlay-subtitle');

    if (titleEl) {
        titleEl.innerHTML = `
            <span>${title}</span>
            <span class="inline-flex space-x-0.5 text-indigo-600">
                <span class="animate-bounce" style="animation-delay: 0ms">.</span>
                <span class="animate-bounce" style="animation-delay: 150ms">.</span>
                <span class="animate-bounce" style="animation-delay: 300ms">.</span>
            </span>
        `;
    }
    if (subtitleEl) {
        subtitleEl.textContent = subtitle;
    }

    if (overlay) {
        overlay.classList.remove('hidden');
        // Force reflow for smooth opacity transition
        void overlay.offsetWidth;
        overlay.classList.remove('opacity-0');
        overlay.classList.add('opacity-100');
        const modalBox = overlay.firstElementChild;
        if (modalBox) {
            modalBox.classList.remove('scale-95');
            modalBox.classList.add('scale-100');
        }
    }
}

function hideLoading() {
    activeLoadingCount = Math.max(0, activeLoadingCount - 1);
    if (activeLoadingCount > 0) return;

    clearInterval(loadingProgressInterval);
    const topBar = document.getElementById('top-progress-bar');
    if (topBar) {
        topBar.style.width = '100%';
        setTimeout(() => {
            topBar.classList.remove('active');
            topBar.style.opacity = '0';
            setTimeout(() => {
                topBar.style.width = '0%';
            }, 300);
        }, 220);
    }

    const overlay = document.getElementById('global-loading-overlay');
    if (overlay) {
        overlay.classList.remove('opacity-100');
        overlay.classList.add('opacity-0');
        const modalBox = overlay.firstElementChild;
        if (modalBox) {
            modalBox.classList.remove('scale-100');
            modalBox.classList.add('scale-95');
        }
        setTimeout(() => {
            if (activeLoadingCount === 0) {
                overlay.classList.add('hidden');
            }
        }, 250);
    }
}

function setButtonLoading(btnOrId, isLoading, loadingText = 'Please wait...') {
    const btn = typeof btnOrId === 'string' ? document.getElementById(btnOrId) : btnOrId;
    if (!btn) return;

    if (isLoading) {
        if (!btn.dataset.originalHtml) {
            btn.dataset.originalHtml = btn.innerHTML;
        }
        btn.disabled = true;
        btn.classList.add('btn-loading');
        btn.innerHTML = `
            <span class="inline-flex items-center justify-center space-x-2">
                <i class="fa-solid fa-circle-notch fa-spin text-sm"></i>
                <span>${loadingText}</span>
            </span>
        `;
    } else {
        if (btn.dataset.originalHtml) {
            btn.innerHTML = btn.dataset.originalHtml;
            delete btn.dataset.originalHtml;
        }
        btn.disabled = false;
        btn.classList.remove('btn-loading');
    }
}

// Application State
let products = [];
let cart = JSON.parse(localStorage.getItem('sd_cart')) || [];
let wishlist = JSON.parse(localStorage.getItem('sd_wishlist')) || [];
let orders = JSON.parse(localStorage.getItem('sd_orders')) || [];
let currentUser = JSON.parse(localStorage.getItem('sd_user')) || null;
let authToken = localStorage.getItem('sd_token') || null;

let activeCategory = 'All';
let appliedDiscount = 0;
let pendingEmail = '';

// Initialize App on Load
window.addEventListener('DOMContentLoaded', async () => {
    updateBadges();
    updateAuthUI();
    showLoading('Please wait', 'Connecting to database & loading catalog...');
    try {
        await fetchProducts();
        if (authToken) {
            await fetchOrders();
        }
    } finally {
        setTimeout(() => hideLoading(), 400);
    }
});

// --- TOAST NOTIFICATIONS ---
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const bgClass = type === 'success' ? 'bg-gray-900 text-white' : 'bg-rose-600 text-white';
    const icon = type === 'success' ? 'fa-circle-check text-emerald-400' : 'fa-circle-exclamation text-white';
    
    toast.className = `${bgClass} px-4 py-3 rounded-xl shadow-lg flex items-center space-x-3 text-sm font-medium toast-slide`;
    toast.innerHTML = `<i class="fa-solid ${icon} text-base"></i><span>${message}</span>`;
    
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// --- NAVIGATION & TAB HISTORY ---
let tabHistory = ['catalog'];

function switchTab(tabId, pushHistory = true) {
    if (pushHistory) {
        if (tabHistory.length === 0 || tabHistory[tabHistory.length - 1] !== tabId) {
            tabHistory.push(tabId);
        }
    }

    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById(`tab-${tabId}`);
    if (target) target.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (tabId === 'cart') renderCart();
    if (tabId === 'wishlist') renderWishlist();
    if (tabId === 'orders') renderOrders();
    if (tabId === 'profile') loadUserProfile();
}

function goBack() {
    if (tabHistory.length > 1) {
        tabHistory.pop(); // Pop current view
        const prevTab = tabHistory[tabHistory.length - 1] || 'catalog';
        switchTab(prevTab, false);
    } else {
        switchTab('catalog', false);
    }
}

function scrollToCatalog() {
    switchTab('catalog');
}

const DEFAULT_PRODUCTS = [
    { _id: '1', title: 'Wireless Headphones', description: 'Premium noise-cancelling wireless headphones with 30-hour battery life', price: 199.99, image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=60', category: 'Electronics', stock: 50 },
    { _id: '2', title: 'Smartphone', description: 'Latest model smartphone with 5G connectivity and advanced camera system', price: 899.99, image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=60', category: 'Electronics', stock: 30 },
    { _id: '3', title: 'Laptop', description: 'High-performance laptop for professionals and students', price: 1299.99, image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500&auto=format&fit=crop&q=60', category: 'Electronics', stock: 20 },
    { _id: '4', title: 'Smartwatch', description: 'Feature-rich smartwatch with health monitoring and fitness tracking', price: 349.99, image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=60', category: 'Wearables', stock: 45 },
    { _id: '5', title: 'Portable Speaker', description: 'Waterproof portable speaker with exceptional sound quality', price: 79.99, image: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=500&auto=format&fit=crop&q=60', category: 'Audio', stock: 60 },
    { _id: '6', title: 'USB-C Cable', description: 'Durable and fast-charging USB-C cable for all devices', price: 14.99, image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=500&auto=format&fit=crop&q=60', category: 'Accessories', stock: 100 },
    { _id: '7', title: 'Screen Protector', description: 'Tempered glass screen protector for smartphones', price: 9.99, image: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=500&auto=format&fit=crop&q=60', category: 'Accessories', stock: 150 },
    { _id: '8', title: 'Phone Case', description: 'Protective and stylish phone case with premium materials', price: 24.99, image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500&auto=format&fit=crop&q=60', category: 'Accessories', stock: 80 }
];

// --- PRODUCTS API & RENDERING ---
async function fetchProducts() {
    const endpoints = [`${API_BASE}/products`];
    if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        if (!endpoints.includes('http://localhost:5000/api/products')) {
            endpoints.push('http://localhost:5000/api/products');
        }
    }

    let loaded = false;
    for (const url of endpoints) {
        try {
            const response = await fetch(url);
            if (response.ok) {
                const data = await safeParseResponse(response);
                if (Array.isArray(data) && data.length > 0) {
                    // Map placeholder images to high quality Unsplash images if needed
                    products = data.map(p => {
                        let img = p.image;
                        if (!img || img.includes('placeholder.com')) {
                            const match = DEFAULT_PRODUCTS.find(dp => dp.title.toLowerCase() === (p.title || p.name || '').toLowerCase());
                            if (match) img = match.image;
                        }
                        return { ...p, image: img || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=60' };
                    });
                    loaded = true;
                    break;
                }
            }
        } catch (err) {
            console.warn(`Could not fetch products from ${url}:`, err.message);
        }
    }

    if (!loaded || products.length === 0) {
        console.warn('Falling back to catalog products');
        products = DEFAULT_PRODUCTS;
    }

    renderProducts();
}

function renderProducts(filteredList = null) {
    const grid = document.getElementById('product-grid');
    if (!grid) return;
    const listToRender = filteredList || products;

    if (listToRender.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full py-16 text-center text-gray-400 bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
                <i class="fa-solid fa-filter-circle-xmark text-4xl text-gray-300 mb-3"></i>
                <h3 class="text-base font-bold text-gray-700">No matching products found</h3>
                <p class="text-xs text-gray-400 mt-1">Try adjusting your search terms, price slider, or rating filters.</p>
                <button onclick="resetFilters()" class="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-5 py-2 rounded-xl transition">
                    Reset All Filters
                </button>
            </div>
        `;
        return;
    }

    grid.innerHTML = listToRender.map(product => {
        const productId = product._id || product.id;
        const productName = product.title || product.name;
        const isWishlisted = wishlist.some(item => (item._id || item.id) === productId);
        const rating = (Number(product.rating) || 4.8).toFixed(1);
        const ratingCount = product.ratingCount || (product.reviews ? product.reviews.length : 24);
        const brand = product.brand || 'SD Premium';
        const image = product.image || 'https://via.placeholder.com/300x250?text=Product';

        return `
            <div class="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition flex flex-col overflow-hidden group">
                <div class="relative bg-gray-50 h-52 overflow-hidden cursor-pointer" onclick="openProductModal('${productId}')">
                    <img src="${image}" alt="${productName}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300">
                    <button onclick="event.stopPropagation(); toggleWishlist('${productId}')" class="absolute top-3 right-3 bg-white/80 backdrop-blur-sm p-2 rounded-full shadow hover:bg-white transition text-gray-600">
                        <i class="${isWishlisted ? 'fa-solid text-rose-500' : 'fa-regular text-gray-600'} fa-heart"></i>
                    </button>
                    <span class="absolute bottom-2.5 left-2.5 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                        ${brand}
                    </span>
                </div>
                <div class="p-5 flex-1 flex flex-col justify-between">
                    <div>
                        <div class="flex items-center justify-between text-xs text-gray-400 mb-1">
                            <span class="font-bold text-indigo-600 uppercase text-[10px] tracking-wider">${product.category || 'General'}</span>
                            <div class="flex items-center text-amber-500 text-xs font-bold">
                                <i class="fa-solid fa-star text-[10px] mr-1 text-amber-400"></i>
                                <span class="text-gray-800">${rating}</span>
                                <span class="text-gray-400 text-[10px] ml-0.5 font-normal">(${ratingCount})</span>
                            </div>
                        </div>
                        <h3 class="font-bold text-gray-900 line-clamp-1 cursor-pointer hover:text-indigo-600 transition" onclick="openProductModal('${productId}')">${productName}</h3>
                        <p class="text-xs text-gray-500 line-clamp-2 mt-1">${product.description || ''}</p>
                    </div>
                    <div class="mt-4 flex items-center justify-between">
                        <span class="text-lg font-black text-gray-900">$${Number(product.price).toFixed(2)}</span>
                        <button onclick="addToCart('${productId}')" class="bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white px-3.5 py-2 rounded-xl transition text-xs font-bold flex items-center space-x-1 shadow-xs">
                            <i class="fa-solid fa-cart-plus"></i>
                            <span>Add</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Advanced Search & Filter Controller
let currentMaxPrice = 1500;

function handlePriceSlider(val) {
    currentMaxPrice = Number(val);
    const display = document.getElementById('price-slider-display');
    if (display) display.textContent = `$${currentMaxPrice}`;
    applyFiltersAndRender();
}

function filterCategory(category) {
    activeCategory = category;
    document.querySelectorAll('.category-btn').forEach(btn => {
        if (btn.textContent.toLowerCase().includes(category.toLowerCase()) || (category === 'All' && btn.textContent.includes('All'))) {
            btn.className = "category-btn px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap bg-indigo-600 text-white shadow-sm transition";
        } else {
            btn.className = "category-btn px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap bg-white text-gray-700 border border-gray-200 hover:bg-gray-100 transition";
        }
    });

    applyFiltersAndRender();
}

function handleSearch() {
    applyFiltersAndRender();
}

function resetFilters() {
    activeCategory = 'All';
    currentMaxPrice = 1500;
    const priceSlider = document.getElementById('price-slider');
    if (priceSlider) priceSlider.value = '1500';
    const priceDisplay = document.getElementById('price-slider-display');
    if (priceDisplay) priceDisplay.textContent = '$1500';

    const brandSelect = document.getElementById('brand-filter');
    if (brandSelect) brandSelect.value = 'All';

    const ratingSelect = document.getElementById('rating-filter');
    if (ratingSelect) ratingSelect.value = '0';

    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) sortSelect.value = 'featured';

    const searchDesktop = document.getElementById('search-input');
    if (searchDesktop) searchDesktop.value = '';
    const searchMobile = document.getElementById('mobile-search-input');
    if (searchMobile) searchMobile.value = '';

    document.querySelectorAll('.category-btn').forEach(btn => {
        if (btn.textContent.includes('All')) {
            btn.className = "category-btn px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap bg-indigo-600 text-white shadow-sm transition";
        } else {
            btn.className = "category-btn px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap bg-white text-gray-700 border border-gray-200 hover:bg-gray-100 transition";
        }
    });

    applyFiltersAndRender();
}

function applyFiltersAndRender() {
    const desktopVal = document.getElementById('search-input')?.value || '';
    const mobileVal = document.getElementById('mobile-search-input')?.value || '';
    const query = (desktopVal || mobileVal).toLowerCase().trim();

    const selectedBrand = document.getElementById('brand-filter')?.value || 'All';
    const minRating = Number(document.getElementById('rating-filter')?.value || 0);
    const sortBy = document.getElementById('sort-select')?.value || 'featured';

    let result = [...products];

    // Category filter
    if (activeCategory !== 'All') {
        result = result.filter(p => (p.category || '').toLowerCase() === activeCategory.toLowerCase());
    }

    // Brand filter
    if (selectedBrand !== 'All') {
        result = result.filter(p => (p.brand || '').toLowerCase() === selectedBrand.toLowerCase());
    }

    // Search query filter
    if (query !== '') {
        result = result.filter(p =>
            (p.title || p.name || '').toLowerCase().includes(query) ||
            (p.category || '').toLowerCase().includes(query) ||
            (p.brand || '').toLowerCase().includes(query) ||
            (p.description || '').toLowerCase().includes(query)
        );
    }

    // Max Price filter
    result = result.filter(p => Number(p.price || 0) <= currentMaxPrice);

    // Min Rating filter
    if (minRating > 0) {
        result = result.filter(p => Number(p.rating || 4.5) >= minRating);
    }

    // Sorting
    if (sortBy === 'price-asc') {
        result.sort((a, b) => Number(a.price) - Number(b.price));
    } else if (sortBy === 'price-desc') {
        result.sort((a, b) => Number(b.price) - Number(a.price));
    } else if (sortBy === 'rating') {
        result.sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
    } else if (sortBy === 'newest') {
        result.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }

    // Update results count
    const countElem = document.getElementById('product-results-count');
    if (countElem) {
        countElem.textContent = `Showing ${result.length} of ${products.length} products`;
    }

    renderProducts(result);
}

// --- PRODUCT DETAILS & REVIEWS MODAL (JUMIA STYLE WITH COLOR VARIANTS & ARROWS) ---
let selectedReviewRating = 5;
let currentProductVariants = [];
let currentColorVariantIdx = 0;

function getProductColorVariants(product) {
    const mainImg = product.image || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80';
    const cat = (product.category || '').toLowerCase();

    if (cat.includes('audio') || cat.includes('headphone')) {
        return [
            { name: 'Midnight Black', img: mainImg, colorCode: '#111827' },
            { name: 'Platinum Silver', img: 'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=600&auto=format&fit=crop&q=80', colorCode: '#e5e7eb' },
            { name: 'Rose Gold', img: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=600&auto=format&fit=crop&q=80', colorCode: '#fb7185' }
        ];
    } else if (cat.includes('phone') || cat.includes('mobile')) {
        return [
            { name: 'Phantom Black', img: mainImg, colorCode: '#0f172a' },
            { name: 'Titanium White', img: 'https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=600&auto=format&fit=crop&q=80', colorCode: '#f8fafc' },
            { name: 'Sierra Blue', img: 'https://images.unsplash.com/photo-1565849904461-04a58ad377e0?w=600&auto=format&fit=crop&q=80', colorCode: '#3b82f6' }
        ];
    } else if (cat.includes('laptop') || cat.includes('computing')) {
        return [
            { name: 'Space Gray', img: mainImg, colorCode: '#475569' },
            { name: 'Silver Aluminium', img: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600&auto=format&fit=crop&q=80', colorCode: '#cbd5e1' },
            { name: 'Matte Black', img: 'https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=600&auto=format&fit=crop&q=80', colorCode: '#1e293b' }
        ];
    } else {
        return [
            { name: 'Classic Black', img: mainImg, colorCode: '#18181b' },
            { name: 'Arctic White', img: 'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=600&auto=format&fit=crop&q=80', colorCode: '#f4f4f5' },
            { name: 'Champagne Gold', img: 'https://images.unsplash.com/photo-1539185441755-769473a23570?w=600&auto=format&fit=crop&q=80', colorCode: '#fde047' }
        ];
    }
}

function selectProductColor(idx) {
    if (!currentProductVariants || currentProductVariants.length === 0) return;
    
    currentColorVariantIdx = (idx + currentProductVariants.length) % currentProductVariants.length;
    const variant = currentProductVariants[currentColorVariantIdx];

    const mainImg = document.getElementById('main-product-img');
    if (mainImg) {
        mainImg.src = variant.img;
    }

    const fullImg = document.getElementById('fullscreen-img-element');
    if (fullImg) {
        fullImg.src = variant.img;
    }

    const label = document.getElementById('selected-color-label');
    if (label) {
        label.textContent = variant.name;
    }

    const fullLabel = document.getElementById('fullscreen-img-color-label');
    if (fullLabel) {
        fullLabel.textContent = variant.name;
    }

    document.querySelectorAll('.color-thumb-btn').forEach((btn, i) => {
        if (i === currentColorVariantIdx) {
            btn.className = "color-thumb-btn w-20 h-20 object-cover rounded-xl border-2 border-indigo-600 shadow-md ring-2 ring-indigo-300 cursor-pointer transition transform scale-105";
        } else {
            btn.className = "color-thumb-btn w-20 h-20 object-cover rounded-xl border border-gray-200 opacity-60 cursor-pointer hover:opacity-100 transition";
        }
    });
}

function prevProductColor() {
    selectProductColor(currentColorVariantIdx - 1);
}

function nextProductColor() {
    selectProductColor(currentColorVariantIdx + 1);
}

function openFullscreenImg() {
    if (!currentProductVariants || currentProductVariants.length === 0) return;
    const variant = currentProductVariants[currentColorVariantIdx];

    const fullImg = document.getElementById('fullscreen-img-element');
    if (fullImg) {
        fullImg.src = variant.img;
    }

    const fullLabel = document.getElementById('fullscreen-img-color-label');
    if (fullLabel) {
        fullLabel.textContent = variant.name;
    }

    document.getElementById('fullscreen-img-modal').classList.remove('hidden');
}

function closeFullscreenImg() {
    document.getElementById('fullscreen-img-modal').classList.add('hidden');
}

async function openProductModal(productId) {
    let product = products.find(p => (p._id || p.id) === productId);
    if (!product) return;

    // Try fetching freshest product data with reviews
    try {
        const res = await fetch(`${API_BASE}/products/${productId}`);
        if (res.ok) {
            const data = await safeParseResponse(res);
            if (data && data.title) {
                product = data;
                // update in local list
                const idx = products.findIndex(p => (p._id || p.id) === productId);
                if (idx !== -1) products[idx] = data;
            }
        }
    } catch (e) {}

    const modalContent = document.getElementById('modal-content');
    const productName = product.title || product.name;
    currentProductVariants = getProductColorVariants(product);
    currentColorVariantIdx = 0;

    const mainImage = currentProductVariants[0].img;
    const origPrice = (product.price * 1.25).toFixed(2);
    const avgRating = (Number(product.rating) || 4.8).toFixed(1);
    const reviewList = product.reviews || [];
    const totalReviews = product.ratingCount || reviewList.length || 18;
    const brand = product.brand || 'SD Originals';

    selectedReviewRating = 5;

    modalContent.innerHTML = `
        <!-- Header Back Bar -->
        <div class="flex items-center justify-between pb-3 mb-2 border-b border-gray-100">
            <button onclick="closeProductModal()" class="inline-flex items-center space-x-2 text-gray-700 hover:text-indigo-600 font-extrabold text-xs bg-gray-100 hover:bg-gray-200 px-3.5 py-2 rounded-xl transition shadow-xs">
                <i class="fa-solid fa-arrow-left text-sm"></i>
                <span>Back to Products</span>
            </button>
            <span class="text-xs text-gray-400 font-semibold hidden sm:inline">Product Details & Reviews</span>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-2">
            <!-- LEFT COLUMN: Color Image Gallery & Delivery Info (5 cols) -->
            <div class="lg:col-span-5 space-y-4">
                <!-- Main Image Card with Arrows & Full View Button -->
                <div class="relative bg-gray-50 rounded-2xl overflow-hidden border border-gray-200 group">
                    <img id="main-product-img" src="${mainImage}" onclick="openFullscreenImg()" class="w-full h-80 object-cover cursor-pointer hover:scale-105 transition duration-300">
                    
                    <!-- SD Express & Discount Badges -->
                    <div class="absolute top-3 left-3 flex flex-col space-y-1 z-10 pointer-events-none">
                        <span class="bg-amber-500 text-white font-extrabold text-[10px] px-2.5 py-1 rounded-md uppercase tracking-wider shadow">SD Express</span>
                        <span class="bg-rose-600 text-white font-extrabold text-[10px] px-2 py-0.5 rounded-md uppercase tracking-wider shadow">-20% OFF</span>
                    </div>

                    <!-- Full View Button -->
                    <button onclick="event.stopPropagation(); openFullscreenImg()" class="absolute top-3 right-3 bg-black/60 hover:bg-black/80 text-white text-xs font-bold px-3 py-1.5 rounded-xl backdrop-blur-md shadow-md transition flex items-center space-x-1.5 z-10">
                        <i class="fa-solid fa-expand text-xs"></i>
                        <span>Full View</span>
                    </button>

                    <!-- Navigation Arrows Overlay -->
                    <button onclick="event.stopPropagation(); prevProductColor()" class="absolute left-3 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-gray-800 w-9 h-9 rounded-full shadow-md backdrop-blur-sm flex items-center justify-center transition hover:scale-110 z-10">
                        <i class="fa-solid fa-chevron-left text-xs"></i>
                    </button>
                    <button onclick="event.stopPropagation(); nextProductColor()" class="absolute right-3 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-gray-800 w-9 h-9 rounded-full shadow-md backdrop-blur-sm flex items-center justify-center transition hover:scale-110 z-10">
                        <i class="fa-solid fa-chevron-right text-xs"></i>
                    </button>
                </div>

                <!-- Color Variants Selection Header & Thumbnails -->
                <div class="space-y-2">
                    <div class="flex items-center justify-between text-xs">
                        <span class="font-bold text-gray-700">Select Color Variation:</span>
                        <span id="selected-color-label" class="font-extrabold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full text-[11px]">${currentProductVariants[0].name}</span>
                    </div>
                    <div class="flex items-center space-x-3">
                        ${currentProductVariants.map((v, idx) => `
                            <div onclick="selectProductColor(${idx})" title="${v.name}" class="group relative">
                                <img src="${v.img}" class="color-thumb-btn w-20 h-20 object-cover rounded-xl ${idx === 0 ? 'border-2 border-indigo-600 shadow-md ring-2 ring-indigo-300 scale-105' : 'border border-gray-200 opacity-60 hover:opacity-100'} cursor-pointer transition">
                                <span class="absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full border border-white shadow-xs" style="background-color: ${v.colorCode}"></span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Delivery & Guarantee Badges Card -->
                <div class="bg-gray-50 p-4 rounded-2xl border border-gray-200 text-xs space-y-3 text-gray-700">
                    <div class="flex items-center space-x-3">
                        <div class="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold flex-shrink-0">
                            <i class="fa-solid fa-truck-fast"></i>
                        </div>
                        <div>
                            <span class="font-bold text-gray-900 block">Door Delivery</span>
                            <span class="text-gray-500 text-[11px]">Dispatch within 24-48 hours. Free shipping over $50.</span>
                        </div>
                    </div>
                    <div class="pt-2.5 border-t border-gray-200/80 flex items-center justify-between text-[11px] font-semibold">
                        <span class="text-gray-600"><i class="fa-solid fa-rotate-left text-emerald-600 mr-1"></i>7-Day Free Return</span>
                        <span class="text-gray-600"><i class="fa-solid fa-shield text-indigo-600 mr-1"></i>1 Year Warranty</span>
                    </div>
                </div>
            </div>

            <!-- RIGHT COLUMN: Product Details, Price & Reviews (7 cols) -->
            <div class="lg:col-span-7 flex flex-col justify-between space-y-5">
                <div class="space-y-4">
                    <!-- Brand & Category Row -->
                    <div class="flex items-center space-x-2 text-xs">
                        <span class="bg-indigo-100 text-indigo-700 font-black px-2.5 py-0.5 rounded-full uppercase text-[10px]">${brand}</span>
                        <span class="text-gray-300">•</span>
                        <span class="text-gray-500 font-bold uppercase tracking-wider">${product.category || 'General'}</span>
                    </div>

                    <!-- Product Name -->
                    <h2 class="text-2xl font-black text-gray-900 leading-tight">${productName}</h2>

                    <!-- Star Rating & Review Count Header -->
                    <div class="flex items-center space-x-3 pb-3 border-b border-gray-100">
                        <div class="flex items-center space-x-1 text-amber-400 text-sm">
                            <i class="fa-solid fa-star"></i>
                            <span class="text-gray-900 text-base font-black ml-1">${avgRating}</span>
                            <span class="text-xs text-gray-400 font-medium">/ 5</span>
                        </div>
                        <span class="text-gray-300">•</span>
                        <span class="text-xs font-bold text-indigo-600">${totalReviews} Customer Ratings</span>
                        <span class="text-gray-300">•</span>
                        <span class="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full">In Stock</span>
                    </div>

                    <!-- Jumia Price Card -->
                    <div class="bg-gray-50 p-4 rounded-2xl border border-gray-200 flex items-center justify-between">
                        <div>
                            <div class="flex items-baseline space-x-3">
                                <span class="text-3xl font-black text-gray-900">$${Number(product.price).toFixed(2)}</span>
                                <span class="text-sm text-gray-400 line-through font-semibold">$${origPrice}</span>
                            </div>
                            <span class="text-[11px] text-emerald-600 font-bold block mt-0.5">✓ Best Price Guaranteed</span>
                        </div>
                        <span class="bg-rose-50 text-rose-600 text-xs font-black px-3 py-1 rounded-xl border border-rose-200">-20% OFF</span>
                    </div>

                    <!-- Highlights & Description -->
                    <div>
                        <h4 class="text-xs font-black uppercase text-gray-400 tracking-wider mb-1">Product Description</h4>
                        <p class="text-gray-600 text-xs leading-relaxed">${product.description || 'High quality original product certified by SD Shopping.'}</p>
                    </div>

                    <!-- CUSTOMER REVIEWS FEED & SUBMISSION -->
                    <div class="pt-4 border-t border-gray-100 space-y-3">
                        <h4 class="text-xs font-black uppercase text-gray-900 tracking-wider">Customer Feedback & Reviews</h4>
                        
                        <!-- Submit Review Box -->
                        <div class="bg-gray-50 p-3.5 rounded-xl border border-gray-200 space-y-2">
                            <div class="flex items-center justify-between text-xs">
                                <span class="font-bold text-gray-700">Write a Customer Review</span>
                                <div class="flex items-center space-x-1 text-amber-400 cursor-pointer">
                                    ${[1, 2, 3, 4, 5].map(star => `
                                        <i onclick="setReviewRating(${star})" id="star-btn-${star}" class="fa-solid fa-star hover:scale-110 transition"></i>
                                    `).join('')}
                                </div>
                            </div>
                            <textarea id="review-comment" rows="2" placeholder="Tell other shoppers what you think about this product..." class="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-xs focus:outline-none focus:border-indigo-500"></textarea>
                            <button onclick="submitReview('${productId}')" class="bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold px-4 py-1.5 rounded-lg transition">Submit Review</button>
                        </div>

                        <!-- Review Comments List -->
                        <div class="space-y-2 max-h-40 overflow-y-auto pr-1">
                            ${reviewList.length === 0 ? `
                                <div class="py-3 text-center text-xs text-gray-400">No written reviews yet. Be the first to review this product!</div>
                            ` : reviewList.map(r => `
                                <div class="p-2.5 bg-gray-50/50 rounded-xl border border-gray-100 text-xs space-y-1">
                                    <div class="flex items-center justify-between">
                                        <div class="flex items-center space-x-1.5">
                                            <span class="font-bold text-gray-800">${r.userName || 'Verified Buyer'}</span>
                                            <span class="bg-emerald-50 text-emerald-700 text-[9px] font-bold px-1.5 py-0.5 rounded">Verified Purchase</span>
                                        </div>
                                        <div class="flex items-center text-amber-400 text-[10px]">
                                            ${Array.from({ length: 5 }).map((_, i) => `
                                                <i class="fa-solid fa-star ${i < (r.rating || 5) ? 'text-amber-400' : 'text-gray-200'}"></i>
                                            `).join('')}
                                        </div>
                                    </div>
                                    <p class="text-gray-600 text-[11px] leading-snug">${r.comment || 'Great quality product.'}</p>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>

                <!-- Action Buttons: Add To Cart & Buy Now -->
                <div class="pt-4 border-t border-gray-100 space-y-2">
                    <div class="grid grid-cols-2 gap-3">
                        <button onclick="addToCart('${productId}'); closeProductModal();" class="bg-amber-500 hover:bg-amber-600 text-white font-extrabold py-3.5 rounded-xl shadow-lg transition text-xs uppercase tracking-wider flex items-center justify-center space-x-2">
                            <i class="fa-solid fa-cart-plus text-sm"></i>
                            <span>ADD TO CART</span>
                        </button>
                        <button onclick="addToCart('${productId}'); closeProductModal(); switchTab('cart'); proceedToCheckout();" class="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-3.5 rounded-xl shadow-lg transition text-xs uppercase tracking-wider flex items-center justify-center space-x-2">
                            <i class="fa-solid fa-bolt text-sm"></i>
                            <span>BUY NOW</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('product-modal').classList.remove('hidden');
    setReviewRating(5);
}

function setReviewRating(rating) {
    selectedReviewRating = rating;
    for (let i = 1; i <= 5; i++) {
        const star = document.getElementById(`star-btn-${i}`);
        if (star) {
            if (i <= rating) {
                star.className = "fa-solid fa-star hover:scale-110 transition text-amber-400";
            } else {
                star.className = "fa-solid fa-star hover:scale-110 transition text-gray-300";
            }
        }
    }
}

async function submitReview(productId) {
    if (!authToken || !currentUser) {
        showToast('Please sign in to write a review', 'error');
        openAuthModal('login');
        return;
    }

    const commentInput = document.getElementById('review-comment');
    const comment = commentInput ? commentInput.value.trim() : '';

    if (!comment) {
        showToast('Please write a review comment', 'error');
        return;
    }

    showLoading('Submitting Review', 'Recording your verified customer review...');

    try {
        let res = await fetch(`${API_BASE}/products/${productId}/reviews`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                rating: selectedReviewRating,
                comment
            })
        });

        if (!res.ok) {
            res = await fetch(`${API_BASE}/reviews`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    productId,
                    rating: selectedReviewRating,
                    comment
                })
            });
        }

        const data = await safeParseResponse(res);
        if (!res.ok) throw new Error(data.error || 'Failed to submit review');

        showToast('Thank you! Your review has been published.');
        await fetchProducts();
        await openProductModal(productId);
    } catch (error) {
        console.error('Submit review error:', error);
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}

function closeProductModal() {
    document.getElementById('product-modal').classList.add('hidden');
}

// --- WISHLIST MANAGEMENT ---
function toggleWishlist(productId) {
    const product = products.find(p => (p._id || p.id) === productId);
    if (!product) return;

    const pId = product._id || product.id;
    const index = wishlist.findIndex(item => (item._id || item.id) === pId);

    if (index > -1) {
        wishlist.splice(index, 1);
        showToast('Removed from wishlist', 'error');
    } else {
        wishlist.push(product);
        showToast('Added to wishlist!');
    }

    localStorage.setItem('sd_wishlist', JSON.stringify(wishlist));
    updateBadges();
    renderProducts();
    if (!document.getElementById('tab-wishlist').classList.contains('hidden')) {
        renderWishlist();
    }
}

function renderWishlist() {
    const grid = document.getElementById('wishlist-grid');
    if (!grid) return;

    if (wishlist.length === 0) {
        grid.innerHTML = `<div class="col-span-full py-16 text-center text-gray-400">Your wishlist is currently empty.</div>`;
        return;
    }

    grid.innerHTML = wishlist.map(product => {
        const pId = product._id || product.id;
        const pName = product.title || product.name;
        const image = product.image || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=60';

        return `
            <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col justify-between">
                <div>
                    <img src="${image}" onclick="openProductModal('${pId}')" class="w-full h-40 object-cover rounded-xl mb-3 cursor-pointer hover:opacity-90 transition">
                    <h4 onclick="openProductModal('${pId}')" class="font-semibold text-gray-800 line-clamp-1 cursor-pointer hover:text-indigo-600 transition">${pName}</h4>
                    <span class="text-sm font-bold text-indigo-600 mt-1 block">$${Number(product.price).toFixed(2)}</span>
                </div>
                <div class="mt-4 flex space-x-2">
                    <button onclick="addToCart('${pId}')" class="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-xs font-semibold hover:bg-indigo-700 transition">Move to Cart</button>
                    <button onclick="toggleWishlist('${pId}')" class="bg-gray-100 text-gray-600 px-3 py-2 rounded-lg text-xs hover:bg-gray-200 transition"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `;
    }).join('');
}

// --- CART MANAGEMENT ---
function addToCart(productId) {
    const product = products.find(p => (p._id || p.id) === productId);
    if (!product) return;

    // Trigger swift visual top bar progress
    const topBar = document.getElementById('top-progress-bar');
    if (topBar) {
        topBar.classList.add('active');
        topBar.style.opacity = '1';
        topBar.style.width = '60%';
        setTimeout(() => {
            topBar.style.width = '100%';
            setTimeout(() => {
                topBar.classList.remove('active');
                topBar.style.opacity = '0';
                setTimeout(() => { topBar.style.width = '0%'; }, 200);
            }, 180);
        }, 120);
    }

    const pId = product._id || product.id;
    const existing = cart.find(item => (item._id || item.id) === pId);

    if (existing) {
        existing.qty += 1;
    } else {
        cart.push({ ...product, qty: 1 });
    }

    localStorage.setItem('sd_cart', JSON.stringify(cart));
    updateBadges();
    showToast(`Added ${product.title || product.name} to cart!`);
}

function updateCartQty(productId, delta) {
    const item = cart.find(i => (i._id || i.id) === productId);
    if (item) {
        item.qty += delta;
        if (item.qty <= 0) {
            cart = cart.filter(i => (i._id || i.id) !== productId);
        }
    }
    localStorage.setItem('sd_cart', JSON.stringify(cart));
    updateBadges();
    renderCart();
}

function removeFromCart(productId) {
    cart = cart.filter(i => (i._id || i.id) !== productId);
    localStorage.setItem('sd_cart', JSON.stringify(cart));
    updateBadges();
    renderCart();
    showToast('Item removed from cart', 'error');
}

function renderCart() {
    const container = document.getElementById('cart-items-container');
    const headerCount = document.getElementById('cart-header-count');
    if (!container) return;

    const totalItemQty = cart.reduce((sum, i) => sum + i.qty, 0);
    if (headerCount) {
        headerCount.textContent = `${totalItemQty} ${totalItemQty === 1 ? 'item' : 'items'}`;
    }

    if (cart.length === 0) {
        container.innerHTML = `
            <div class="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm space-y-4">
                <div class="w-20 h-20 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto text-3xl shadow-inner">
                    <i class="fa-solid fa-cart-shopping"></i>
                </div>
                <div>
                    <h3 class="text-xl font-extrabold text-gray-900">Your cart is empty!</h3>
                    <p class="text-gray-500 text-xs mt-1 max-w-sm mx-auto">Explore our wide category of top products and discover unbeatable deals today.</p>
                </div>
                <button onclick="switchTab('catalog')" class="bg-amber-500 hover:bg-amber-600 text-white font-extrabold px-8 py-3.5 rounded-xl shadow-lg transition text-xs uppercase tracking-wider inline-flex items-center space-x-2">
                    <i class="fa-solid fa-bag-shopping"></i>
                    <span>START SHOPPING</span>
                </button>
            </div>
        `;
        document.getElementById('cart-subtotal').textContent = '$0.00';
        document.getElementById('cart-discount').textContent = '-$0.00';
        document.getElementById('cart-shipping').textContent = '$0.00';
        document.getElementById('cart-total').textContent = '$0.00';
        const checkoutText = document.getElementById('cart-checkout-btn-text');
        if (checkoutText) checkoutText.textContent = 'CHECKOUT NOW';
        return;
    }

    container.innerHTML = cart.map(item => {
        const pId = item._id || item.id;
        const pName = item.title || item.name;
        const image = item.image || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=60';
        const origPrice = (item.price * 1.25).toFixed(2);

        return `
            <div class="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
                <!-- Top Status Header -->
                <div class="flex items-center justify-between pb-3 border-b border-gray-100 text-xs">
                    <span class="bg-amber-50 text-amber-700 font-extrabold text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center space-x-1">
                        <i class="fa-solid fa-bolt text-amber-500"></i>
                        <span>SD Express</span>
                    </span>
                    <span class="text-emerald-600 font-bold flex items-center space-x-1">
                        <i class="fa-solid fa-circle-check text-[10px]"></i>
                        <span>In Stock</span>
                    </span>
                </div>

                <!-- Main Content Row -->
                <div class="flex items-start space-x-4">
                    <img src="${image}" onclick="openProductModal('${pId}')" class="w-24 h-24 object-cover rounded-xl border border-gray-100 cursor-pointer hover:opacity-90 transition flex-shrink-0">
                    <div class="flex-1 min-w-0">
                        <h4 onclick="openProductModal('${pId}')" class="font-bold text-gray-900 text-sm cursor-pointer hover:text-indigo-600 transition line-clamp-2 leading-snug">${pName}</h4>
                        <span class="text-[11px] text-gray-400 block mt-0.5">Category: ${item.category || 'General'}</span>
                        
                        <div class="flex items-center space-x-2 mt-2">
                            <span class="text-lg font-black text-gray-900">$${Number(item.price).toFixed(2)}</span>
                            <span class="text-xs text-gray-400 line-through">$${origPrice}</span>
                            <span class="bg-rose-50 text-rose-600 font-extrabold text-[10px] px-2 py-0.5 rounded-md">-20%</span>
                        </div>
                    </div>
                </div>

                <!-- Jumia Bottom Action Bar -->
                <div class="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                    <div class="flex items-center space-x-4">
                        <button onclick="removeFromCart('${pId}')" class="text-rose-600 hover:text-rose-700 text-xs font-bold flex items-center space-x-1 transition">
                            <i class="fa-solid fa-trash-can"></i>
                            <span>REMOVE</span>
                        </button>
                        <button onclick="toggleWishlist('${pId}')" class="text-gray-500 hover:text-indigo-600 text-xs font-semibold flex items-center space-x-1 transition hidden sm:flex">
                            <i class="fa-regular fa-heart"></i>
                            <span>Save for Later</span>
                        </button>
                    </div>

                    <!-- Quantity Control Selector -->
                    <div class="flex items-center space-x-1 bg-gray-50 border border-gray-200 rounded-xl p-1">
                        <button onclick="updateCartQty('${pId}', -1)" class="w-7 h-7 rounded-lg bg-white shadow-xs text-gray-700 hover:bg-gray-200 font-bold flex items-center justify-center transition text-xs">-</button>
                        <span class="w-8 text-center text-xs font-extrabold text-gray-900">${item.qty}</span>
                        <button onclick="updateCartQty('${pId}', 1)" class="w-7 h-7 rounded-lg bg-white shadow-xs text-gray-700 hover:bg-gray-200 font-bold flex items-center justify-center transition text-xs">+</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    calculateTotals();
}

function calculateTotals() {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const discountAmt = subtotal * (appliedDiscount / 100);
    const shipping = subtotal > 50 || subtotal === 0 ? 0 : 5.00;
    const total = subtotal - discountAmt + shipping;

    document.getElementById('cart-subtotal').textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById('cart-discount').textContent = `-$${discountAmt.toFixed(2)}`;
    document.getElementById('cart-shipping').textContent = shipping === 0 ? 'FREE' : `$${shipping.toFixed(2)}`;
    document.getElementById('cart-total').textContent = `$${total.toFixed(2)}`;

    const checkoutText = document.getElementById('cart-checkout-btn-text');
    if (checkoutText) {
        checkoutText.textContent = `CHECKOUT ($${total.toFixed(2)})`;
    }
}

async function applyCoupon() {
    const codeInput = document.getElementById('coupon-input');
    const code = codeInput ? codeInput.value.trim().toUpperCase() : '';

    if (!code) {
        showToast('Please enter a coupon code', 'error');
        return;
    }

    setButtonLoading('apply-coupon-btn', true, 'Please wait...');
    showLoading('Please wait', 'Validating discount voucher...');

    await new Promise(r => setTimeout(r, 450));

    try {
        if (code === 'SAVE10') {
            appliedDiscount = 10;
            showToast('🎉 Coupon applied: 10% Off!');
            calculateTotals();
        } else {
            showToast('Invalid coupon code. Try SAVE10', 'error');
        }
    } finally {
        setButtonLoading('apply-coupon-btn', false);
        hideLoading();
    }
}

function updateBadges() {
    const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);
    const cartBadge = document.getElementById('cart-badge');
    if (cartBadge) {
        if (cartCount > 0) {
            cartBadge.textContent = cartCount;
            cartBadge.classList.remove('hidden');
        } else {
            cartBadge.classList.add('hidden');
        }
    }

    const wishBadge = document.getElementById('wishlist-badge');
    if (wishBadge) {
        if (wishlist.length > 0) {
            wishBadge.textContent = wishlist.length;
            wishBadge.classList.remove('hidden');
        } else {
            wishBadge.classList.add('hidden');
        }
    }
}

// --- PAYMENT GATEWAY & CHECKOUT ---
let activePaymentMethod = 'card';
let pendingOrderTotal = 0;

async function proceedToCheckout() {
    if (cart.length === 0) {
        showToast('Your shopping cart is empty', 'error');
        return;
    }

    if (!authToken || !currentUser) {
        showToast('Please sign in first to place your order', 'error');
        openAuthModal('login');
        return;
    }

    setButtonLoading('cart-checkout-btn', true, 'Please wait...');
    showLoading('Please wait', 'Setting up secure checkout...');

    await new Promise(r => setTimeout(r, 350));

    try {
        const shippingAddressInput = document.getElementById('shipping-address-input');
        const shippingAddress = shippingAddressInput ? shippingAddressInput.value.trim() : '';

        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        const discountAmt = subtotal * (appliedDiscount / 100);
        const shipping = subtotal > 50 ? 0 : 5.00;
        pendingOrderTotal = subtotal - discountAmt + shipping;

        document.getElementById('pay-modal-total').textContent = `$${pendingOrderTotal.toFixed(2)}`;
        document.getElementById('cod-amount').textContent = `$${pendingOrderTotal.toFixed(2)}`;
        document.getElementById('pay-btn-text').textContent = `Confirm & Pay $${pendingOrderTotal.toFixed(2)}`;

        const payAddressInput = document.getElementById('pay-address');
        if (payAddressInput && shippingAddress) {
            payAddressInput.value = shippingAddress;
        }

        document.getElementById('payment-modal').classList.remove('hidden');
    } finally {
        setButtonLoading('cart-checkout-btn', false);
        hideLoading();
    }
}

function closePaymentModal() {
    document.getElementById('payment-modal').classList.add('hidden');
}

function selectPaymentMethod(method) {
    activePaymentMethod = method;
    const tabs = ['card', 'momo', 'cod'];

    tabs.forEach(t => {
        const btn = document.getElementById(`pay-tab-${t}`);
        const form = document.getElementById(`pay-form-${t}`);

        if (t === method) {
            if (btn) btn.className = "pay-method-btn border-2 border-indigo-600 bg-indigo-50/50 text-indigo-700 py-2.5 px-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center space-y-1 transition";
            if (form) form.classList.remove('hidden');
        } else {
            if (btn) btn.className = "pay-method-btn border border-gray-200 bg-gray-50 text-gray-600 py-2.5 px-2 rounded-xl text-xs font-medium flex flex-col items-center justify-center space-y-1 hover:bg-gray-100 transition";
            if (form) form.classList.add('hidden');
        }
    });

    const submitText = document.getElementById('pay-btn-text');
    if (submitText) {
        if (method === 'cod') {
            submitText.textContent = `Place Order ($${pendingOrderTotal.toFixed(2)})`;
        } else {
            submitText.textContent = `Confirm & Pay $${pendingOrderTotal.toFixed(2)}`;
        }
    }
}

async function submitPayment(e) {
    e.preventDefault();

    const address = (document.getElementById('pay-address')?.value || '').trim();
    if (!address) {
        showToast('Please enter a valid delivery address', 'error');
        return;
    }

    let paymentMethodName = 'Credit / Debit Card';
    let momoNoticeText = '';

    if (activePaymentMethod === 'card') {
        const cNum = (document.getElementById('card-number')?.value || '').trim();
        const cExp = (document.getElementById('card-expiry')?.value || '').trim();
        const cCvv = (document.getElementById('card-cvv')?.value || '').trim();
        if (cNum.length < 12 || !cExp || !cCvv) {
            showToast('Please complete all credit card details', 'error');
            return;
        }
        paymentMethodName = 'Credit / Debit Card';
    } else if (activePaymentMethod === 'momo') {
        const net = document.getElementById('momo-network')?.value || 'Mobile Money';
        const phone = (document.getElementById('momo-phone')?.value || '').trim();
        if (!phone || phone.length < 8) {
            showToast('Please enter a valid Mobile Money number', 'error');
            return;
        }
        paymentMethodName = `${net} (${phone})`;

        // Trigger Paystack Live MoMo Charge USSD Prompt
        try {
            const momoRes = await fetch(`${API_BASE}/payments/momo-charge`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    email: currentUser ? currentUser.email : 'customer@example.com',
                    phone,
                    provider: net,
                    amount: pendingOrderTotal
                })
            });

            const momoData = await safeParseResponse(momoRes);
            if (momoData.displayText) {
                momoNoticeText = momoData.displayText;
            }
        } catch (momoErr) {
            console.warn('MoMo direct charge notice:', momoErr);
        }
    } else if (activePaymentMethod === 'cod') {
        paymentMethodName = 'Cash on Delivery';
    }

    setButtonLoading('pay-submit-btn', true, 'Please wait...');
    showLoading('Please wait', 'Processing payment & placing order securely...');

    // Processing delay for USSD prompt dispatch & confirmation
    await new Promise(res => setTimeout(res, 1000));

    const orderPayload = {
        items: cart.map(item => ({
            productId: item._id || item.id,
            title: item.title || item.name,
            price: item.price,
            quantity: item.qty,
            image: item.image
        })),
        totalAmount: pendingOrderTotal,
        shippingAddress: address,
        paymentMethod: paymentMethodName,
        userEmail: currentUser ? currentUser.email : ''
    };

    try {
        const response = await fetch(`${API_BASE}/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(orderPayload)
        });

        const data = await safeParseResponse(response);
        if (!response.ok) throw new Error(data.error || 'Failed to complete payment');

        closePaymentModal();
        cart = [];
        localStorage.setItem('sd_cart', JSON.stringify(cart));
        updateBadges();
        await fetchOrders();

        const userEmail = currentUser ? currentUser.email : 'your inbox';
        if (momoNoticeText) {
            showToast(`📲 ${momoNoticeText}. Receipt emailed to ${userEmail}!`);
        } else {
            showToast(`🎉 Payment successful! Official receipt sent to ${userEmail}.`);
        }
        switchTab('orders');
    } catch (error) {
        console.error('Payment error:', error);
        showToast(error.message, 'error');
    } finally {
        setButtonLoading('pay-submit-btn', false);
        hideLoading();
    }
}

async function fetchOrders() {
    if (!authToken) return;

    const topBar = document.getElementById('top-progress-bar');
    if (topBar) {
        topBar.classList.add('active');
        topBar.style.opacity = '1';
        topBar.style.width = '40%';
    }

    try {
        const response = await fetch(`${API_BASE}/orders`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (!response.ok) throw new Error('Failed to fetch orders');
        orders = await safeParseResponse(response);
        localStorage.setItem('sd_orders', JSON.stringify(orders));
        renderOrders();
    } catch (error) {
        console.error('Fetch orders error:', error);
    } finally {
        if (topBar) {
            topBar.style.width = '100%';
            setTimeout(() => {
                topBar.classList.remove('active');
                topBar.style.opacity = '0';
                setTimeout(() => { topBar.style.width = '0%'; }, 200);
            }, 180);
        }
    }
}

// --- ORDER STATUS & LIVE TRACKING ENGINE ---

const ORDER_STATUS_CONFIG = {
    pending: { label: 'Order Placed', color: 'bg-amber-100 text-amber-800 border-amber-300', icon: 'fa-receipt', step: 1, percent: 15 },
    processing: { label: 'Processing & Packed', color: 'bg-indigo-100 text-indigo-800 border-indigo-300', icon: 'fa-box-open', step: 2, percent: 45 },
    shipped: { label: 'Shipped & In Transit', color: 'bg-purple-100 text-purple-800 border-purple-300', icon: 'fa-truck-fast', step: 3, percent: 75 },
    delivered: { label: 'Delivered', color: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: 'fa-circle-check', step: 4, percent: 100 },
    cancelled: { label: 'Cancelled', color: 'bg-rose-100 text-rose-800 border-rose-300', icon: 'fa-ban', step: 0, percent: 0 }
};

function getStatusBadge(status = 'processing') {
    const s = (status || 'processing').toLowerCase();
    const config = ORDER_STATUS_CONFIG[s] || ORDER_STATUS_CONFIG.processing;
    return `
        <span class="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-extrabold border ${config.color}">
            <i class="fa-solid ${config.icon} text-[10px]"></i>
            <span>${config.label}</span>
        </span>
    `;
}

function renderOrderStepper(status = 'processing') {
    const s = (status || 'processing').toLowerCase();
    if (s === 'cancelled') {
        return `
            <div class="mt-4 p-3 bg-rose-50 text-rose-700 rounded-xl text-xs font-semibold flex items-center space-x-2 border border-rose-200">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <span>This order was cancelled. Payment has been refunded.</span>
            </div>
        `;
    }

    const currentStep = ORDER_STATUS_CONFIG[s]?.step || 2;
    const steps = [
        { num: 1, name: 'Placed', icon: 'fa-receipt' },
        { num: 2, name: 'Packed', icon: 'fa-box-open' },
        { num: 3, name: 'Shipped', icon: 'fa-truck-fast' },
        { num: 4, name: 'Delivered', icon: 'fa-house-circle-check' }
    ];

    return `
        <div class="mt-5 pt-4 border-t border-gray-100">
            <div class="relative flex items-center justify-between">
                <!-- Background track line -->
                <div class="absolute left-6 right-6 top-4 -translate-y-1/2 h-1.5 bg-gray-200 rounded-full z-0"></div>
                <!-- Active progress track line -->
                <div class="absolute left-6 top-4 -translate-y-1/2 h-1.5 bg-indigo-600 rounded-full z-0 transition-all duration-500" style="width: calc(${((currentStep - 1) / 3) * 100}% - 12px);"></div>

                ${steps.map(step => {
                    const isDone = step.num < currentStep;
                    const isCurrent = step.num === currentStep;
                    
                    let circleStyle = 'bg-white border-2 border-gray-300 text-gray-400';
                    if (isDone) circleStyle = 'bg-indigo-600 border-2 border-indigo-600 text-white';
                    if (isCurrent) circleStyle = 'bg-indigo-600 border-4 border-indigo-200 text-white shadow-md ring-2 ring-indigo-500 animate-pulse';

                    return `
                        <div class="relative z-10 flex flex-col items-center">
                            <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition duration-300 ${circleStyle}">
                                <i class="fa-solid ${isDone ? 'fa-check' : step.icon}"></i>
                            </div>
                            <span class="text-[10px] sm:text-[11px] font-bold mt-1.5 ${isCurrent ? 'text-indigo-600' : isDone ? 'text-gray-900' : 'text-gray-400'}">${step.name}</span>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

function renderOrders() {
    const container = document.getElementById('orders-container');
    if (!container) return;

    if (orders.length === 0) {
        container.innerHTML = `
            <div class="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm">
                <div class="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                    <i class="fa-solid fa-box-archive"></i>
                </div>
                <h3 class="text-lg font-bold text-gray-900">No Orders Found</h3>
                <p class="text-xs text-gray-500 mt-1 max-w-sm mx-auto">You have not placed any orders yet. Explore our catalog and place your first order!</p>
                <button onclick="switchTab('catalog')" class="mt-5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-6 py-2.5 rounded-xl shadow transition inline-flex items-center space-x-2">
                    <i class="fa-solid fa-bag-shopping"></i>
                    <span>Browse Products</span>
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = orders.map(order => {
        const id = order._id || order.id || 'order_0';
        const orderId = `ORD-${id.substring(Math.max(0, id.length - 6)).toUpperCase()}`;
        const trackingNum = order.trackingNumber || ('SD-TRK-' + Math.floor(100000 + Math.random() * 900000));
        const dateStr = order.createdAt ? new Date(order.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Recent';
        const total = order.totalAmount || order.total || 0;
        const status = (order.status || 'processing').toLowerCase();
        const payMethod = order.paymentMethod || 'Credit Card';
        const items = order.items || [];
        const address = typeof order.shippingAddress === 'string' ? order.shippingAddress : (order.shippingAddress?.street || order.shippingAddress?.address || 'Customer Delivery Address');

        // Next simulated stage
        let nextStatusText = '';
        let nextStatusAction = '';
        if (status === 'pending') { nextStatusText = 'Advance to Packed'; nextStatusAction = 'processing'; }
        else if (status === 'processing') { nextStatusText = 'Advance to Shipped'; nextStatusAction = 'shipped'; }
        else if (status === 'shipped') { nextStatusText = 'Advance to Delivered'; nextStatusAction = 'delivered'; }

        return `
            <div class="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition">
                <!-- Top Row: Order ID, Tracking Badge, Date & Status -->
                <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-100 gap-3">
                    <div>
                        <div class="flex flex-wrap items-center gap-2">
                            <span class="font-black text-gray-900 text-sm sm:text-base">${orderId}</span>
                            <button onclick="copyToClipboard('${trackingNum}')" class="bg-gray-100 hover:bg-gray-200 text-gray-700 text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-lg inline-flex items-center space-x-1 transition" title="Click to copy tracking code">
                                <i class="fa-solid fa-barcode text-gray-400"></i>
                                <span>${trackingNum}</span>
                                <i class="fa-regular fa-copy text-[10px] text-gray-400"></i>
                            </button>
                        </div>
                        <p class="text-xs text-gray-500 mt-1">Placed on <span class="font-medium text-gray-700">${dateStr}</span> • Shipping to: <span class="text-gray-700 font-medium">${address}</span></p>
                    </div>

                    <div class="flex items-center space-x-3 self-start sm:self-center">
                        ${getStatusBadge(status)}
                        <span class="font-black text-indigo-600 text-lg">$${Number(total).toFixed(2)}</span>
                    </div>
                </div>

                <!-- 4-Step Interactive Stepper Bar -->
                ${renderOrderStepper(status)}

                <!-- Items & Action Buttons -->
                <div class="pt-5 mt-2 flex flex-col md:flex-row md:items-center justify-between gap-4 border-t border-gray-100/80">
                    <div class="space-y-1">
                        <span class="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Items in Package:</span>
                        <div class="text-xs font-semibold text-gray-800 flex flex-wrap gap-1.5">
                            ${items.map(i => `<span class="bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-md">${i.quantity || i.qty || 1}x ${i.title || i.name}</span>`).join('')}
                        </div>
                    </div>

                    <!-- Action Controls -->
                    <div class="flex items-center space-x-2">
                        <button onclick="openTrackingModal('${id}')" class="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-sm transition inline-flex items-center space-x-1.5">
                            <i class="fa-solid fa-location-crosshairs"></i>
                            <span>Tracking</span>
                        </button>

                        <button onclick="openInvoiceModal('${id}')" class="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold px-3.5 py-2 rounded-xl transition inline-flex items-center space-x-1.5" title="View & Print Official Receipt">
                            <i class="fa-solid fa-file-invoice text-indigo-600"></i>
                            <span>Receipt</span>
                        </button>

                        ${nextStatusAction ? `
                            <button onclick="advanceOrderStatus('${id}', '${nextStatusAction}')" class="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold px-3 py-2 rounded-xl transition inline-flex items-center space-x-1" title="Simulate courier delivery step">
                                <i class="fa-solid fa-forward-step text-indigo-600"></i>
                                <span>${nextStatusText}</span>
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// --- LIVE TRACKING MODAL ENGINE ---

async function openTrackingModal(orderIdOrTracking) {
    const modal = document.getElementById('tracking-modal');
    const content = document.getElementById('tracking-modal-content');
    if (!modal || !content) return;

    modal.classList.remove('hidden');
    content.innerHTML = `
        <div class="py-12 text-center text-gray-500 space-y-3">
            <i class="fa-solid fa-circle-notch fa-spin text-3xl text-indigo-600"></i>
            <p class="text-xs font-semibold">Connecting to SD Express Tracking Satellite...</p>
        </div>
    `;

    try {
        let order = orders.find(o => (o._id || o.id) === orderIdOrTracking || o.trackingNumber === orderIdOrTracking);

        // If not in local array, fetch from server public tracking route
        if (!order) {
            const res = await fetch(`${API_BASE}/orders/track/${encodeURIComponent(orderIdOrTracking)}`);
            const data = await safeParseResponse(res);
            if (!res.ok) throw new Error(data.error || 'Tracking lookup failed');
            order = data;
        }

        const id = order._id || order.id || order.orderId || 'ORD-0';
        const trackingNum = order.trackingNumber || 'SD-TRK-982104';
        const status = (order.status || 'processing').toLowerCase();
        const carrier = order.carrier || 'SD Express Delivery';
        const estDate = order.estimatedDelivery ? new Date(order.estimatedDelivery).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }) : '3 Business Days';
        const history = order.statusHistory && order.statusHistory.length > 0 ? order.statusHistory : [
            { status: 'pending', title: 'Order Placed', description: 'Order received & verified.', location: 'SD Hub', timestamp: order.createdAt || new Date() },
            { status: 'processing', title: 'Packed & Processed', description: 'Items securely packed.', location: 'Fulfillment Hub', timestamp: new Date() }
        ];

        content.innerHTML = `
            <!-- Modal Header -->
            <div class="pb-4 border-b border-gray-200">
                <div class="flex items-center space-x-2">
                    <span class="bg-indigo-100 text-indigo-700 text-xs font-black uppercase px-2.5 py-0.5 rounded-full">Live Tracking</span>
                    <span class="text-xs text-gray-400">• Carrier: <strong class="text-gray-700">${carrier}</strong></span>
                </div>
                <div class="flex flex-wrap items-center justify-between mt-2 gap-2">
                    <div>
                        <h3 class="text-xl font-black text-gray-900 font-mono">${trackingNum}</h3>
                        <p class="text-xs text-gray-500 mt-0.5">Estimated Delivery: <strong class="text-emerald-700">${estDate}</strong></p>
                    </div>
                    <div>
                        ${getStatusBadge(status)}
                    </div>
                </div>
            </div>

            <!-- Stepper Progress Bar -->
            <div class="py-4">
                ${renderOrderStepper(status)}
            </div>

            <!-- Activity Logs Timeline -->
            <div class="mt-4 pt-4 border-t border-gray-100">
                <h4 class="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Tracking Activity Log</h4>
                
                <div class="space-y-4 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
                    ${[...history].reverse().map((entry, idx) => {
                        const timeStr = entry.timestamp ? new Date(entry.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Just now';
                        const isLatest = idx === 0;
                        return `
                            <div class="relative pl-8 flex flex-col sm:flex-row sm:items-start justify-between gap-1">
                                <div class="absolute left-1.5 top-1.5 w-3.5 h-3.5 rounded-full ${isLatest ? 'bg-indigo-600 ring-4 ring-indigo-100' : 'bg-gray-400'}"></div>
                                <div>
                                    <h5 class="text-xs font-bold ${isLatest ? 'text-indigo-900 font-black' : 'text-gray-800'}">${entry.title || 'Status Update'}</h5>
                                    <p class="text-xs text-gray-500 mt-0.5">${entry.description || ''}</p>
                                    <span class="text-[11px] text-gray-400 inline-flex items-center space-x-1 mt-1">
                                        <i class="fa-solid fa-location-dot text-[10px] text-indigo-500"></i>
                                        <span>${entry.location || 'Distribution Center'}</span>
                                    </span>
                                </div>
                                <span class="text-[11px] font-mono text-gray-400 whitespace-nowrap">${timeStr}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>

            <!-- Modal Footer Actions -->
            <div class="mt-6 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
                <button onclick="copyToClipboard('${trackingNum}')" class="text-xs font-bold text-gray-600 hover:text-indigo-600 bg-gray-100 hover:bg-gray-200 px-3.5 py-2 rounded-xl transition inline-flex items-center space-x-1.5">
                    <i class="fa-regular fa-copy"></i>
                    <span>Copy Tracking Code</span>
                </button>
                <button onclick="closeTrackingModal()" class="bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold px-5 py-2 rounded-xl shadow transition">
                    Close Tracker
                </button>
            </div>
        `;
    } catch (err) {
        content.innerHTML = `
            <div class="py-8 text-center space-y-3">
                <div class="w-12 h-12 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto text-xl">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                </div>
                <h4 class="text-sm font-bold text-gray-900">Package Not Found</h4>
                <p class="text-xs text-gray-500">${err.message}</p>
                <button onclick="closeTrackingModal()" class="mt-4 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold px-4 py-2 rounded-xl transition">
                    Close
                </button>
            </div>
        `;
    }
}

function closeTrackingModal() {
    const modal = document.getElementById('tracking-modal');
    if (modal) modal.classList.add('hidden');
}

// --- PRINTABLE INVOICE / RECEIPT ENGINE ---

function openInvoiceModal(orderId) {
    const modal = document.getElementById('invoice-modal');
    const content = document.getElementById('invoice-modal-content');
    if (!modal || !content) return;

    const order = orders.find(o => (o._id || o.id) === orderId);
    if (!order) {
        showToast('Order details not found', 'error');
        return;
    }

    const id = order._id || order.id || 'order_0';
    const orderIdCode = `ORD-${id.toString().substring(Math.max(0, id.toString().length - 6)).toUpperCase()}`;
    const trackingNum = order.trackingNumber || 'SD-TRK-982104';
    const total = Number(order.totalAmount || 0).toFixed(2);
    const items = order.items || [];
    const address = typeof order.shippingAddress === 'string' ? order.shippingAddress : (order.shippingAddress?.street || order.shippingAddress?.address || 'Customer Delivery Address');
    const payMethod = order.paymentMethod || 'Credit Card';
    const dateStr = new Date(order.createdAt || Date.now()).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    const customerName = (currentUser && currentUser.name) || 'Valued Customer';
    const customerEmail = (currentUser && currentUser.email) || 'customer@example.com';

    modal.classList.remove('hidden');
    content.innerHTML = `
        <div class="space-y-6">
            <!-- Receipt Header -->
            <div class="flex items-start justify-between border-b border-gray-200 pb-5">
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 rounded-xl bg-indigo-600 text-white font-black flex items-center justify-center text-lg">SD</div>
                    <div>
                        <h3 class="text-xl font-black text-gray-900 tracking-tight">SD Shopping</h3>
                        <p class="text-[11px] text-gray-400">Official Purchase Invoice</p>
                    </div>
                </div>
                <div class="text-right">
                    <span class="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider">PAID & VERIFIED</span>
                    <p class="text-xs font-mono font-bold text-gray-800 mt-1">${orderIdCode}</p>
                </div>
            </div>

            <!-- Meta Details Grid -->
            <div class="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl text-xs">
                <div>
                    <span class="text-gray-400 font-bold block uppercase text-[10px]">Billed To:</span>
                    <strong class="text-gray-900 block text-sm">${customerName}</strong>
                    <span class="text-gray-500">${customerEmail}</span>
                    <span class="text-gray-600 block mt-1">${address}</span>
                </div>
                <div class="text-right space-y-1">
                    <div>
                        <span class="text-gray-400 font-bold uppercase text-[10px]">Issue Date:</span>
                        <span class="text-gray-800 font-semibold block">${dateStr}</span>
                    </div>
                    <div>
                        <span class="text-gray-400 font-bold uppercase text-[10px]">Tracking Number:</span>
                        <span class="text-indigo-600 font-mono font-bold block">${trackingNum}</span>
                    </div>
                    <div>
                        <span class="text-gray-400 font-bold uppercase text-[10px]">Payment Method:</span>
                        <span class="text-gray-800 font-semibold block">${payMethod}</span>
                    </div>
                </div>
            </div>

            <!-- Items Table -->
            <div>
                <h4 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Order Items</h4>
                <div class="border border-gray-200 rounded-xl overflow-hidden">
                    <table class="w-full text-xs text-left">
                        <thead class="bg-gray-100/75 text-gray-600 font-bold border-b border-gray-200 uppercase text-[10px]">
                            <tr>
                                <th class="p-3">Item Description</th>
                                <th class="p-3 text-center">Qty</th>
                                <th class="p-3 text-right">Unit Price</th>
                                <th class="p-3 text-right">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100">
                            ${items.map(item => {
                                const qty = item.quantity || item.qty || 1;
                                const unitPrice = Number(item.price || 0);
                                const itemSubtotal = unitPrice * qty;
                                return `
                                    <tr>
                                        <td class="p-3 font-semibold text-gray-900">${item.title || item.name}</td>
                                        <td class="p-3 text-center text-gray-500 font-mono">${qty}</td>
                                        <td class="p-3 text-right text-gray-600 font-mono">$${unitPrice.toFixed(2)}</td>
                                        <td class="p-3 text-right font-bold text-gray-900 font-mono">$${itemSubtotal.toFixed(2)}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Total Amount Line -->
            <div class="flex justify-between items-center pt-2 border-t border-gray-200">
                <span class="text-xs font-bold text-gray-500 uppercase">Grand Total (Paid)</span>
                <span class="text-2xl font-black text-indigo-600 font-mono">$${total}</span>
            </div>

            <!-- Invoice Modal Buttons -->
            <div class="pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 print:hidden">
                <button onclick="window.print()" class="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow transition inline-flex items-center space-x-2">
                    <i class="fa-solid fa-print"></i>
                    <span>Print Receipt / PDF</span>
                </button>
                <button onclick="closeInvoiceModal()" class="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold px-4 py-2.5 rounded-xl transition">
                    Close Invoice
                </button>
            </div>
        </div>
    `;
}

function closeInvoiceModal() {
    const modal = document.getElementById('invoice-modal');
    if (modal) modal.classList.add('hidden');
}

async function handleQuickTrack(e) {
    e.preventDefault();
    const input = document.getElementById('quick-track-input');
    if (!input || !input.value.trim()) return;

    const trackingNum = input.value.trim();
    openTrackingModal(trackingNum);
}

async function advanceOrderStatus(orderId, nextStatus) {
    if (!authToken) {
        openAuthModal('login');
        return;
    }

    showLoading('Updating package status', `Advancing order to ${nextStatus}...`);

    try {
        const res = await fetch(`${API_BASE}/orders/${orderId}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ status: nextStatus })
        });

        const data = await safeParseResponse(res);
        if (!res.ok) throw new Error(data.error || 'Failed to advance status');

        // Update local orders list
        const idx = orders.findIndex(o => (o._id || o.id) === orderId);
        if (idx !== -1) {
            orders[idx] = data.order || { ...orders[idx], status: nextStatus };
        }

        renderOrders();
        showToast(`Order status updated to "${nextStatus.toUpperCase()}"!`);
    } catch (err) {
        console.error('Advance status error:', err);
        showToast(err.message, 'error');
    } finally {
        hideLoading();
    }
}

function copyToClipboard(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text);
        showToast('Tracking number copied to clipboard!');
    }
}

// --- AUTHENTICATION & OTP SYSTEM ---
function showAuthError(message) {
    const errorBox = document.getElementById('auth-modal-error');
    const errorText = document.getElementById('auth-modal-error-text');
    if (errorBox && errorText) {
        errorText.textContent = message;
        errorBox.classList.remove('hidden');
    }
}

function hideAuthError() {
    const errorBox = document.getElementById('auth-modal-error');
    if (errorBox) {
        errorBox.classList.add('hidden');
    }
}

function openAuthModal(mode = 'login') {
    hideAuthError();
    showAuthMode(mode);
    document.getElementById('auth-modal').classList.remove('hidden');
}

function closeAuthModal() {
    hideAuthError();
    document.getElementById('auth-modal').classList.add('hidden');
}

function showAuthMode(mode) {
    hideAuthError();
    document.getElementById('auth-login-panel').classList.add('hidden');
    document.getElementById('auth-register-panel').classList.add('hidden');
    document.getElementById('auth-otp-panel').classList.add('hidden');

    if (mode === 'login') {
        document.getElementById('auth-login-panel').classList.remove('hidden');
    } else if (mode === 'register') {
        document.getElementById('auth-register-panel').classList.remove('hidden');
    } else if (mode === 'otp') {
        document.getElementById('auth-otp-panel').classList.remove('hidden');
    }
}

async function handleLoginSubmit(e) {
    e.preventDefault();
    hideAuthError();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    setButtonLoading('login-submit-btn', true, 'Please wait...');
    showLoading('Please wait', 'Verifying credentials & sending OTP...');

    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await safeParseResponse(response);
        if (!response.ok) throw new Error(data.error || 'Login failed');

        if (data.requireOtp) {
            pendingEmail = email;
            const targetEmailEl = document.getElementById('otp-target-email');
            if (targetEmailEl) targetEmailEl.textContent = email;

            showAuthMode('otp');
            showToast('Verification code sent to your email!');
            return;
        }

        authToken = data.token;
        currentUser = data.user;

        localStorage.setItem('sd_token', authToken);
        localStorage.setItem('sd_user', JSON.stringify(currentUser));

        updateAuthUI();
        closeAuthModal();
        showToast(`Welcome back, ${currentUser.name}!`);
        await fetchOrders();
    } catch (error) {
        console.error('Login error:', error);
        showAuthError(error.message);
        showToast(error.message, 'error');
    } finally {
        setButtonLoading('login-submit-btn', false);
        hideLoading();
    }
}

async function handleRegisterSubmit(e) {
    e.preventDefault();
    hideAuthError();
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;

    setButtonLoading('reg-submit-btn', true, 'Please wait...');
    showLoading('Please wait', 'Sending 6-digit verification code...');

    try {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });

        const data = await safeParseResponse(response);
        if (!response.ok) throw new Error(data.error || 'Registration failed');

        pendingEmail = email;
        const targetEmailEl = document.getElementById('otp-target-email');
        if (targetEmailEl) targetEmailEl.textContent = email;

        showAuthMode('otp');
        showToast('Verification code sent to your email!');
    } catch (error) {
        console.error('Register error:', error);
        showAuthError(error.message);
        showToast(error.message, 'error');
    } finally {
        setButtonLoading('reg-submit-btn', false);
        hideLoading();
    }
}

async function handleOtpSubmit(e) {
    e.preventDefault();
    hideAuthError();
    const otp = document.getElementById('otp-input').value.trim();

    setButtonLoading('otp-submit-btn', true, 'Please wait...');
    showLoading('Please wait', 'Verifying 6-digit OTP code...');

    try {
        const response = await fetch(`${API_BASE}/auth/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: pendingEmail, otp })
        });

        const data = await safeParseResponse(response);
        if (!response.ok) throw new Error(data.error || 'Verification failed');

        authToken = data.token;
        currentUser = data.user;

        localStorage.setItem('sd_token', authToken);
        localStorage.setItem('sd_user', JSON.stringify(currentUser));

        updateAuthUI();
        closeAuthModal();
        showToast(data.message || `Welcome, ${currentUser.name}!`);
        await fetchOrders();
    } catch (error) {
        console.error('Verify OTP error:', error);
        showAuthError(error.message);
        showToast(error.message, 'error');
    } finally {
        setButtonLoading('otp-submit-btn', false);
        hideLoading();
    }
}

async function resendOTP() {
    if (!pendingEmail) return;

    setButtonLoading('resend-otp-btn', true, 'Please wait...');
    showLoading('Please wait', 'Resending new verification code...');

    try {
        const response = await fetch(`${API_BASE}/auth/resend-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: pendingEmail })
        });

        const data = await safeParseResponse(response);
        if (!response.ok) throw new Error(data.error || 'Failed to resend OTP');

        showToast('New verification code sent to your email!');
    } catch (error) {
        console.error('Resend OTP error:', error);
        showAuthError(error.message);
        showToast(error.message, 'error');
    } finally {
        setButtonLoading('resend-otp-btn', false);
        hideLoading();
    }
}

function logout() {
    authToken = null;
    currentUser = null;
    orders = [];
    localStorage.removeItem('sd_token');
    localStorage.removeItem('sd_user');
    localStorage.removeItem('sd_orders');

    updateAuthUI();
    showToast('Logged out successfully');
}

function updateAuthUI() {
    const btnText = document.getElementById('auth-btn-text');
    const authBtnHeader = document.getElementById('auth-btn-header');
    const userMenuName = document.getElementById('user-menu-name');
    const navOrdersBtn = document.getElementById('nav-orders-btn');

    if (currentUser) {
        btnText.textContent = currentUser.name || currentUser.email.split('@')[0];
        if (userMenuName) userMenuName.textContent = currentUser.name || currentUser.email;
        if (navOrdersBtn) navOrdersBtn.classList.remove('hidden');
        authBtnHeader.onclick = toggleUserMenu;
    } else {
        btnText.textContent = 'Sign In';
        if (navOrdersBtn) navOrdersBtn.classList.add('hidden');
        authBtnHeader.onclick = () => openAuthModal('login');
    }
}

function toggleUserMenu() {
    if (!currentUser) {
        openAuthModal('login');
        return;
    }
    const dropdown = document.getElementById('user-dropdown');
    if (dropdown) dropdown.classList.toggle('hidden');
}

// --- USER PROFILE & ACCOUNT MANAGEMENT ---
function switchProfileSubTab(subTab = 'hub') {
    const hubView = document.getElementById('profile-view-hub');
    const personalView = document.getElementById('profile-view-personal');
    const securityView = document.getElementById('profile-view-security');

    if (hubView) hubView.classList.add('hidden');
    if (personalView) personalView.classList.add('hidden');
    if (securityView) securityView.classList.add('hidden');

    if (subTab === 'personal') {
        if (personalView) personalView.classList.remove('hidden');
    } else if (subTab === 'security') {
        if (securityView) securityView.classList.remove('hidden');
    } else {
        if (hubView) hubView.classList.remove('hidden');
    }
}

async function loadUserProfile(targetSubTab = null) {
    if (!authToken || !currentUser) {
        showToast('Please sign in to view your profile', 'error');
        openAuthModal('login');
        return;
    }

    if (targetSubTab) {
        switchProfileSubTab(targetSubTab);
    } else {
        switchProfileSubTab('hub');
    }

    const nameDisplay = document.getElementById('profile-display-name');
    const emailDisplay = document.getElementById('profile-display-email');
    const initialsDisplay = document.getElementById('profile-avatar-initials');
    const joinedDisplay = document.getElementById('profile-display-joined');
    const ordersStat = document.getElementById('profile-stat-orders');
    const wishlistStat = document.getElementById('profile-stat-wishlist');

    const nameInput = document.getElementById('profile-input-name');
    const emailInput = document.getElementById('profile-input-email');
    const phoneInput = document.getElementById('profile-input-phone');
    const cityInput = document.getElementById('profile-input-city');
    const addressInput = document.getElementById('profile-input-address');

    // Populate initial cached values
    if (nameDisplay) nameDisplay.textContent = currentUser.name || 'Valued Shopper';
    if (emailDisplay) emailDisplay.textContent = currentUser.email || '';
    if (initialsDisplay) {
        const parts = (currentUser.name || 'SD').trim().split(' ');
        initialsDisplay.textContent = parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : (currentUser.name ? currentUser.name.slice(0, 2).toUpperCase() : 'SD');
    }
    if (wishlistStat) wishlistStat.textContent = wishlist.length;
    if (ordersStat) ordersStat.textContent = orders.length;

    if (nameInput) nameInput.value = currentUser.name || '';
    if (emailInput) emailInput.value = currentUser.email || '';
    if (phoneInput) phoneInput.value = currentUser.phone || '';
    if (cityInput) cityInput.value = currentUser.city || '';
    if (addressInput) addressInput.value = currentUser.address || '';

    // Fetch freshest profile details from server
    try {
        const res = await fetch(`${API_BASE}/auth/profile`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        if (res.ok) {
            const data = await safeParseResponse(res);
            if (data && data.user) {
                const u = data.user;
                currentUser = { ...currentUser, ...u };
                localStorage.setItem('sd_user', JSON.stringify(currentUser));

                if (nameDisplay) nameDisplay.textContent = u.name;
                if (emailDisplay) emailDisplay.textContent = u.email;
                if (joinedDisplay && u.createdAt) {
                    joinedDisplay.textContent = new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                }
                if (ordersStat) ordersStat.textContent = data.orderCount !== undefined ? data.orderCount : orders.length;

                if (nameInput) nameInput.value = u.name || '';
                if (phoneInput) phoneInput.value = u.phone || '';
                if (cityInput) cityInput.value = u.city || '';
                if (addressInput) addressInput.value = u.address || '';
            }
        }
    } catch (e) {
        console.warn('Could not fetch user profile details:', e.message);
    }
}

async function handleUpdateProfile(e) {
    e.preventDefault();
    if (!authToken || !currentUser) return;

    const name = (document.getElementById('profile-input-name')?.value || '').trim();
    const phone = (document.getElementById('profile-input-phone')?.value || '').trim();
    const city = (document.getElementById('profile-input-city')?.value || '').trim();
    const address = (document.getElementById('profile-input-address')?.value || '').trim();

    if (!name) {
        showToast('Please enter your full name', 'error');
        return;
    }

    setButtonLoading('save-profile-btn', true, 'Saving...');
    showLoading('Updating Profile', 'Saving your profile details...');

    try {
        const response = await fetch(`${API_BASE}/auth/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ name, phone, city, address })
        });

        const data = await safeParseResponse(response);
        if (!response.ok) throw new Error(data.error || 'Failed to update profile');

        if (data.token) {
            authToken = data.token;
            localStorage.setItem('sd_token', authToken);
        }
        if (data.user) {
            currentUser = { ...currentUser, ...data.user };
            localStorage.setItem('sd_user', JSON.stringify(currentUser));
        }

        updateAuthUI();
        await loadUserProfile();
        showToast('🎉 Profile updated successfully!');
    } catch (error) {
        console.error('Update profile error:', error);
        showToast(error.message, 'error');
    } finally {
        setButtonLoading('save-profile-btn', false);
        hideLoading();
    }
}

async function handleChangePassword(e) {
    e.preventDefault();
    if (!authToken || !currentUser) return;

    const currentPassword = document.getElementById('change-pwd-current')?.value;
    const newPassword = document.getElementById('change-pwd-new')?.value;
    const confirmPassword = document.getElementById('change-pwd-confirm')?.value;

    if (!currentPassword || !newPassword || !confirmPassword) {
        showToast('Please complete all password fields', 'error');
        return;
    }

    if (newPassword.length < 6) {
        showToast('New password must be at least 6 characters', 'error');
        return;
    }

    if (newPassword !== confirmPassword) {
        showToast('New passwords do not match', 'error');
        return;
    }

    setButtonLoading('change-pwd-btn', true, 'Updating...');
    showLoading('Updating Security', 'Changing your account password...');

    try {
        const response = await fetch(`${API_BASE}/auth/change-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ currentPassword, newPassword })
        });

        const data = await safeParseResponse(response);
        if (!response.ok) throw new Error(data.error || 'Failed to change password');

        if (document.getElementById('change-pwd-current')) document.getElementById('change-pwd-current').value = '';
        if (document.getElementById('change-pwd-new')) document.getElementById('change-pwd-new').value = '';
        if (document.getElementById('change-pwd-confirm')) document.getElementById('change-pwd-confirm').value = '';

        showToast('🎉 Password changed successfully!');
    } catch (error) {
        console.error('Change password error:', error);
        showToast(error.message, 'error');
    } finally {
        setButtonLoading('change-pwd-btn', false);
        hideLoading();
    }
}
