// =================================================================
// MACH ONE LOADERS — STOREFRONT APPLICATION
// Products come live from the Cloudflare Worker (Stripe catalog)
// =================================================================

// 1. CONFIG
const WORKER_API_URL = 'https://mach-one-api.jaythedetechtive.workers.dev';
const CART_STORAGE_KEY = 'machone-cart';

// Global State
const state = {
    products: [],          // Live inventory from Worker / Stripe
    cart: loadCart(),      // Cart survives the trip to Stripe and back
    currentBrand: 'all',   // Active brand filter (from Stripe metadata key)
    searchQuery: ''        // Active search query
};

// =================================================================
// 2. HELPERS
// =================================================================
function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function formatPrice(value) {
    return `$${parseFloat(value || 0).toFixed(2)}`;
}

function loadCart() {
    try {
        return JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || [];
    } catch {
        return [];
    }
}

function persistCart() {
    try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state.cart));
    } catch {
        // Storage unavailable (private mode, etc.); cart still works for this page view
    }
}

// =================================================================
// 3. FETCH LIVE CATALOG FROM CLOUDFLARE WORKER
// =================================================================
async function loadStripeCatalog() {
    const grid = document.getElementById('product-grid');
    if (!grid) return;

    grid.innerHTML = `
        <div class="col-span-full bg-white border border-slate-300 p-8 text-center rounded">
            <i class="fa-solid fa-spinner fa-spin text-gunpost-slate text-3xl mb-2"></i>
            <div class="text-sm font-bold text-gunpost-textDark">Loading Live Catalog from Stripe...</div>
            <div class="text-xs text-gunpost-textMuted mt-1">Fetching products securely via Cloudflare edge.</div>
        </div>
    `;

    try {
        const response = await fetch(WORKER_API_URL);
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

        state.products = await response.json();

        renderBrandFilters();
        renderCatalog();
    } catch (error) {
        console.error('Failed to fetch Stripe products:', error);
        grid.innerHTML = `
            <div class="col-span-full bg-white border border-red-300 p-8 text-center rounded">
                <i class="fa-solid fa-circle-exclamation text-red-500 text-3xl mb-2"></i>
                <div class="text-sm font-bold text-gunpost-textDark">Unable to load listings</div>
                <div class="text-xs text-gunpost-textMuted mt-1">Please refresh the page. If the problem continues, contact sales@machoneloaders.ca.</div>
            </div>
        `;
    }
}

// =================================================================
// 4. BRAND FILTERS (built from Stripe metadata key)
// =================================================================
function brandButtonClass(active) {
    return active
        ? 'brand-btn bg-gunpost-slate text-white border-slate-700 font-bold px-3 py-1.5 rounded border'
        : 'brand-btn bg-slate-100 text-gunpost-textDark hover:bg-slate-200 border-slate-300 font-medium px-3 py-1.5 rounded border';
}

function renderBrandFilters() {
    const container = document.getElementById('brand-filters');
    if (!container) return;

    const brands = [...new Set(state.products.map(p => p.brand).filter(Boolean))].sort();

    container.innerHTML = [
        `<button data-brand="all" class="${brandButtonClass(state.currentBrand === 'all')}">All Listings</button>`,
        ...brands.map(brand =>
            `<button data-brand="${escapeHtml(brand)}" class="${brandButtonClass(state.currentBrand === brand)}">${escapeHtml(brand)}</button>`
        )
    ].join('');
}

// =================================================================
// 5. CATALOG RENDERING & FILTERING
// =================================================================
function renderCatalog() {
    const grid = document.getElementById('product-grid');
    if (!grid) return;

    let filtered = state.products;

    // Brand filter
    if (state.currentBrand !== 'all') {
        filtered = filtered.filter(p => p.brand === state.currentBrand);
    }

    // Text search across name, description, brand and model
    const query = state.searchQuery.trim().toLowerCase();
    if (query) {
        filtered = filtered.filter(p =>
            [p.name, p.description, p.brand, p.model]
                .some(value => (value || '').toLowerCase().includes(query))
        );
    }

    const productCountEl = document.getElementById('product-count');
    if (productCountEl) productCountEl.textContent = filtered.length;

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full bg-white border border-gunpost-border p-8 text-center rounded">
                <i class="fa-solid fa-magnifying-glass text-slate-300 text-3xl mb-2"></i>
                <div class="text-sm font-bold text-gunpost-textDark">No Products Matching Criteria</div>
                <div class="text-xs text-gunpost-textMuted mt-1">Try clearing your search or choosing a different brand.</div>
            </div>
        `;
        return;
    }

    grid.innerHTML = filtered.map(item => `
        <div class="gp-card p-4 rounded flex flex-col justify-between transition-all">
            <div>
                <div class="flex justify-between items-center mb-2 pb-2 border-b border-slate-100 text-[11px]">
                    <span class="bg-gunpost-slate text-white px-2 py-0.5 rounded font-bold">${escapeHtml(item.brand)}</span>
                    <span class="${item.inStock ? 'text-gunpost-green' : 'text-red-600'} font-semibold">
                        <i class="fa-solid fa-circle text-[8px] mr-1"></i> ${item.inStock ? 'In Stock' : 'Out of Stock'}
                    </span>
                </div>

                <h3 class="text-sm font-bold text-gunpost-textDark hover:text-gunpost-slate transition-colors mb-1">
                    ${escapeHtml(item.name)}
                </h3>

                <div class="text-base font-bold text-gunpost-green mb-2">
                    ${formatPrice(item.price)} <span class="text-xs text-slate-500 font-normal">CAD</span>
                </div>

                <div class="bg-slate-50 border border-slate-200 rounded p-2 text-[11px] space-y-1 mb-3">
                    <div class="flex justify-between"><span class="text-slate-500">Brand:</span> <span class="font-semibold text-gunpost-textDark">${escapeHtml(item.brand)}</span></div>
                    <div class="flex justify-between"><span class="text-slate-500">Model:</span> <span class="font-semibold text-gunpost-textDark">${escapeHtml(item.model || 'N/A')}</span></div>
                </div>

                <p class="text-xs text-gunpost-textMuted mb-4 leading-relaxed">${escapeHtml(item.description || 'No description provided.')}</p>
            </div>

            <div class="pt-2 border-t border-slate-100 flex gap-2">
                <button onclick="addToCart('${escapeHtml(item.id)}')" ${item.inStock ? '' : 'disabled'}
                    class="flex-grow bg-gunpost-green hover:bg-gunpost-greenHover disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-xs py-2 px-3 rounded transition-colors flex items-center justify-center space-x-1">
                    <i class="fa-solid fa-cart-plus text-xs"></i>
                    <span>${item.inStock ? 'ADD TO CART' : 'UNAVAILABLE'}</span>
                </button>
            </div>
        </div>
    `).join('');
}

// =================================================================
// 6. CART
// =================================================================
function renderCart() {
    const container = document.getElementById('cart-items-container');
    const counter = document.getElementById('cart-counter');
    const subtotalEl = document.getElementById('cart-subtotal');
    const totalEl = document.getElementById('cart-total');

    if (!container) return;

    const totalCount = state.cart.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = state.cart.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);

    if (counter) counter.textContent = totalCount;
    if (subtotalEl) subtotalEl.textContent = `$${subtotal.toFixed(2)} CAD`;
    if (totalEl) totalEl.textContent = `$${subtotal.toFixed(2)} CAD`;

    persistCart();

    if (state.cart.length === 0) {
        container.innerHTML = `
            <div class="h-64 flex flex-col items-center justify-center text-center p-4">
                <i class="fa-solid fa-cart-flatbed text-slate-300 text-4xl mb-2"></i>
                <div class="text-xs font-bold text-gunpost-textDark">Your Cart is Empty</div>
                <div class="text-[11px] text-slate-400 mt-1">Select speed loaders from the listings to add.</div>
            </div>
        `;
        return;
    }

    container.innerHTML = state.cart.map(item => `
        <div class="bg-slate-50 border border-slate-200 p-3 rounded flex items-center justify-between text-xs">
            <div class="flex-grow pr-2">
                <div class="font-bold text-gunpost-textDark">${escapeHtml(item.name)}</div>
                <div class="text-gunpost-green font-bold mt-0.5">${formatPrice(item.price)} CAD</div>
                <div class="flex items-center space-x-2 mt-2">
                    <button onclick="updateQuantity('${escapeHtml(item.id)}', -1)" class="w-5 h-5 bg-white border border-slate-300 rounded text-slate-700 font-bold flex items-center justify-center hover:bg-slate-100">-</button>
                    <span class="font-bold text-gunpost-textDark">${item.quantity}</span>
                    <button onclick="updateQuantity('${escapeHtml(item.id)}', 1)" class="w-5 h-5 bg-white border border-slate-300 rounded text-slate-700 font-bold flex items-center justify-center hover:bg-slate-100">+</button>
                </div>
            </div>
            <button onclick="removeFromCart('${escapeHtml(item.id)}')" class="text-slate-400 hover:text-red-600 p-1" aria-label="Remove item">
                <i class="fa-solid fa-trash-can text-sm"></i>
            </button>
        </div>
    `).join('');
}

function addToCart(productId) {
    const product = state.products.find(p => p.id === productId);
    if (!product || !product.inStock) return;

    const existing = state.cart.find(item => item.id === productId);
    if (existing) {
        existing.quantity++;
    } else {
        state.cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            priceId: product.priceId,
            quantity: 1
        });
    }

    renderCart();
    showToast(`Added ${product.name} to cart`, 'success');
}

function updateQuantity(productId, delta) {
    const item = state.cart.find(i => i.id === productId);
    if (!item) return;

    item.quantity += delta;
    if (item.quantity <= 0) {
        removeFromCart(productId);
    } else {
        renderCart();
    }
}

function removeFromCart(productId) {
    state.cart = state.cart.filter(i => i.id !== productId);
    renderCart();
}

// =================================================================
// 7. TOASTS
// =================================================================
function showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = {
        success: 'fa-circle-check text-green-400',
        error: 'fa-circle-exclamation text-red-400',
        info: 'fa-circle-info text-blue-400'
    };

    const toast = document.createElement('div');
    toast.className = 'pointer-events-auto bg-gunpost-navy text-white border-l-4 border-gunpost-green px-4 py-2.5 text-xs font-medium shadow-lg flex items-center space-x-2 transition-all transform translate-y-2 opacity-0';
    toast.innerHTML = `
        <i class="fa-solid ${icons[type] || icons.info}"></i>
        <span>${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => toast.classList.remove('translate-y-2', 'opacity-0'), 10);
    setTimeout(() => {
        toast.classList.add('opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// =================================================================
// 8. CART DRAWER, FILTERS, SEARCH
// =================================================================
function setupDrawerEvents() {
    const drawer = document.getElementById('cart-drawer');
    const backdrop = document.getElementById('cart-drawer-backdrop');
    const openBtn = document.getElementById('cart-toggle-btn');
    const closeBtn = document.getElementById('cart-close-btn');

    if (!drawer || !openBtn) return;

    const openCart = () => {
        drawer.classList.remove('translate-x-full');
        if (backdrop) backdrop.classList.remove('opacity-0', 'pointer-events-none');
    };

    const closeCart = () => {
        drawer.classList.add('translate-x-full');
        if (backdrop) backdrop.classList.add('opacity-0', 'pointer-events-none');
    };

    openBtn.addEventListener('click', openCart);
    if (closeBtn) closeBtn.addEventListener('click', closeCart);
    if (backdrop) backdrop.addEventListener('click', closeCart);
}

function setupSearchAndFilters() {
    const brandContainer = document.getElementById('brand-filters');
    const activeLabel = document.getElementById('active-filter-label');

    if (brandContainer) {
        brandContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.brand-btn');
            if (!btn) return;

            state.currentBrand = btn.dataset.brand;

            brandContainer.querySelectorAll('.brand-btn').forEach(b => {
                b.className = brandButtonClass(b === btn);
            });

            if (activeLabel) {
                activeLabel.textContent = state.currentBrand === 'all'
                    ? 'Showing All Products'
                    : `Filtered by: ${state.currentBrand}`;
            }

            renderCatalog();
        });
    }

    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            state.searchQuery = e.target.value;
            renderCatalog();
        });
    }
}

// =================================================================
// 9. CHECKOUT
// =================================================================
function setupCheckout() {
    const checkoutBtn = document.getElementById('checkout-btn');
    if (!checkoutBtn) return;

    const resetButton = () => {
        checkoutBtn.disabled = false;
        checkoutBtn.innerHTML = '<i class="fa-solid fa-lock"></i> <span>PROCEED TO STRIPE CHECKOUT</span>';
    };

    checkoutBtn.addEventListener('click', async () => {
        if (state.cart.length === 0) {
            showToast('Please add items to your cart before proceeding', 'info');
            return;
        }

        checkoutBtn.disabled = true;
        checkoutBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> CREATING CHECKOUT...';
        showToast('Connecting to secure Stripe Checkout...', 'info');

        try {
            // Send only what the Worker needs. Prices are looked up on the server.
            const items = state.cart.map(({ id, name, priceId, quantity }) => ({
                id, name, priceId, quantity
            }));

            const response = await fetch(WORKER_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `Server returned status ${response.status}`);
            }

            if (!data.url) {
                throw new Error('No checkout URL returned from server.');
            }

            window.location.href = data.url;
        } catch (error) {
            console.error('Checkout error:', error);
            showToast(`Checkout failed: ${error.message}`, 'error', 10000);
            resetButton();
        }
    });
}

// Returning from Stripe: ?status=success or ?status=cancel
function handleCheckoutReturn() {
    const status = new URLSearchParams(window.location.search).get('status');

    if (status === 'success') {
        state.cart = [];
        renderCart();
        showToast('Payment received. Thank you for your order!', 'success', 8000);
    } else if (status === 'cancel') {
        showToast('Checkout cancelled. Your cart has been kept.', 'info', 6000);
    }

    if (status) {
        window.history.replaceState({}, '', window.location.pathname);
    }
}

// =================================================================
// 10. CUSTOM ORDER FORM
// =================================================================
function setupCustomOrderForm() {
    const form = document.getElementById('custom-order-form');
    if (!form) return;

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        showToast('Custom loader request submitted successfully!', 'success');
        form.reset();
    });
}

// =================================================================
// 11. INIT
// =================================================================
document.addEventListener('DOMContentLoaded', () => {
    loadStripeCatalog();
    renderCart();
    setupDrawerEvents();
    setupSearchAndFilters();
    setupCheckout();
    setupCustomOrderForm();
    handleCheckoutReturn();
});
