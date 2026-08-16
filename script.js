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

// --- CURRENCY FORMATTER (GHANA CEDIS GH₵) ---
const CURRENCY_SYMBOL = 'GH₵';
const CURRENCY_CODE = 'GHS';

function formatPrice(amount) {
    const num = Number(amount) || 0;
    return `${CURRENCY_SYMBOL} ${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

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
    
    let bgClass = 'bg-gray-900 text-white border border-gray-800';
    let icon = 'fa-circle-check text-emerald-400';

    if (type === 'error') {
        bgClass = 'bg-rose-600 text-white shadow-lg shadow-rose-600/30';
        icon = 'fa-circle-xmark text-white';
    } else if (type === 'warning') {
        bgClass = 'bg-amber-600 text-white shadow-lg shadow-amber-600/30';
        icon = 'fa-triangle-exclamation text-amber-200';
    } else if (type === 'info') {
        bgClass = 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30';
        icon = 'fa-circle-info text-indigo-200';
    }
    
    toast.className = `${bgClass} px-4 py-3 rounded-xl shadow-xl flex items-center space-x-3 text-xs sm:text-sm font-semibold toast-slide max-w-md backdrop-blur-sm z-[99999]`;
    toast.innerHTML = `<i class="fa-solid ${icon} text-base flex-shrink-0"></i><span class="flex-1 leading-snug">${message}</span>`;
    
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        toast.style.transition = 'all 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
    }, 4500);
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

    // Update Floating Dock Active Classes
    const dockTabs = ['catalog', 'wishlist', 'cart', 'orders', 'profile', 'admin'];
    dockTabs.forEach(t => {
        const btn = document.getElementById(`dock-btn-${t}`);
        if (btn) {
            if (t === tabId) {
                btn.classList.add('text-indigo-600', 'font-black');
                btn.classList.remove('text-gray-600');
            } else {
                btn.classList.remove('text-indigo-600', 'font-black');
                btn.classList.add('text-gray-600');
            }
        }
    });

    if (tabId === 'cart') renderCart();
    if (tabId === 'wishlist') renderWishlist();
    if (tabId === 'orders') renderOrders();
    if (tabId === 'profile') loadUserProfile();
    if (tabId === 'admin') loadAdminDashboardData();
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
    { _id: '1', title: 'Italian Saffiano Leather Tote Bag', description: 'Structured designer leather tote bag with gold-tone hardware and spacious multi-compartment interior.', price: 1250.00, image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&auto=format&fit=crop&q=80', category: 'Handbags & Totes', brand: 'Prada', stock: 25 },
    { _id: '2', title: 'Air Max Urban Running Sneakers', description: 'Lightweight responsive athletic sneakers with breathable mesh upper and cushioned air sole.', price: 680.00, image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&auto=format&fit=crop&q=80', category: 'Sneakers & Trainers', brand: 'Nike', stock: 40 },
    { _id: '3', title: 'Classic Pointed Stiletto Pumps', description: 'Elegant 4-inch stiletto heels crafted with premium gloss finish and padded comfort insole.', price: 420.00, image: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800&auto=format&fit=crop&q=80', category: 'Heels & Pumps', brand: 'Zara', stock: 30 },
    { _id: '4', title: 'Waterproof Travel Laptop Backpack', description: 'Durable weather-resistant commuter backpack with 16-inch padded laptop sleeve and USB pass-through.', price: 320.00, image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&auto=format&fit=crop&q=80', category: 'Backpacks & Travel', brand: 'SD Originals', stock: 50 },
    { _id: '5', title: 'Handcrafted Penny Leather Loafers', description: 'Timeless slip-on dress shoes made with genuine burnished calfskin leather and non-slip rubber soles.', price: 590.00, image: 'https://images.unsplash.com/photo-1533867617858-e7b97e060509?w=800&auto=format&fit=crop&q=80', category: 'Loafers & Dress Shoes', brand: 'Clarks', stock: 35 },
    { _id: '6', title: 'Quilted Chain Crossbody Bag', description: 'Chic diamond-quilted shoulder bag featuring an adjustable gold-link chain strap and magnetic snap flap.', price: 780.00, image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&auto=format&fit=crop&q=80', category: 'Crossbody & Clutches', brand: 'Michael Kors', stock: 20 },
    { _id: '7', title: 'Premium Suede Chelsea Ankle Boots', description: 'Classic British ankle boots with elasticated side gussets and Goodyear welted sole construction.', price: 650.00, image: 'https://images.unsplash.com/photo-1608256246200-53e635b5b65f?w=800&auto=format&fit=crop&q=80', category: 'Boots & Ankle Boots', brand: 'Aldo', stock: 28 },
    { _id: '8', title: 'Ultraboost Streetwear Sport Sneakers', description: 'High-energy return sports running shoes with flexible knit upper and Continental rubber outsole.', price: 720.00, image: 'https://images.unsplash.com/photo-1587563871167-1ee9c731aefb?w=800&auto=format&fit=crop&q=80', category: 'Sneakers & Trainers', brand: 'Adidas', stock: 45 },
    { _id: '9', title: 'Monogram Canvas Luxury Handbag', description: 'Iconic patterned top-handle satchel with detachable shoulder strap and padlock detail.', price: 1850.00, image: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=800&auto=format&fit=crop&q=80', category: 'Handbags & Totes', brand: 'Gucci', stock: 15 },
    { _id: '10', title: 'Comfort Leather Slide Sandals', description: 'Casual slip-on slides with contoured footbed, dual buckle straps, and soft leather lining.', price: 210.00, image: 'https://images.unsplash.com/photo-1603808033192-082d6919d3e1?w=800&auto=format&fit=crop&q=80', category: 'Sandals & Slides', brand: 'Zara', stock: 60 }
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
    renderFlashSales();
    initFlashSalesTimer();
    initHeroSlider();
}

// --- JUMIA-STYLE HERO BANNER CAROUSEL ENGINE ---
let currentHeroSlide = 0;
let heroSliderInterval = null;

function setHeroSlide(idx) {
    const slides = document.querySelectorAll('.hero-slide');
    const dots = document.querySelectorAll('.hero-dot');
    if (slides.length === 0) return;

    currentHeroSlide = (idx + slides.length) % slides.length;

    slides.forEach((slide, i) => {
        if (i === currentHeroSlide) {
            slide.classList.remove('opacity-0', 'pointer-events-none');
            slide.classList.add('opacity-100');
        } else {
            slide.classList.remove('opacity-100');
            slide.classList.add('opacity-0', 'pointer-events-none');
        }
    });

    dots.forEach((dot, i) => {
        if (i === currentHeroSlide) {
            dot.className = "hero-dot w-2.5 h-2.5 rounded-full bg-white cursor-pointer transition";
        } else {
            dot.className = "hero-dot w-2.5 h-2.5 rounded-full bg-white/40 cursor-pointer transition";
        }
    });
}

function nextHeroSlide() {
    setHeroSlide(currentHeroSlide + 1);
}

function prevHeroSlide() {
    setHeroSlide(currentHeroSlide - 1);
}

function initHeroSlider() {
    if (heroSliderInterval) clearInterval(heroSliderInterval);
    setHeroSlide(0);
    heroSliderInterval = setInterval(() => {
        nextHeroSlide();
    }, 5000);
}

// --- ⚡ JUMIA-STYLE FLASH SALES ENGINE & COUNTDOWN ---
let flashCountdownSeconds = 4 * 3600 + 28 * 60 + 45; // 4h 28m 45s
let flashTimerInterval = null;

function initFlashSalesTimer() {
    if (flashTimerInterval) clearInterval(flashTimerInterval);

    flashTimerInterval = setInterval(() => {
        if (flashCountdownSeconds > 0) {
            flashCountdownSeconds--;
        } else {
            flashCountdownSeconds = 4 * 3600; // Reset to 4 hours
        }

        const h = Math.floor(flashCountdownSeconds / 3600);
        const m = Math.floor((flashCountdownSeconds % 3600) / 60);
        const s = flashCountdownSeconds % 60;

        const hElem = document.getElementById('flash-timer-h');
        const mElem = document.getElementById('flash-timer-m');
        const sElem = document.getElementById('flash-timer-s');

        if (hElem) hElem.textContent = String(h).padStart(2, '0') + 'h';
        if (mElem) mElem.textContent = String(m).padStart(2, '0') + 'm';
        if (sElem) sElem.textContent = String(s).padStart(2, '0') + 's';
    }, 1000);
}

function renderFlashSales() {
    const grid = document.getElementById('flash-sales-grid');
    if (!grid) return;

    const flashItems = products.slice(0, 6);
    if (flashItems.length === 0) return;

    grid.innerHTML = flashItems.map((p, idx) => {
        const pId = p._id || p.id;
        const pTitle = p.title || p.name;
        const pImg = p.image || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=60';
        const salePrice = Number(p.price || 99);
        const origPrice = (salePrice * 1.35).toFixed(2);
        const discountPct = 25 + (idx * 5) % 30; // 25% - 50%
        const soldQty = 12 + idx * 3;
        const leftQty = 4 + idx * 2;
        const progressPct = Math.min(90, Math.round((soldQty / (soldQty + leftQty)) * 100));

        return `
            <div class="bg-white rounded-xl border border-gray-100 hover:border-indigo-300 hover:shadow-md transition p-3 flex flex-col justify-between group cursor-pointer" onclick="openProductModal('${pId}')">
                <div class="relative bg-gray-50 h-32 sm:h-36 rounded-lg overflow-hidden mb-2">
                    <img src="${pImg}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300">
                    <span class="absolute top-1.5 left-1.5 bg-rose-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow-xs">
                        -${discountPct}%
                    </span>
                    <span class="absolute top-1.5 right-1.5 bg-slate-900/80 text-amber-300 text-[8px] font-extrabold px-1.5 py-0.5 rounded backdrop-blur-xs">
                        ⚡ FLASH
                    </span>
                </div>
                <div>
                    <h4 class="text-xs font-bold text-gray-900 line-clamp-1 group-hover:text-indigo-600 transition">${pTitle}</h4>
                    <div class="mt-1 flex items-baseline space-x-1.5">
                        <span class="text-xs sm:text-sm font-black text-gray-900 font-mono">${formatPrice(salePrice)}</span>
                        <span class="text-[10px] text-gray-400 line-through font-mono">${formatPrice(origPrice)}</span>
                    </div>
                    <!-- Stock Sold Progress Bar -->
                    <div class="mt-2 space-y-0.5">
                        <div class="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                            <div class="bg-gradient-to-r from-rose-500 to-amber-500 h-1.5 rounded-full" style="width: ${progressPct}%"></div>
                        </div>
                        <span class="text-[9px] font-bold text-gray-500 block">${leftQty} items left</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function scrollToFlashSales() {
    switchTab('catalog');
    const el = document.getElementById('flash-sales-section');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function scrollToCatalog() {
    switchTab('catalog');
    const el = document.getElementById('catalog-browse-anchor');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function filterBrand(brandName) {
    switchTab('catalog');
    const brandSelect = document.getElementById('brand-filter');
    if (brandSelect) brandSelect.value = brandName;
    applyFiltersAndRender();
    scrollToCatalog();
}

function openVoucherModal() {
    showToast('🎁 Coupon SAVE10 applied! You get 10% off at checkout.');
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

    grid.innerHTML = listToRender.map((product, idx) => {
        const productId = product._id || product.id;
        const productName = product.title || product.name;
        const isWishlisted = wishlist.some(item => (item._id || item.id) === productId);
        const rating = (Number(product.rating) || 4.8).toFixed(1);
        const ratingCount = product.ratingCount || (product.reviews ? product.reviews.length : 24);
        const brand = product.brand || 'SD Originals';
        const image = product.image || 'https://via.placeholder.com/300x250?text=Product';
        const origPrice = (Number(product.price) * 1.25).toFixed(2);
        const discountTag = 15 + (idx * 5) % 25; // 15% - 35%

        return `
            <div class="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-lg hover:border-indigo-300 transition-all duration-200 flex flex-col justify-between overflow-hidden group">
                <div>
                    <!-- Product Card Image Box with Jumia Badges -->
                    <div class="relative bg-gray-50 h-48 sm:h-52 overflow-hidden cursor-pointer" onclick="openProductModal('${productId}')">
                        <img src="${image}" alt="${productName}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300">
                        
                        <!-- Top Left Discount Badge -->
                        <span class="absolute top-2.5 left-2.5 bg-rose-600 text-white text-[10px] font-black px-2 py-0.5 rounded-md shadow-sm">
                            -${discountTag}%
                        </span>

                        <!-- Top Right Wishlist Toggle -->
                        <button onclick="event.stopPropagation(); toggleWishlist('${productId}')" class="absolute top-2.5 right-2.5 bg-white/90 backdrop-blur-sm p-2 rounded-full shadow-sm hover:bg-white transition text-gray-600">
                            <i class="${isWishlisted ? 'fa-solid text-rose-500' : 'fa-regular text-gray-500'} fa-heart text-xs"></i>
                        </button>

                        <!-- Bottom SD Express Badge -->
                        <div class="absolute bottom-2 left-2 flex items-center space-x-1 bg-emerald-600/90 backdrop-blur-xs text-white text-[9px] font-black px-2 py-0.5 rounded shadow-xs">
                            <i class="fa-solid fa-truck-fast"></i>
                            <span>SD EXPRESS</span>
                        </div>
                    </div>

                    <!-- Card Body -->
                    <div class="p-4 space-y-2">
                        <div class="flex items-center justify-between text-[11px] text-gray-400">
                            <span class="font-extrabold text-indigo-600 uppercase text-[9px] tracking-wider truncate max-w-[120px]">${product.category || 'General'}</span>
                            <span class="font-semibold text-gray-500 truncate max-w-[80px]">${brand}</span>
                        </div>
                        
                        <h3 class="font-extrabold text-xs sm:text-sm text-gray-900 line-clamp-2 cursor-pointer hover:text-indigo-600 transition leading-snug" onclick="openProductModal('${productId}')">
                            ${productName}
                        </h3>

                        <!-- Rating Stars -->
                        <div class="flex items-center space-x-1.5 text-xs">
                            <div class="flex text-amber-400 text-[10px]">
                                <i class="fa-solid fa-star"></i>
                                <i class="fa-solid fa-star"></i>
                                <i class="fa-solid fa-star"></i>
                                <i class="fa-solid fa-star"></i>
                                <i class="fa-solid fa-star-half-stroke"></i>
                            </div>
                            <span class="text-[11px] font-bold text-gray-700">${rating}</span>
                            <span class="text-[10px] text-gray-400">(${ratingCount})</span>
                        </div>

                        <!-- Price Section (Current + Slashed Original) -->
                        <div class="pt-1">
                            <div class="text-sm sm:text-base font-black text-gray-900 font-mono">
                                ${formatPrice(product.price)}
                            </div>
                            <div class="text-[11px] text-gray-400 line-through font-mono">
                                ${formatPrice(origPrice)}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Card Footer: Jumia Action Button -->
                <div class="p-4 pt-0">
                    <button onclick="addToCart('${productId}')" class="w-full bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white py-2 rounded-xl text-xs font-black transition flex items-center justify-center space-x-1.5 shadow-2xs group-hover:bg-indigo-600 group-hover:text-white uppercase tracking-wider">
                        <i class="fa-solid fa-cart-shopping text-xs"></i>
                        <span>ADD TO CART</span>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Advanced Search & Filter Controller
let currentMaxPrice = 4000;

function handlePriceSlider(val) {
    currentMaxPrice = Number(val);
    const display = document.getElementById('price-slider-display');
    if (display) display.textContent = `${CURRENCY_SYMBOL} ${currentMaxPrice}`;
    applyFiltersAndRender();
}

function filterCategory(category) {
    activeCategory = category;
    document.querySelectorAll('.category-btn').forEach(btn => {
        if (btn.textContent.toLowerCase().includes(category.toLowerCase()) || (category === 'All' && btn.textContent.includes('All'))) {
            btn.className = "category-btn px-4 py-2 rounded-full text-xs font-black whitespace-nowrap bg-indigo-600 text-white shadow-sm transition";
        } else {
            btn.className = "category-btn px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap bg-white text-gray-700 border border-gray-200 hover:bg-gray-100 transition";
        }
    });

    applyFiltersAndRender();
}

// --- AI SMART SEARCH AUTO-SUGGESTIONS ENGINE ---
const AI_INTENT_MAP = {
    'bag': ['Handbags & Totes', 'Crossbody & Clutches', 'Backpacks & Travel', 'Prada', 'Gucci', 'Michael Kors'],
    'handbag': ['Handbags & Totes', 'Crossbody & Clutches', 'Prada', 'Gucci', 'Michael Kors'],
    'tote': ['Handbags & Totes', 'Prada', 'Gucci'],
    'purse': ['Handbags & Totes', 'Crossbody & Clutches'],
    'clutch': ['Crossbody & Clutches'],
    'backpack': ['Backpacks & Travel', 'SD Originals'],
    'travel': ['Backpacks & Travel'],
    'shoe': ['Sneakers & Trainers', 'Heels & Pumps', 'Loafers & Dress Shoes', 'Boots & Ankle Boots', 'Sandals & Slides', 'Nike', 'Adidas', 'Clarks', 'Zara', 'Aldo'],
    'sneaker': ['Sneakers & Trainers', 'Nike', 'Adidas'],
    'trainer': ['Sneakers & Trainers', 'Nike', 'Adidas'],
    'running': ['Sneakers & Trainers', 'Nike', 'Adidas'],
    'heel': ['Heels & Pumps', 'Zara', 'Aldo'],
    'pump': ['Heels & Pumps', 'Zara'],
    'stiletto': ['Heels & Pumps', 'Zara'],
    'loafer': ['Loafers & Dress Shoes', 'Clarks'],
    'dress': ['Loafers & Dress Shoes', 'Heels & Pumps'],
    'boot': ['Boots & Ankle Boots', 'Aldo'],
    'ankle': ['Boots & Ankle Boots', 'Aldo'],
    'sandal': ['Sandals & Slides', 'Zara'],
    'slide': ['Sandals & Slides', 'Zara'],
    'leather': ['Handbags & Totes', 'Loafers & Dress Shoes', 'Boots & Ankle Boots', 'Prada', 'Clarks']
};

function handleSearchWithAI(val) {
    const desktopInput = document.getElementById('search-input');
    const mobileInput = document.getElementById('mobile-search-input');
    if (desktopInput && desktopInput.value !== val) desktopInput.value = val;
    if (mobileInput && mobileInput.value !== val) mobileInput.value = val;

    const dBtn = document.getElementById('search-clear-btn');
    const mBtn = document.getElementById('mobile-search-clear-btn');
    if (dBtn) {
        if (val) dBtn.classList.remove('hidden');
        else dBtn.classList.add('hidden');
    }
    if (mBtn) {
        if (val) mBtn.classList.remove('hidden');
        else mBtn.classList.add('hidden');
    }

    applyFiltersAndRender();
    showAISuggestions(val);
}

function clearSearch() {
    const dInput = document.getElementById('search-input');
    const mInput = document.getElementById('mobile-search-input');
    if (dInput) dInput.value = '';
    if (mInput) mInput.value = '';

    const dBtn = document.getElementById('search-clear-btn');
    const mBtn = document.getElementById('mobile-search-clear-btn');
    if (dBtn) dBtn.classList.add('hidden');
    if (mBtn) mBtn.classList.add('hidden');

    closeAISuggestions();
    applyFiltersAndRender();
}

function handleSearch() {
    const desktopVal = document.getElementById('search-input')?.value || '';
    const mobileVal = document.getElementById('mobile-search-input')?.value || '';
    handleSearchWithAI(desktopVal || mobileVal);
}

function showAISuggestions(query = '', isMobile = false) {
    const dropdown = document.getElementById(isMobile ? 'mobile-ai-suggestions-dropdown' : 'ai-suggestions-dropdown');
    const otherDropdown = document.getElementById(isMobile ? 'ai-suggestions-dropdown' : 'mobile-ai-suggestions-dropdown');
    if (otherDropdown) otherDropdown.classList.add('hidden');
    if (!dropdown) return;

    const trimmed = (query || '').trim().toLowerCase();

    // CASE 1: Empty Query - Show Trending Searches & Popular Categories
    if (!trimmed) {
        dropdown.innerHTML = `
            <div class="p-2 space-y-4">
                <div>
                    <div class="flex items-center justify-between text-xs font-bold text-gray-500 mb-2">
                        <span class="flex items-center space-x-1.5 text-indigo-600">
                            <i class="fa-solid fa-wand-magic-sparkles text-xs"></i>
                            <span>AI Trending Searches</span>
                        </span>
                        <span class="text-[10px] text-gray-400">Live Suggestions</span>
                    </div>
                    <div class="flex flex-wrap gap-1.5">
                        <button onclick="selectAISuggestion('Leather Tote Bag')" class="bg-gray-100 hover:bg-indigo-50 hover:text-indigo-600 text-gray-700 text-xs font-semibold px-3 py-1.5 rounded-full transition flex items-center space-x-1">
                            <i class="fa-solid fa-arrow-trend-up text-[10px] text-indigo-500"></i>
                            <span>Leather Tote Bag</span>
                        </button>
                        <button onclick="selectAISuggestion('Air Max Sneakers')" class="bg-gray-100 hover:bg-indigo-50 hover:text-indigo-600 text-gray-700 text-xs font-semibold px-3 py-1.5 rounded-full transition flex items-center space-x-1">
                            <i class="fa-solid fa-arrow-trend-up text-[10px] text-indigo-500"></i>
                            <span>Nike Air Max</span>
                        </button>
                        <button onclick="selectAISuggestion('Stiletto Pumps')" class="bg-gray-100 hover:bg-indigo-50 hover:text-indigo-600 text-gray-700 text-xs font-semibold px-3 py-1.5 rounded-full transition flex items-center space-x-1">
                            <i class="fa-solid fa-arrow-trend-up text-[10px] text-indigo-500"></i>
                            <span>Stiletto High Heels</span>
                        </button>
                        <button onclick="selectAISuggestion('Penny Loafers')" class="bg-gray-100 hover:bg-indigo-50 hover:text-indigo-600 text-gray-700 text-xs font-semibold px-3 py-1.5 rounded-full transition flex items-center space-x-1">
                            <i class="fa-solid fa-arrow-trend-up text-[10px] text-indigo-500"></i>
                            <span>Penny Loafers</span>
                        </button>
                    </div>
                </div>

                <div class="pt-2 border-t border-gray-100">
                    <div class="text-xs font-bold text-gray-500 mb-2 flex items-center space-x-1.5">
                        <i class="fa-solid fa-layer-group text-xs text-gray-400"></i>
                        <span>Explore Popular Categories</span>
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                        <button onclick="filterCategory('Handbags & Totes'); closeAISuggestions();" class="text-left p-2 rounded-xl bg-gray-50 hover:bg-indigo-50 transition flex items-center space-x-2">
                            <i class="fa-solid fa-bag-shopping text-indigo-600 text-sm"></i>
                            <span class="text-xs font-bold text-gray-800">Handbags & Totes</span>
                        </button>
                        <button onclick="filterCategory('Sneakers & Trainers'); closeAISuggestions();" class="text-left p-2 rounded-xl bg-gray-50 hover:bg-indigo-50 transition flex items-center space-x-2">
                            <i class="fa-solid fa-shoe-prints text-indigo-600 text-sm"></i>
                            <span class="text-xs font-bold text-gray-800">Sneakers & Trainers</span>
                        </button>
                        <button onclick="filterCategory('Heels & Pumps'); closeAISuggestions();" class="text-left p-2 rounded-xl bg-gray-50 hover:bg-indigo-50 transition flex items-center space-x-2">
                            <i class="fa-solid fa-socks text-indigo-600 text-sm"></i>
                            <span class="text-xs font-bold text-gray-800">Heels & Stilettos</span>
                        </button>
                        <button onclick="filterCategory('Loafers & Dress Shoes'); closeAISuggestions();" class="text-left p-2 rounded-xl bg-gray-50 hover:bg-indigo-50 transition flex items-center space-x-2">
                            <i class="fa-solid fa-boot text-indigo-600 text-sm"></i>
                            <span class="text-xs font-bold text-gray-800">Loafers & Shoes</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
        dropdown.classList.remove('hidden');
        return;
    }

    // CASE 2: Active Query - Match Intent, Synonyms, Categories, and Products
    let intentKeywords = [];
    Object.keys(AI_INTENT_MAP).forEach(key => {
        if (trimmed.includes(key) || key.includes(trimmed)) {
            intentKeywords.push(...AI_INTENT_MAP[key]);
        }
    });

    const matchingProducts = products.filter(p => {
        const title = (p.title || p.name || '').toLowerCase();
        const cat = (p.category || '').toLowerCase();
        const brand = (p.brand || '').toLowerCase();
        const desc = (p.description || '').toLowerCase();

        const directMatch = title.includes(trimmed) || cat.includes(trimmed) || brand.includes(trimmed) || desc.includes(trimmed);
        const intentMatch = intentKeywords.some(kw => title.includes(kw.toLowerCase()) || cat.includes(kw.toLowerCase()) || brand.includes(kw.toLowerCase()));
        return directMatch || intentMatch;
    }).slice(0, 4);

    // Matching categories & brands
    const matchingCategories = [...new Set(matchingProducts.map(p => p.category).filter(Boolean))];

    if (matchingProducts.length === 0) {
        dropdown.innerHTML = `
            <div class="p-4 text-center space-y-2">
                <div class="w-10 h-10 rounded-full bg-amber-50 text-amber-500 mx-auto flex items-center justify-center text-lg">
                    <i class="fa-solid fa-brain"></i>
                </div>
                <h4 class="text-xs font-bold text-gray-800">No exact items found for "${query}"</h4>
                <p class="text-[11px] text-gray-500">AI suggests exploring our best sellers in Handbags, Sneakers, or Heels.</p>
                <div class="pt-2 flex justify-center gap-2">
                    <button onclick="filterCategory('All'); closeAISuggestions();" class="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition">
                        View All Bags & Shoes
                    </button>
                </div>
            </div>
        `;
        dropdown.classList.remove('hidden');
        return;
    }

    let html = `
        <div class="p-2 space-y-3 text-xs">
            <!-- AI Query Auto-Completions -->
            <div>
                <div class="text-[11px] font-bold text-indigo-600 mb-1.5 flex items-center space-x-1">
                    <i class="fa-solid fa-wand-magic-sparkles text-[10px]"></i>
                    <span>AI Suggested Searches</span>
                </div>
                <div class="space-y-1">
                    <button onclick="selectAISuggestion('${query}')" class="w-full text-left p-1.5 rounded-lg hover:bg-gray-100 flex items-center justify-between text-gray-800 font-semibold group transition">
                        <span class="flex items-center space-x-2 truncate">
                            <i class="fa-solid fa-magnifying-glass text-gray-400 text-xs group-hover:text-indigo-600"></i>
                            <span>${query}</span>
                        </span>
                        <span class="text-[10px] text-gray-400">Search</span>
                    </button>
                    ${matchingCategories.slice(0, 2).map(cat => `
                        <button onclick="filterCategory('${cat}'); closeAISuggestions();" class="w-full text-left p-1.5 rounded-lg hover:bg-indigo-50 flex items-center justify-between text-gray-700 font-medium group transition">
                            <span class="flex items-center space-x-2 truncate">
                                <i class="fa-solid fa-tag text-indigo-500 text-xs"></i>
                                <span><b>${query}</b> in <span class="text-indigo-600 font-bold">${cat}</span></span>
                            </span>
                            <span class="text-[10px] text-indigo-500 font-bold">Filter</span>
                        </button>
                    `).join('')}
                </div>
            </div>

            <!-- Instant Matching Products Preview -->
            <div class="pt-2 border-t border-gray-100">
                <div class="text-[11px] font-bold text-gray-500 mb-2 flex items-center justify-between">
                    <span>Matching Products (${matchingProducts.length})</span>
                    <span class="text-[10px] text-indigo-600">Instant Preview</span>
                </div>
                <div class="space-y-2">
                    ${matchingProducts.map(p => {
                        const pId = p._id || p.id;
                        const pName = p.title || p.name;
                        const pImg = p.image || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=60';
                        const pPrice = Number(p.price).toFixed(2);
                        const pBrand = p.brand ? `<span class="bg-gray-100 text-gray-700 text-[9px] font-extrabold px-1.5 py-0.5 rounded">${p.brand}</span>` : '';
                        
                        return `
                            <div onclick="openProductModal('${pId}'); closeAISuggestions();" class="flex items-center space-x-3 p-2 rounded-xl hover:bg-gray-50 cursor-pointer border border-transparent hover:border-gray-200 transition group">
                                <img src="${pImg}" class="w-11 h-11 object-cover rounded-lg border border-gray-100 flex-shrink-0">
                                <div class="flex-1 min-w-0">
                                    <div class="flex items-center space-x-1.5">
                                        <h5 class="text-xs font-bold text-gray-900 group-hover:text-indigo-600 truncate">${pName}</h5>
                                        ${pBrand}
                                    </div>
                                    <div class="flex items-center space-x-2 mt-0.5">
                                        <span class="text-xs font-extrabold text-indigo-600">${formatPrice(p.price)}</span>
                                        <span class="text-[10px] text-amber-500 font-bold"><i class="fa-solid fa-star text-[9px]"></i> ${p.rating || 4.5}</span>
                                        <span class="text-[10px] text-gray-400 truncate">• ${p.category || 'General'}</span>
                                    </div>
                                </div>
                                <button onclick="event.stopPropagation(); addToCart('${pId}'); closeAISuggestions();" class="bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-600 w-7 h-7 rounded-lg flex items-center justify-center transition flex-shrink-0 text-xs shadow-xs" title="Add to Cart">
                                    <i class="fa-solid fa-cart-plus"></i>
                                </button>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        </div>
    `;

    dropdown.innerHTML = html;
    dropdown.classList.remove('hidden');
}

function selectAISuggestion(queryText) {
    const desktopInput = document.getElementById('search-input');
    const mobileInput = document.getElementById('mobile-search-input');
    if (desktopInput) desktopInput.value = queryText;
    if (mobileInput) mobileInput.value = queryText;

    switchTab('catalog');
    applyFiltersAndRender();
    closeAISuggestions();
}

function closeAISuggestions() {
    const d1 = document.getElementById('ai-suggestions-dropdown');
    const d2 = document.getElementById('mobile-ai-suggestions-dropdown');
    if (d1) d1.classList.add('hidden');
    if (d2) d2.classList.add('hidden');
}

// Global click & Escape listener for AI Suggestions
if (typeof document !== 'undefined') {
    document.addEventListener('click', (e) => {
        const isInsideDesktop = e.target.closest('#search-input') || e.target.closest('#ai-suggestions-dropdown');
        const isInsideMobile = e.target.closest('#mobile-search-input') || e.target.closest('#mobile-ai-suggestions-dropdown');
        if (!isInsideDesktop && !isInsideMobile) {
            closeAISuggestions();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeAISuggestions();
        }
    });
}

function resetFilters() {
    activeCategory = 'All';
    currentMaxPrice = 2000;
    const priceSlider = document.getElementById('price-slider');
    if (priceSlider) priceSlider.value = '2000';
    const priceDisplay = document.getElementById('price-slider-display');
    if (priceDisplay) priceDisplay.textContent = 'GH₵ 2000';

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
// --- PRODUCT IMAGE GALLERY, CAROUSEL & INTERACTIVE ZOOM LENS ENGINE ---
let currentGalleryImages = [];
let currentGalleryIdx = 0;

function getProductImages(product) {
    if (Array.isArray(product.images) && product.images.length > 0) {
        return product.images;
    }
    const cat = (product.category || '').toLowerCase();
    const title = (product.title || product.name || '').toLowerCase();
    const mainImg = product.image || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80';

    if (cat.includes('audio') || title.includes('headphone') || title.includes('sound')) {
        return [
            mainImg,
            'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=800&auto=format&fit=crop&q=80',
            'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=800&auto=format&fit=crop&q=80',
            'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=800&auto=format&fit=crop&q=80'
        ];
    } else if (cat.includes('phone') || title.includes('phone') || title.includes('smartphone')) {
        return [
            mainImg,
            'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=800&auto=format&fit=crop&q=80',
            'https://images.unsplash.com/photo-1580910051074-3eb694886505?w=800&auto=format&fit=crop&q=80',
            'https://images.unsplash.com/photo-1565849904461-04a58ad377e0?w=800&auto=format&fit=crop&q=80'
        ];
    } else if (cat.includes('laptop') || title.includes('laptop') || title.includes('macbook')) {
        return [
            mainImg,
            'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&auto=format&fit=crop&q=80',
            'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=800&auto=format&fit=crop&q=80',
            'https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=800&auto=format&fit=crop&q=80'
        ];
    } else if (cat.includes('wearable') || title.includes('watch')) {
        return [
            mainImg,
            'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=800&auto=format&fit=crop&q=80',
            'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=800&auto=format&fit=crop&q=80',
            'https://images.unsplash.com/photo-1434493789847-2f02dc6ca35d?w=800&auto=format&fit=crop&q=80'
        ];
    } else if (title.includes('speaker') || title.includes('boombox')) {
        return [
            mainImg,
            'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=800&auto=format&fit=crop&q=80',
            'https://images.unsplash.com/photo-1589003077984-894e133dabab?w=800&auto=format&fit=crop&q=80',
            'https://images.unsplash.com/photo-1543512214-318c7553f230?w=800&auto=format&fit=crop&q=80'
        ];
    } else if (title.includes('cable') || title.includes('charger')) {
        return [
            mainImg,
            'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=800&auto=format&fit=crop&q=80',
            'https://images.unsplash.com/photo-1563770660941-20978e870e26?w=800&auto=format&fit=crop&q=80',
            'https://images.unsplash.com/photo-1585338107529-13afc5f02586?w=800&auto=format&fit=crop&q=80'
        ];
    } else if (title.includes('screen') || title.includes('glass')) {
        return [
            mainImg,
            'https://images.unsplash.com/photo-1585060544812-6b45742d762f?w=800&auto=format&fit=crop&q=80',
            'https://images.unsplash.com/photo-1565849904461-04a58ad377e0?w=800&auto=format&fit=crop&q=80'
        ];
    } else if (title.includes('case') || title.includes('cover')) {
        return [
            mainImg,
            'https://images.unsplash.com/photo-1586105251261-72a756497a11?w=800&auto=format&fit=crop&q=80',
            'https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=800&auto=format&fit=crop&q=80'
        ];
    }

    return [mainImg];
}

function switchProductGalleryImage(idx) {
    if (!currentGalleryImages || currentGalleryImages.length === 0) return;
    currentGalleryIdx = (idx + currentGalleryImages.length) % currentGalleryImages.length;
    const activeUrl = currentGalleryImages[currentGalleryIdx];

    const mainImg = document.getElementById('main-product-img');
    if (mainImg) {
        mainImg.style.opacity = '0.5';
        setTimeout(() => {
            mainImg.src = activeUrl;
            mainImg.style.opacity = '1';
        }, 60);
    }

    const fullImg = document.getElementById('fullscreen-img-element');
    if (fullImg) {
        fullImg.src = activeUrl;
    }

    const badge = document.getElementById('gallery-photo-badge');
    if (badge) {
        badge.textContent = `${currentGalleryIdx + 1} / ${currentGalleryImages.length}`;
    }

    const fullBadge = document.getElementById('fullscreen-img-color-label');
    if (fullBadge) {
        fullBadge.textContent = `Photo ${currentGalleryIdx + 1} of ${currentGalleryImages.length}`;
    }

    // Update thumbnail highlights
    document.querySelectorAll('.gallery-thumb-btn').forEach((btn, i) => {
        if (i === currentGalleryIdx) {
            btn.className = "gallery-thumb-btn w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-xl border-2 border-indigo-600 shadow-md ring-2 ring-indigo-300 cursor-pointer transition transform scale-105";
        } else {
            btn.className = "gallery-thumb-btn w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-xl border border-gray-200 opacity-60 cursor-pointer hover:opacity-100 hover:border-gray-400 transition";
        }
    });
}

function prevProductGalleryImage() {
    switchProductGalleryImage(currentGalleryIdx - 1);
}

function nextProductGalleryImage() {
    switchProductGalleryImage(currentGalleryIdx + 1);
}

// Interactive Desktop Hover Zoom Lens
function handleImageZoom(e) {
    const container = e.currentTarget;
    const img = document.getElementById('main-product-img');
    const zoomPill = document.getElementById('zoom-active-pill');
    if (!img) return;

    const rect = container.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    img.style.transformOrigin = `${x}% ${y}%`;
    img.style.transform = 'scale(2.2)';

    if (zoomPill) zoomPill.classList.remove('hidden');
}

function resetImageZoom() {
    const img = document.getElementById('main-product-img');
    const zoomPill = document.getElementById('zoom-active-pill');
    if (!img) return;

    img.style.transformOrigin = 'center center';
    img.style.transform = 'scale(1)';

    if (zoomPill) zoomPill.classList.add('hidden');
}

function openFullscreenImg() {
    if (!currentGalleryImages || currentGalleryImages.length === 0) return;
    const activeUrl = currentGalleryImages[currentGalleryIdx];

    const fullImg = document.getElementById('fullscreen-img-element');
    if (fullImg) fullImg.src = activeUrl;

    const fullLabel = document.getElementById('fullscreen-img-color-label');
    if (fullLabel) fullLabel.textContent = `Photo ${currentGalleryIdx + 1} of ${currentGalleryImages.length}`;

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
    currentGalleryImages = getProductImages(product);
    currentGalleryIdx = 0;

    const mainImage = currentGalleryImages[0];
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
            <span class="text-xs text-gray-400 font-semibold hidden sm:inline">Product Gallery & Verified Details</span>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-2">
            <!-- LEFT COLUMN: Interactive Gallery & Zoom (5 cols) -->
            <div class="lg:col-span-5 space-y-4">
                <!-- Main Image Card with Zoom Lens, Badges, Full View & Navigation Arrows -->
                <div class="relative bg-gray-50 rounded-2xl overflow-hidden border border-gray-200 group select-none">
                    <!-- Zoomable Image Viewport -->
                    <div id="main-img-zoom-box" onmousemove="handleImageZoom(event)" onmouseleave="resetImageZoom()" onclick="openFullscreenImg()" class="w-full h-80 overflow-hidden cursor-crosshair relative flex items-center justify-center bg-gray-50">
                        <img id="main-product-img" src="${mainImage}" class="w-full h-full object-cover transition-transform duration-150 ease-out">
                    </div>

                    <!-- SD Express & Discount Badges -->
                    <div class="absolute top-3 left-3 flex flex-col space-y-1 z-10 pointer-events-none">
                        <span class="bg-amber-500 text-white font-extrabold text-[10px] px-2.5 py-1 rounded-md uppercase tracking-wider shadow">SD Express</span>
                        <span class="bg-rose-600 text-white font-extrabold text-[10px] px-2 py-0.5 rounded-md uppercase tracking-wider shadow">-20% OFF</span>
                    </div>

                    <!-- Floating Zoom Active Indicator Pill -->
                    <div id="zoom-active-pill" class="hidden absolute top-3 left-1/2 -translate-x-1/2 bg-gray-900/80 text-white text-[10px] font-bold px-3 py-1 rounded-full backdrop-blur-md shadow pointer-events-none z-10 flex items-center space-x-1">
                        <i class="fa-solid fa-magnifying-glass-plus text-indigo-400"></i>
                        <span>2.2x Zoom Active</span>
                    </div>

                    <!-- Full View & Counter Badges -->
                    <div class="absolute top-3 right-3 flex items-center space-x-2 z-10">
                        <span id="gallery-photo-badge" class="bg-black/50 text-white text-[10px] font-bold px-2 py-1 rounded-lg backdrop-blur-md shadow-xs pointer-events-none">1 / ${currentGalleryImages.length}</span>
                        <button onclick="event.stopPropagation(); openFullscreenImg()" class="bg-black/60 hover:bg-black/80 text-white text-xs font-bold px-2.5 py-1 rounded-xl backdrop-blur-md shadow-md transition flex items-center space-x-1" title="Open Fullscreen Lightbox">
                            <i class="fa-solid fa-expand text-[10px]"></i>
                            <span>Full View</span>
                        </button>
                    </div>

                    <!-- Navigation Arrows Overlay -->
                    ${currentGalleryImages.length > 1 ? `
                        <button onclick="event.stopPropagation(); prevProductGalleryImage()" class="absolute left-3 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-gray-800 w-9 h-9 rounded-full shadow-md backdrop-blur-sm flex items-center justify-center transition hover:scale-110 z-10">
                            <i class="fa-solid fa-chevron-left text-xs"></i>
                        </button>
                        <button onclick="event.stopPropagation(); nextProductGalleryImage()" class="absolute right-3 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-gray-800 w-9 h-9 rounded-full shadow-md backdrop-blur-sm flex items-center justify-center transition hover:scale-110 z-10">
                            <i class="fa-solid fa-chevron-right text-xs"></i>
                        </button>
                    ` : ''}
                </div>

                <!-- Interactive Thumbnails Strip -->
                <div class="space-y-1.5">
                    <div class="flex items-center justify-between text-xs text-gray-500">
                        <span class="font-bold text-gray-700">Product Angles & Views:</span>
                        <span class="text-[11px] text-gray-400">Hover photo to zoom</span>
                    </div>
                    <div class="flex items-center space-x-3 overflow-x-auto py-1 scrollbar-none">
                        ${currentGalleryImages.map((imgUrl, idx) => `
                            <div onclick="switchProductGalleryImage(${idx})" onmouseenter="switchProductGalleryImage(${idx})" title="Angle ${idx + 1}" class="group relative flex-shrink-0">
                                <img src="${imgUrl}" class="gallery-thumb-btn w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-xl ${idx === 0 ? 'border-2 border-indigo-600 shadow-md ring-2 ring-indigo-300 scale-105' : 'border border-gray-200 opacity-60 hover:opacity-100 hover:border-gray-400'} cursor-pointer transition">
                                <span class="absolute bottom-1 right-1 bg-black/60 text-white text-[8px] font-bold px-1 rounded backdrop-blur-xs">#${idx + 1}</span>
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
                            <span class="text-gray-500 text-[11px]">Dispatch within 24-48 hours. Free shipping over GH₵ 500.</span>
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
                                <span class="text-3xl font-black text-gray-900">${formatPrice(product.price)}</span>
                                <span class="text-sm text-gray-400 line-through font-semibold">${formatPrice(product.price * 1.25)}</span>
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
        grid.innerHTML = `
            <div class="col-span-full bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm space-y-4">
                <div class="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto text-2xl shadow-inner">
                    <i class="fa-solid fa-heart"></i>
                </div>
                <div>
                    <h3 class="text-lg font-extrabold text-gray-900">Your Wishlist is Empty</h3>
                    <p class="text-xs text-gray-500 mt-1 max-w-sm mx-auto">Explore our catalog and click the heart icon on your favorite items to save them here for later.</p>
                </div>
                <button onclick="switchTab('catalog')" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2.5 rounded-xl shadow transition text-xs inline-flex items-center space-x-2">
                    <i class="fa-solid fa-bag-shopping"></i>
                    <span>Discover Trending Products</span>
                </button>
            </div>
        `;
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
                    <span class="text-sm font-bold text-indigo-600 mt-1 block">${formatPrice(product.price)}</span>
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

    const pId = product._id || product.id;
    const maxStock = product.stock !== undefined ? product.stock : 50;
    const existing = cart.find(item => (item._id || item.id) === pId);

    if (existing) {
        if (existing.qty >= maxStock) {
            showToast(`⚠️ Maximum stock limit reached (${maxStock} available)`, 'error');
            return;
        }
        existing.qty += 1;
    } else {
        if (maxStock <= 0) {
            showToast('⚠️ Item is currently out of stock', 'error');
            return;
        }
        cart.push({ ...product, qty: 1 });
    }

    // Trigger visual top bar progress
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

    localStorage.setItem('sd_cart', JSON.stringify(cart));
    updateBadges();
    showToast(`Added ${product.title || product.name} to cart!`);
}

function updateCartQty(productId, delta) {
    const item = cart.find(i => (i._id || i.id) === productId);
    if (item) {
        const fullProduct = products.find(p => (p._id || p.id) === productId) || item;
        const maxStock = fullProduct.stock !== undefined ? fullProduct.stock : 50;

        if (delta > 0 && item.qty >= maxStock) {
            showToast(`⚠️ Maximum stock limit reached (${maxStock} available)`, 'error');
            return;
        }

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
        document.getElementById('cart-subtotal').textContent = `${CURRENCY_SYMBOL} 0.00`;
        document.getElementById('cart-discount').textContent = `-${CURRENCY_SYMBOL} 0.00`;
        document.getElementById('cart-shipping').textContent = `${CURRENCY_SYMBOL} 0.00`;
        document.getElementById('cart-total').textContent = `${CURRENCY_SYMBOL} 0.00`;
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
                            <span class="text-lg font-black text-gray-900">${formatPrice(item.price)}</span>
                            <span class="text-xs text-gray-400 line-through">${formatPrice(item.price * 1.25)}</span>
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
    const shipping = subtotal > 500 || subtotal === 0 ? 0 : 50.00;
    const total = subtotal - discountAmt + shipping;

    document.getElementById('cart-subtotal').textContent = formatPrice(subtotal);
    document.getElementById('cart-discount').textContent = `-${formatPrice(discountAmt)}`;
    document.getElementById('cart-shipping').textContent = shipping === 0 ? 'FREE' : formatPrice(shipping);
    document.getElementById('cart-total').textContent = formatPrice(total);

    const checkoutText = document.getElementById('cart-checkout-btn-text');
    if (checkoutText) {
        checkoutText.textContent = `CHECKOUT (${formatPrice(total)})`;
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
    const mobileCartBadge = document.getElementById('mobile-cart-badge');
    const dockCartBadge = document.getElementById('dock-cart-badge');
    [cartBadge, mobileCartBadge, dockCartBadge].forEach(b => {
        if (b) {
            if (cartCount > 0) {
                b.textContent = cartCount;
                b.classList.remove('hidden');
            } else {
                b.classList.add('hidden');
            }
        }
    });

    const wishBadge = document.getElementById('wishlist-badge');
    const mobileWishBadge = document.getElementById('mobile-wishlist-badge');
    const dockWishBadge = document.getElementById('dock-wishlist-badge');
    [wishBadge, mobileWishBadge, dockWishBadge].forEach(b => {
        if (b) {
            if (wishlist.length > 0) {
                b.textContent = wishlist.length;
                b.classList.remove('hidden');
            } else {
                b.classList.add('hidden');
            }
        }
    });
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
        const shipping = subtotal > 500 ? 0 : 50.00;
        pendingOrderTotal = subtotal - discountAmt + shipping;

        document.getElementById('pay-modal-total').textContent = formatPrice(pendingOrderTotal);
        document.getElementById('cod-amount').textContent = formatPrice(pendingOrderTotal);
        document.getElementById('pay-btn-text').textContent = `Confirm & Pay ${formatPrice(pendingOrderTotal)}`;

        const payAddressInput = document.getElementById('pay-address');
        const momoPhoneInput = document.getElementById('momo-phone');

        if (payAddressInput) {
            if (shippingAddress) {
                payAddressInput.value = shippingAddress;
            } else if (currentUser && (currentUser.address || currentUser.city)) {
                payAddressInput.value = [currentUser.address, currentUser.city].filter(Boolean).join(', ');
            }
        }

        if (momoPhoneInput && currentUser && currentUser.phone && !momoPhoneInput.value) {
            momoPhoneInput.value = currentUser.phone;
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
            submitText.textContent = `Place Order (${formatPrice(pendingOrderTotal)})`;
        } else {
            submitText.textContent = `Confirm & Pay ${formatPrice(pendingOrderTotal)}`;
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
                        <span class="font-black text-indigo-600 text-lg">${formatPrice(total)}</span>
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
                    <div class="flex flex-wrap items-center gap-2">
                        <button onclick="openTrackingModal('${id}')" class="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-sm transition inline-flex items-center space-x-1.5">
                            <i class="fa-solid fa-location-crosshairs"></i>
                            <span>Tracking</span>
                        </button>

                        <button onclick="openInvoiceModal('${id}')" class="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold px-3.5 py-2 rounded-xl transition inline-flex items-center space-x-1.5" title="View & Print Official Receipt">
                            <i class="fa-solid fa-file-invoice text-indigo-600"></i>
                            <span>Invoice</span>
                        </button>

                        ${(status === 'pending' || status === 'processing') ? `
                            <button onclick="cancelOrder('${id}')" class="bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-600 border border-rose-200 text-xs font-bold px-3 py-2 rounded-xl transition inline-flex items-center space-x-1.5" title="Cancel this order">
                                <i class="fa-solid fa-ban"></i>
                                <span>Cancel</span>
                            </button>
                        ` : ''}

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

async function cancelOrder(orderId) {
    if (!confirm('Are you sure you want to cancel this order? This action cannot be undone.')) return;

    showLoading('Cancelling Order', 'Processing order cancellation...');
    try {
        const response = await fetch(`${API_BASE}/orders/${orderId}/cancel`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        const data = await safeParseResponse(response);
        if (!response.ok) throw new Error(data.error || 'Failed to cancel order');

        showToast('🎉 Order cancelled successfully');
        await fetchOrders();
    } catch (e) {
        console.error('Cancel order error:', e);
        showToast(e.message, 'error');
    } finally {
        hideLoading();
    }
}

// Aliases to prevent any undefined function reference
const loadOrders = fetchOrders;
const loadOrder = fetchOrders;

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
                                        <td class="p-3 text-right text-gray-600 font-mono">${formatPrice(unitPrice)}</td>
                                        <td class="p-3 text-right font-bold text-gray-900 font-mono">${formatPrice(itemSubtotal)}</td>
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
                <span class="text-2xl font-black text-indigo-600 font-mono">${formatPrice(total)}</span>
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
function showAuthError(message, type = 'error') {
    const errorBox = document.getElementById('auth-modal-error');
    const errorText = document.getElementById('auth-modal-error-text');
    if (errorBox && errorText) {
        errorText.innerHTML = message;
        if (type === 'warning') {
            errorBox.className = "mb-4 p-3.5 bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold rounded-xl flex items-start space-x-2.5 shadow-xs";
            const icon = errorBox.querySelector('i');
            if (icon) icon.className = "fa-solid fa-triangle-exclamation text-amber-600 text-base flex-shrink-0 mt-0.5";
        } else {
            errorBox.className = "mb-4 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl flex items-start space-x-2.5 shadow-xs";
            const icon = errorBox.querySelector('i');
            if (icon) icon.className = "fa-solid fa-circle-exclamation text-rose-500 text-base flex-shrink-0 mt-0.5";
        }
        errorBox.classList.remove('hidden');
    }
}

function hideAuthError() {
    const errorBox = document.getElementById('auth-modal-error');
    if (errorBox) {
        errorBox.classList.add('hidden');
    }
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    if (emailInput) emailInput.classList.remove('border-rose-500', 'border-amber-500', 'ring-2', 'ring-rose-200', 'ring-amber-200');
    if (passwordInput) passwordInput.classList.remove('border-rose-500', 'border-amber-500', 'ring-2', 'ring-rose-200', 'ring-amber-200');
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
    
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    const email = emailInput ? emailInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value : '';

    // Reset input highlights
    if (emailInput) emailInput.classList.remove('border-rose-500', 'border-amber-500', 'ring-2', 'ring-rose-200', 'ring-amber-200');
    if (passwordInput) passwordInput.classList.remove('border-rose-500', 'border-amber-500', 'ring-2', 'ring-rose-200', 'ring-amber-200');

    // Client-side validations
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
        if (emailInput) {
            emailInput.classList.add('border-rose-500', 'ring-2', 'ring-rose-200');
            emailInput.focus();
        }
        showToast('Please enter a valid email address.', 'error');
        showAuthError('Please enter a valid email address (e.g. name@example.com).', 'error');
        return;
    }

    if (!password) {
        if (passwordInput) {
            passwordInput.classList.add('border-rose-500', 'ring-2', 'ring-rose-200');
            passwordInput.focus();
        }
        showToast('Please enter your password.', 'error');
        showAuthError('Please enter your password to sign in.', 'error');
        return;
    }

    setButtonLoading('login-submit-btn', true, 'Please wait...');
    showLoading('Please wait', 'Verifying credentials & sending OTP...');

    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await safeParseResponse(response);

        if (!response.ok) {
            // Case 1: Account Not Found / User hasn't signed up
            if (response.status === 404 || data.code === 'ACCOUNT_NOT_FOUND' || (data.error && data.error.toLowerCase().includes('no account found'))) {
                if (emailInput) {
                    emailInput.classList.add('border-amber-500', 'ring-2', 'ring-amber-200');
                    emailInput.focus();
                }
                const notifMsg = 'No account found with this email. You haven\'t signed up yet!';
                showToast(notifMsg, 'warning');
                showAuthError(`<strong>Account not found:</strong> You haven't signed up with this email yet. <a href="javascript:void(0)" onclick="showAuthMode('register'); const regEmail = document.getElementById('reg-email'); if(regEmail) regEmail.value = '${email}';" class="underline text-indigo-600 font-extrabold ml-1 hover:text-indigo-800">Click here to create account</a>`, 'warning');
                return;
            }

            // Case 2: Wrong Password
            if (response.status === 401 || data.code === 'INVALID_PASSWORD' || (data.error && data.error.toLowerCase().includes('incorrect password'))) {
                if (passwordInput) {
                    passwordInput.classList.add('border-rose-500', 'ring-2', 'ring-rose-200');
                    passwordInput.value = '';
                    passwordInput.focus();
                }
                const notifMsg = 'Incorrect password! Please verify your password and try again.';
                showToast(notifMsg, 'error');
                showAuthError('<strong>Incorrect password:</strong> Please verify your password and try again.', 'error');
                return;
            }

            // Generic error
            const genericErr = data.error || 'Login failed. Please verify your email and password.';
            showAuthError(genericErr, 'error');
            showToast(genericErr, 'error');
            return;
        }

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
        showAuthError(error.message || 'Login failed. Please try again.', 'error');
        showToast(error.message || 'Login failed. Please check your connection.', 'error');
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

    updateBadges();
    updateAuthUI();
    switchTab('catalog');
    showToast('You have been logged out successfully.');
}

function updateAuthUI() {
    const btnText = document.getElementById('auth-btn-text');
    const authBtnHeader = document.getElementById('auth-btn-header');
    const userMenuName = document.getElementById('user-menu-name');
    const navOrdersBtn = document.getElementById('nav-orders-btn');
    const dockProfileText = document.getElementById('dock-profile-text');

    if (currentUser) {
        const displayName = currentUser.name ? currentUser.name.split(' ')[0] : currentUser.email.split('@')[0];
        if (btnText) btnText.textContent = currentUser.name || currentUser.email.split('@')[0];
        if (userMenuName) userMenuName.textContent = currentUser.name || currentUser.email;
        if (navOrdersBtn) navOrdersBtn.classList.remove('hidden');
        if (authBtnHeader) authBtnHeader.onclick = toggleUserMenu;
        if (dockProfileText) dockProfileText.textContent = displayName;
    } else {
        if (btnText) btnText.textContent = 'Sign In';
        if (navOrdersBtn) navOrdersBtn.classList.add('hidden');
        if (authBtnHeader) authBtnHeader.onclick = () => openAuthModal('login');
        if (dockProfileText) dockProfileText.textContent = 'Profile';
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

// =========================================================================
// STORE ADMINISTRATOR PORTAL & DEDICATED AUTHENTICATION (SEPARATE FROM USER)
// =========================================================================

let adminToken = localStorage.getItem('sd_admin_token') || null;
let adminUser = JSON.parse(localStorage.getItem('sd_admin_user')) || null;

let adminProductsList = [];
let adminOrdersList = [];
let adminUsersList = [];
let currentAdminOrderFilter = 'all';

function isAdminLoggedIn() {
    return !!adminToken;
}

function handleAdminTabClick() {
    if (isAdminLoggedIn()) {
        switchTab('admin');
    } else {
        openAdminLoginModal();
    }
}

function openAdminLoginModal() {
    const modal = document.getElementById('admin-login-modal');
    if (!modal) return;
    
    const errBox = document.getElementById('admin-login-error');
    if (errBox) errBox.classList.add('hidden');

    modal.classList.remove('hidden');
}

function closeAdminLoginModal() {
    const modal = document.getElementById('admin-login-modal');
    if (modal) modal.classList.add('hidden');
}

function fillDefaultAdminCredentials() {
    const emailInput = document.getElementById('admin-login-email');
    const pwdInput = document.getElementById('admin-login-password');
    if (emailInput) emailInput.value = 'admin@sdshopping.com';
    if (pwdInput) pwdInput.value = 'Admin@123456';
    showToast('Admin credentials filled!', 'success');
}

async function handleAdminLoginSubmit(e) {
    e.preventDefault();
    const email = (document.getElementById('admin-login-email')?.value || '').trim();
    const password = document.getElementById('admin-login-password')?.value || '';

    if (!email || !password) {
        showToast('Please enter both admin email and password', 'error');
        return;
    }

    setButtonLoading('admin-login-submit-btn', true, 'Verifying Admin...');
    showLoading('Administrator Verification', 'Authenticating administrator credentials...');

    try {
        const response = await fetch(`${API_BASE}/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await safeParseResponse(response);
        if (!response.ok) throw new Error(data.error || 'Admin authentication failed');

        adminToken = data.token;
        adminUser = data.admin;

        localStorage.setItem('sd_admin_token', adminToken);
        localStorage.setItem('sd_admin_user', JSON.stringify(adminUser));

        closeAdminLoginModal();
        switchTab('admin');
        showToast(`👑 Welcome back, ${adminUser.name || 'Administrator'}!`);
    } catch (error) {
        console.error('Admin login error:', error);
        const errBox = document.getElementById('admin-login-error');
        const errText = document.getElementById('admin-login-error-text');
        if (errBox && errText) {
            errText.textContent = error.message;
            errBox.classList.remove('hidden');
        }
        showToast(error.message, 'error');
    } finally {
        setButtonLoading('admin-login-submit-btn', false);
        hideLoading();
    }
}

function handleAdminLogout() {
    adminToken = null;
    adminUser = null;
    localStorage.removeItem('sd_admin_token');
    localStorage.removeItem('sd_admin_user');
    
    switchTab('catalog');
    showToast('Administrator logged out successfully');
}

// --- ADMIN SUB-TAB SWITCHER ---
function switchAdminSubTab(subTab) {
    const tabs = ['products', 'orders', 'users'];
    tabs.forEach(t => {
        const btn = document.getElementById(`admin-subtab-btn-${t}`);
        const view = document.getElementById(`admin-view-${t}`);
        
        if (t === subTab) {
            if (btn) {
                btn.className = "admin-subtab-btn px-4 py-2 rounded-xl text-xs font-extrabold transition bg-slate-900 text-white shadow-xs flex items-center space-x-2";
            }
            if (view) view.classList.remove('hidden');
        } else {
            if (btn) {
                btn.className = "admin-subtab-btn px-4 py-2 rounded-xl text-xs font-bold transition bg-gray-50 text-gray-700 hover:bg-gray-100 flex items-center space-x-2";
            }
            if (view) view.classList.add('hidden');
        }
    });

    if (subTab === 'products') loadAdminProducts();
    if (subTab === 'orders') loadAdminOrders();
    if (subTab === 'users') loadAdminUsers();
}

// --- ADMIN DASHBOARD DATA LOADER ---
async function loadAdminDashboardData() {
    if (!adminToken) {
        openAdminLoginModal();
        return;
    }

    // Update Admin header labels
    if (adminUser) {
        const nameDisplay = document.getElementById('admin-user-display');
        const emailDisplay = document.getElementById('admin-email-display');
        if (nameDisplay) nameDisplay.textContent = adminUser.name || 'Store Administrator';
        if (emailDisplay) emailDisplay.textContent = adminUser.email || 'admin@sdshopping.com';
    }

    try {
        const response = await fetch(`${API_BASE}/admin/stats`, {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });

        if (response.status === 401 || response.status === 403) {
            handleAdminLogout();
            openAdminLoginModal();
            return;
        }

        const data = await safeParseResponse(response);
        if (response.ok) {
            const revElem = document.getElementById('admin-stat-revenue');
            const ordElem = document.getElementById('admin-stat-orders');
            const pendElem = document.getElementById('admin-stat-pending');
            const prodElem = document.getElementById('admin-stat-products');
            const userElem = document.getElementById('admin-stat-users');

            if (revElem) revElem.textContent = formatPrice(data.totalRevenue || 0);
            if (ordElem) ordElem.textContent = data.totalOrders || 0;
            if (pendElem) pendElem.textContent = `${data.pendingOrders || 0} Pending`;
            if (prodElem) prodElem.textContent = data.totalProducts || 0;
            if (userElem) userElem.textContent = data.totalUsers || 0;

            const navProdCount = document.getElementById('admin-nav-products-count');
            const navOrdCount = document.getElementById('admin-nav-orders-count');
            if (navProdCount) navProdCount.textContent = data.totalProducts || 0;
            if (navOrdCount) navOrdCount.textContent = data.totalOrders || 0;
        }
    } catch (e) {
        console.warn('Admin stats load notice:', e.message);
    }

    await loadAdminProducts();
    await loadAdminOrders();
    await loadAdminUsers();
}

// --- ADMIN PRODUCT INVENTORY CRUD ---
async function loadAdminProducts() {
    if (!adminToken) return;

    try {
        const response = await fetch(`${API_BASE}/admin/products`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const data = await safeParseResponse(response);
        if (response.ok && Array.isArray(data)) {
            adminProductsList = data;
        } else {
            // Fallback to public catalog
            adminProductsList = products && products.length > 0 ? products : DEFAULT_PRODUCTS;
        }
    } catch (e) {
        adminProductsList = products && products.length > 0 ? products : DEFAULT_PRODUCTS;
    }

    filterAdminProducts();
}

function filterAdminProducts() {
    const searchInput = document.getElementById('admin-product-search');
    const categorySelect = document.getElementById('admin-product-category');
    
    const query = (searchInput ? searchInput.value : '').toLowerCase().trim();
    const category = categorySelect ? categorySelect.value : 'All';

    let filtered = [...adminProductsList];

    if (category && category !== 'All') {
        filtered = filtered.filter(p => (p.category || '').toLowerCase() === category.toLowerCase());
    }

    if (query) {
        filtered = filtered.filter(p => 
            (p.title || '').toLowerCase().includes(query) ||
            (p.category || '').toLowerCase().includes(query) ||
            (p.brand || '').toLowerCase().includes(query) ||
            (p.description || '').toLowerCase().includes(query)
        );
    }

    renderAdminProductsTable(filtered);
}

function renderAdminProductsTable(items) {
    const tbody = document.getElementById('admin-products-table-body');
    if (!tbody) return;

    if (items.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="p-8 text-center text-gray-400">
                    <i class="fa-solid fa-box-open text-3xl mb-2 block"></i>
                    No products found matching your filter criteria.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = items.map(p => {
        const pId = p._id || p.id;
        const pImg = p.image || (p.images && p.images[0]) || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=60';
        const stock = Number(p.stock !== undefined ? p.stock : 50);
        
        let stockBadge = `<span class="bg-emerald-50 text-emerald-700 font-extrabold px-2.5 py-1 rounded-full text-[10px] border border-emerald-200">In Stock (${stock})</span>`;
        if (stock === 0) {
            stockBadge = `<span class="bg-rose-50 text-rose-700 font-extrabold px-2.5 py-1 rounded-full text-[10px] border border-rose-200">Out of Stock</span>`;
        } else if (stock <= 10) {
            stockBadge = `<span class="bg-amber-50 text-amber-700 font-extrabold px-2.5 py-1 rounded-full text-[10px] border border-amber-200">Low Stock (${stock})</span>`;
        }

        return `
            <tr class="hover:bg-gray-50/80 transition">
                <td class="p-3.5 pl-5">
                    <div class="flex items-center space-x-3">
                        <img src="${pImg}" class="w-11 h-11 object-cover rounded-xl border border-gray-200 flex-shrink-0">
                        <div class="min-w-0">
                            <span class="font-bold text-gray-900 block truncate max-w-[220px]">${p.title || 'Untitled Product'}</span>
                            <span class="text-[11px] text-gray-400 font-mono">ID: ${pId}</span>
                        </div>
                    </div>
                </td>
                <td class="p-3.5">
                    <span class="bg-indigo-50 text-indigo-700 font-bold px-2.5 py-0.5 rounded-md text-[11px]">${p.category || 'General'}</span>
                </td>
                <td class="p-3.5 text-gray-700 font-medium">${p.brand || 'SD Originals'}</td>
                <td class="p-3.5 font-bold font-mono text-gray-900 text-sm">${formatPrice(p.price || 0)}</td>
                <td class="p-3.5">${stockBadge}</td>
                <td class="p-3.5 text-amber-500 font-bold text-[11px]">
                    <i class="fa-solid fa-star text-[10px]"></i> ${p.rating || 4.5} <span class="text-gray-400 font-normal">(${p.ratingCount || (p.reviews ? p.reviews.length : 0)})</span>
                </td>
                <td class="p-3.5 pr-5 text-right space-x-1 whitespace-nowrap">
                    <button onclick="openAdminProductModal('${pId}')" class="bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white px-2.5 py-1.5 rounded-lg text-xs font-bold transition inline-flex items-center space-x-1" title="Edit Product">
                        <i class="fa-solid fa-pen-to-square"></i>
                        <span>Edit</span>
                    </button>
                    <button onclick="handleAdminDeleteProduct('${pId}', '${escapeHtml(p.title || '')}')" class="bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white px-2.5 py-1.5 rounded-lg text-xs font-bold transition inline-flex items-center space-x-1" title="Delete Product">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// --- ADMIN IMAGE UPLOADER & PROCESSING ---
let adminSelectedGalleryImages = [];

function compressImageFile(file, maxWidth = 1200, quality = 0.85) {
    return new Promise((resolve, reject) => {
        if (!file || !file.type.startsWith('image/')) {
            return reject(new Error('The selected file is not an image'));
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', quality);
                resolve(dataUrl);
            };
            img.onerror = () => reject(new Error('Could not render image'));
            img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error('Could not read file'));
        reader.readAsDataURL(file);
    });
}

function setAdminCoverImgMode(mode) {
    const fileContainer = document.getElementById('admin-cover-file-container');
    const urlContainer = document.getElementById('admin-cover-url-container');
    const fileBtn = document.getElementById('admin-img-mode-file');
    const urlBtn = document.getElementById('admin-img-mode-url');

    if (mode === 'file') {
        if (fileContainer) fileContainer.classList.remove('hidden');
        if (urlContainer) urlContainer.classList.add('hidden');
        if (fileBtn) {
            fileBtn.className = "px-2.5 py-1 text-[11px] font-extrabold rounded-lg bg-white text-indigo-700 shadow-2xs transition flex items-center space-x-1";
        }
        if (urlBtn) {
            urlBtn.className = "px-2.5 py-1 text-[11px] font-bold rounded-lg text-gray-500 hover:text-gray-800 transition flex items-center space-x-1";
        }
    } else {
        if (fileContainer) fileContainer.classList.add('hidden');
        if (urlContainer) urlContainer.classList.remove('hidden');
        if (fileBtn) {
            fileBtn.className = "px-2.5 py-1 text-[11px] font-bold rounded-lg text-gray-500 hover:text-gray-800 transition flex items-center space-x-1";
        }
        if (urlBtn) {
            urlBtn.className = "px-2.5 py-1 text-[11px] font-extrabold rounded-lg bg-white text-indigo-700 shadow-2xs transition flex items-center space-x-1";
        }
    }
}

async function handleAdminCoverFileSelect(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    showLoading('Processing Photo', 'Compressing and optimizing photo from storage...');
    try {
        const compressedBase64 = await compressImageFile(file);
        const coverDataInput = document.getElementById('admin-prod-cover-data');
        if (coverDataInput) coverDataInput.value = compressedBase64;

        previewAdminProductImage(compressedBase64);
        
        const label = document.getElementById('admin-prod-preview-label');
        const sub = document.getElementById('admin-prod-preview-sub');
        if (label) label.textContent = `Photo Ready (${file.name})`;
        if (sub) sub.textContent = `Optimized from storage (${(file.size / 1024).toFixed(0)} KB)`;

        showToast('📷 Cover photo selected from storage!');
    } catch (err) {
        console.error('Photo selection error:', err);
        showToast(err.message, 'error');
    } finally {
        hideLoading();
    }
}

function resetAdminCoverImage() {
    const coverDataInput = document.getElementById('admin-prod-cover-data');
    const urlInput = document.getElementById('admin-prod-image');
    const fileInput = document.getElementById('admin-prod-file-input');

    if (coverDataInput) coverDataInput.value = '';
    if (urlInput) urlInput.value = '';
    if (fileInput) fileInput.value = '';

    previewAdminProductImage('https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80');

    const label = document.getElementById('admin-prod-preview-label');
    const sub = document.getElementById('admin-prod-preview-sub');
    if (label) label.textContent = 'Default Cover Placeholder';
    if (sub) sub.textContent = 'Tap box above to choose photo from phone or enter URL';
}

async function handleAdminGalleryFilesSelect(event) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    showLoading('Processing Gallery', `Loading ${files.length} photos from storage...`);
    try {
        for (const file of files) {
            const base64 = await compressImageFile(file);
            adminSelectedGalleryImages.push(base64);
        }
        renderAdminGalleryPreview();
        showToast(`Added ${files.length} photos to gallery!`);
    } catch (err) {
        console.error('Gallery photos error:', err);
        showToast(err.message, 'error');
    } finally {
        hideLoading();
        event.target.value = '';
    }
}

function removeAdminGalleryImage(index) {
    if (index >= 0 && index < adminSelectedGalleryImages.length) {
        adminSelectedGalleryImages.splice(index, 1);
        renderAdminGalleryPreview();
    }
}

function renderAdminGalleryPreview() {
    const container = document.getElementById('admin-gallery-preview-container');
    if (!container) return;

    if (adminSelectedGalleryImages.length === 0) {
        container.classList.add('hidden');
        container.innerHTML = '';
        return;
    }

    container.classList.remove('hidden');
    container.innerHTML = adminSelectedGalleryImages.map((imgSrc, idx) => `
        <div class="relative group/gal w-14 h-14 rounded-xl overflow-hidden border border-gray-200 shadow-2xs">
            <img src="${imgSrc}" class="w-full h-full object-cover">
            <button type="button" onclick="removeAdminGalleryImage(${idx})" class="absolute inset-0 bg-black/60 text-white flex items-center justify-center opacity-0 group-hover/gal:opacity-100 transition text-xs font-bold" title="Remove photo">
                <i class="fa-solid fa-trash-can"></i>
            </button>
            <span class="absolute bottom-0.5 right-1 text-[8px] font-black text-white bg-black/50 px-1 rounded">${idx + 1}</span>
        </div>
    `).join('');
}

function openAdminProductModal(productId = null) {
    const modal = document.getElementById('admin-product-modal');
    if (!modal) return;

    const titleElem = document.getElementById('admin-product-modal-title');
    const idInput = document.getElementById('admin-prod-id');
    const titleInput = document.getElementById('admin-prod-title');
    const priceInput = document.getElementById('admin-prod-price');
    const categorySelect = document.getElementById('admin-prod-category');
    const brandInput = document.getElementById('admin-prod-brand');
    const stockInput = document.getElementById('admin-prod-stock');
    const imageInput = document.getElementById('admin-prod-image');
    const coverDataInput = document.getElementById('admin-prod-cover-data');
    const imagesInput = document.getElementById('admin-prod-images');
    const descInput = document.getElementById('admin-prod-description');

    adminSelectedGalleryImages = [];
    setAdminCoverImgMode('file');

    if (productId) {
        const prod = adminProductsList.find(p => (p._id || p.id) == productId);
        if (prod) {
            if (titleElem) titleElem.textContent = 'Edit Product Details';
            if (idInput) idInput.value = productId;
            if (titleInput) titleInput.value = prod.title || '';
            if (priceInput) priceInput.value = prod.price || '';
            if (categorySelect) categorySelect.value = prod.category || 'General';
            if (brandInput) brandInput.value = prod.brand || '';
            if (stockInput) stockInput.value = prod.stock !== undefined ? prod.stock : 50;
            if (imageInput) imageInput.value = prod.image || '';
            if (coverDataInput) coverDataInput.value = prod.image || '';
            
            if (Array.isArray(prod.images)) {
                adminSelectedGalleryImages = [...prod.images];
            } else if (imagesInput) {
                imagesInput.value = '';
            }

            if (descInput) descInput.value = prod.description || '';
            previewAdminProductImage(prod.image || '');
            renderAdminGalleryPreview();
        }
    } else {
        if (titleElem) titleElem.textContent = 'Add New Product';
        if (idInput) idInput.value = '';
        if (titleInput) titleInput.value = '';
        if (priceInput) priceInput.value = '';
        if (categorySelect) categorySelect.value = 'Handbags & Totes';
        if (brandInput) brandInput.value = '';
        if (stockInput) stockInput.value = '50';
        if (imageInput) imageInput.value = '';
        if (coverDataInput) coverDataInput.value = '';
        if (imagesInput) imagesInput.value = '';
        if (descInput) descInput.value = '';
        previewAdminProductImage('');
        renderAdminGalleryPreview();
    }

    modal.classList.remove('hidden');
}

function closeAdminProductModal() {
    const modal = document.getElementById('admin-product-modal');
    if (modal) modal.classList.add('hidden');
}

function previewAdminProductImage(url) {
    const preview = document.getElementById('admin-prod-img-preview');
    if (preview) {
        preview.src = url && (url.startsWith('http') || url.startsWith('data:image')) 
            ? url 
            : 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80';
    }
}

async function handleAdminSaveProduct(e) {
    e.preventDefault();
    if (!adminToken) {
        showToast('Please log in as Administrator', 'error');
        return;
    }

    const prodId = document.getElementById('admin-prod-id')?.value;
    const title = (document.getElementById('admin-prod-title')?.value || '').trim();
    const price = Number(document.getElementById('admin-prod-price')?.value);
    const category = (document.getElementById('admin-prod-category')?.value || 'General').trim();
    const brand = (document.getElementById('admin-prod-brand')?.value || 'SD Originals').trim();
    const stock = Number(document.getElementById('admin-prod-stock')?.value || 50);
    const coverData = (document.getElementById('admin-prod-cover-data')?.value || '').trim();
    const urlImage = (document.getElementById('admin-prod-image')?.value || '').trim();
    const rawImagesText = (document.getElementById('admin-prod-images')?.value || '').trim();
    const description = (document.getElementById('admin-prod-description')?.value || '').trim();

    if (!title || !price || !category) {
        showToast('Please complete all required product fields', 'error');
        return;
    }

    const mainCover = coverData || urlImage || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80';

    let extraGallery = rawImagesText ? rawImagesText.split(',').map(s => s.trim()).filter(Boolean) : [];
    let completeGallery = [...adminSelectedGalleryImages, ...extraGallery];
    
    // Ensure cover is in gallery
    if (mainCover && !completeGallery.includes(mainCover)) {
        completeGallery.unshift(mainCover);
    }

    const payload = {
        title,
        price,
        category,
        brand,
        stock,
        image: mainCover,
        images: completeGallery,
        description
    };

    setButtonLoading('admin-prod-save-btn', true, 'Saving...');
    showLoading('Saving Product', 'Updating store catalog database...');

    try {
        const url = prodId ? `${API_BASE}/admin/products/${prodId}` : `${API_BASE}/admin/products`;
        const method = prodId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify(payload)
        });

        const data = await safeParseResponse(response);
        if (!response.ok) throw new Error(data.error || 'Failed to save product');

        closeAdminProductModal();
        await loadAdminDashboardData();
        await fetchProducts(); // Refresh store catalog
        showToast(`🎉 Product "${title}" saved successfully!`);
    } catch (error) {
        console.error('Admin save product error:', error);
        showToast(error.message, 'error');
    } finally {
        setButtonLoading('admin-prod-save-btn', false);
        hideLoading();
    }
}

async function handleAdminDeleteProduct(productId, productTitle) {
    if (!adminToken) return;

    if (!confirm(`Are you sure you want to delete "${productTitle}" from the store catalog?`)) {
        return;
    }

    showLoading('Deleting Product', 'Removing product from inventory...');

    try {
        const response = await fetch(`${API_BASE}/admin/products/${productId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });

        const data = await safeParseResponse(response);
        if (!response.ok) throw new Error(data.error || 'Failed to delete product');

        await loadAdminDashboardData();
        await fetchProducts();
        showToast(`🗑️ Product "${productTitle}" deleted successfully`);
    } catch (error) {
        console.error('Admin delete product error:', error);
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}

// --- ADMIN ORDERS & FULFILLMENT TRACKER ---
async function loadAdminOrders() {
    if (!adminToken) return;

    try {
        const response = await fetch(`${API_BASE}/admin/orders`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const data = await safeParseResponse(response);
        if (response.ok && Array.isArray(data)) {
            adminOrdersList = data;
        } else {
            adminOrdersList = orders || [];
        }
    } catch (e) {
        adminOrdersList = orders || [];
    }

    filterAdminOrders();
}

function setAdminOrderStatusFilter(status) {
    currentAdminOrderFilter = status;
    
    document.querySelectorAll('.admin-order-filter-btn').forEach(btn => {
        if (btn.dataset.status === status) {
            btn.className = "admin-order-filter-btn px-3 py-1.5 rounded-lg text-xs font-extrabold bg-indigo-600 text-white transition";
        } else {
            btn.className = "admin-order-filter-btn px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition";
        }
    });

    filterAdminOrders();
}

function filterAdminOrders() {
    const searchInput = document.getElementById('admin-order-search');
    const query = (searchInput ? searchInput.value : '').toLowerCase().trim();

    let filtered = [...adminOrdersList];

    if (currentAdminOrderFilter && currentAdminOrderFilter !== 'all') {
        filtered = filtered.filter(o => (o.status || 'pending').toLowerCase() === currentAdminOrderFilter.toLowerCase());
    }

    if (query) {
        filtered = filtered.filter(o => 
            (o.trackingNumber || '').toLowerCase().includes(query) ||
            (o.transactionId || '').toLowerCase().includes(query) ||
            (o._id || '').toLowerCase().includes(query) ||
            (typeof o.shippingAddress === 'string' && o.shippingAddress.toLowerCase().includes(query)) ||
            (o.shippingAddress && o.shippingAddress.address && o.shippingAddress.address.toLowerCase().includes(query))
        );
    }

    renderAdminOrdersTable(filtered);
}

function renderAdminOrdersTable(items) {
    const tbody = document.getElementById('admin-orders-table-body');
    if (!tbody) return;

    if (items.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="p-8 text-center text-gray-400">
                    <i class="fa-solid fa-inbox text-3xl mb-2 block"></i>
                    No customer orders found.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = items.map(o => {
        const orderId = o._id || o.id;
        const tracking = o.trackingNumber || `SD-TRK-${orderId.substring(0, 6)}`;
        const dateStr = o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recent';
        const address = typeof o.shippingAddress === 'object' ? (o.shippingAddress.address || o.shippingAddress.city || 'Standard Shipping') : (o.shippingAddress || 'Standard Delivery');
        const itemsList = Array.isArray(o.items) ? o.items.map(i => `${i.quantity || i.qty || 1}x ${i.title || i.name}`).join(', ') : 'Order Items';
        const total = Number(o.totalAmount || 0);
        const status = (o.status || 'pending').toLowerCase();

        return `
            <tr class="hover:bg-gray-50/80 transition">
                <td class="p-3.5 pl-5">
                    <div class="flex items-center space-x-1.5">
                        <span class="font-mono font-black text-gray-900">${tracking}</span>
                        <button onclick="copyToClipboard('${tracking}')" class="text-gray-400 hover:text-indigo-600 transition" title="Copy tracking number">
                            <i class="fa-regular fa-copy text-xs"></i>
                        </button>
                    </div>
                </td>
                <td class="p-3.5 text-gray-500 text-[11px] whitespace-nowrap">${dateStr}</td>
                <td class="p-3.5">
                    <span class="font-medium text-gray-800 line-clamp-1 max-w-[180px]">${address}</span>
                </td>
                <td class="p-3.5">
                    <span class="text-gray-600 line-clamp-1 max-w-[200px]" title="${escapeHtml(itemsList)}">${itemsList}</span>
                </td>
                <td class="p-3.5 font-bold font-mono text-gray-900 text-sm whitespace-nowrap">${formatPrice(total)}</td>
                <td class="p-3.5">
                    <span class="bg-gray-100 text-gray-700 font-bold px-2 py-0.5 rounded text-[11px] whitespace-nowrap">${o.paymentMethod || 'Card'}</span>
                </td>
                <td class="p-3.5">
                    <select onchange="handleAdminChangeOrderStatus('${orderId}', this.value)" class="bg-white border border-gray-200 text-xs font-bold rounded-lg px-2.5 py-1 text-gray-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-xs">
                        <option value="pending" ${status === 'pending' ? 'selected' : ''}>⏳ Pending</option>
                        <option value="processing" ${status === 'processing' ? 'selected' : ''}>📦 Processing</option>
                        <option value="shipped" ${status === 'shipped' ? 'selected' : ''}>🚚 Shipped</option>
                        <option value="delivered" ${status === 'delivered' ? 'selected' : ''}>✅ Delivered</option>
                        <option value="cancelled" ${status === 'cancelled' ? 'selected' : ''}>❌ Cancelled</option>
                    </select>
                </td>
                <td class="p-3.5 pr-5 text-right whitespace-nowrap space-x-1">
                    <button onclick="openInvoiceModalFromData(${escapeJsonForAttr(o)})" class="bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white px-2.5 py-1.5 rounded-lg text-xs font-bold transition inline-flex items-center space-x-1" title="View & Print Official Invoice">
                        <i class="fa-solid fa-file-invoice"></i>
                        <span>Invoice</span>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

async function handleAdminChangeOrderStatus(orderId, newStatus) {
    if (!adminToken) return;

    showLoading('Updating Order', `Changing status to ${newStatus}...`);

    try {
        const response = await fetch(`${API_BASE}/admin/orders/${orderId}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ status: newStatus })
        });

        const data = await safeParseResponse(response);
        if (!response.ok) throw new Error(data.error || 'Failed to update order status');

        await loadAdminDashboardData();
        showToast(`📦 Order status updated to "${newStatus.toUpperCase()}"`);
    } catch (error) {
        console.error('Admin update order status error:', error);
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}

// Helper to open invoice modal directly from an order object
function openInvoiceModalFromData(order) {
    if (!order) return;
    renderInvoiceModalContent(order);
    const invoiceModal = document.getElementById('invoice-modal');
    if (invoiceModal) invoiceModal.classList.remove('hidden');
}

// --- ADMIN REGISTERED CUSTOMERS ---
async function loadAdminUsers() {
    if (!adminToken) return;

    try {
        const response = await fetch(`${API_BASE}/admin/users`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const data = await safeParseResponse(response);
        if (response.ok && Array.isArray(data)) {
            adminUsersList = data;
        } else {
            adminUsersList = [];
        }
    } catch (e) {
        adminUsersList = [];
    }

    filterAdminUsers();
}

function filterAdminUsers() {
    const searchInput = document.getElementById('admin-user-search');
    const query = (searchInput ? searchInput.value : '').toLowerCase().trim();

    let filtered = [...adminUsersList];

    if (query) {
        filtered = filtered.filter(u => 
            (u.name || '').toLowerCase().includes(query) ||
            (u.email || '').toLowerCase().includes(query) ||
            (u.phone || '').toLowerCase().includes(query) ||
            (u.city || '').toLowerCase().includes(query)
        );
    }

    renderAdminUsersTable(filtered);
}

function renderAdminUsersTable(items) {
    const tbody = document.getElementById('admin-users-table-body');
    if (!tbody) return;

    if (items.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="p-8 text-center text-gray-400">
                    <i class="fa-solid fa-users text-3xl mb-2 block"></i>
                    No customer records found.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = items.map(u => {
        const dateStr = u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '2026';
        const isVerified = u.isVerified !== false;
        
        return `
            <tr class="hover:bg-gray-50/80 transition">
                <td class="p-3.5 pl-5">
                    <div class="flex items-center space-x-3">
                        <div class="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-extrabold flex items-center justify-center text-xs">
                            ${(u.name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <span class="font-bold text-gray-900">${u.name || 'Customer'}</span>
                    </div>
                </td>
                <td class="p-3.5 text-gray-700 font-mono text-xs">${u.email || 'N/A'}</td>
                <td class="p-3.5 text-gray-500">${u.phone || '—'}</td>
                <td class="p-3.5 text-gray-600">${[u.city, u.address].filter(Boolean).join(', ') || '—'}</td>
                <td class="p-3.5">
                    ${isVerified 
                        ? `<span class="bg-emerald-50 text-emerald-700 font-extrabold px-2.5 py-0.5 rounded-full text-[10px] border border-emerald-200 inline-flex items-center space-x-1"><i class="fa-solid fa-check"></i><span>Verified</span></span>`
                        : `<span class="bg-amber-50 text-amber-700 font-bold px-2 py-0.5 rounded-full text-[10px]">Unverified</span>`
                    }
                </td>
                <td class="p-3.5 font-bold text-indigo-600 font-mono">${u.orderCount || 0}</td>
                <td class="p-3.5 pr-5 text-right text-gray-400 text-[11px]">${dateStr}</td>
            </tr>
        `;
    }).join('');
}

// Safe attribute JSON encoder
function escapeJsonForAttr(obj) {
    try {
        return JSON.stringify(obj).replace(/"/g, '&quot;');
    } catch (e) {
        return '{}';
    }
}

