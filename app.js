// =================================================================
// MACH ONE LOADERS — DYNAMIC FRONTEND APPLICATION
// Connected live to Cloudflare Worker API Endpoint
// =================================================================

// 1. CLOUDFLARE WORKER API ENDPOINT
const WORKER_API_URL = 'https://mach-one-api.jaythedetechtive.workers.dev';

// Global State
let state = {
    products: [],         // Live inventory fetched from Cloudflare Worker / Stripe
    cart: [],             // Local shopping cart state
    currentFilter: 'all', // Active caliber tab filter
    searchQuery: ''       // Active search bar query
};

// =================================================================
// 2. FETCH LIVE CATALOG FROM CLOUDFLARE WORKER
// =================================================================
async function loadStripeCatalog() {
    const grid = document.getElementById('product-grid');
    if (!grid) return;
    
    // Show Classifieds loading state
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
        
        // Render fetched products
        renderCatalog();
    } catch (error) {
        console.error('Failed to fetch Stripe products:', error);
        grid.innerHTML = `
            <div class="col-span-full bg-white border border-red-300 p-8 text-center rounded">
                <i class="fa-solid fa-circle-exclamation text-red-500 text-3xl mb-2"></i>
                <div class="text-sm font-bold text-gunpost-textDark">Unable to load listings</div>
                <div class="text-xs text-gunpost-textMuted mt-1">Check Worker API configuration or refresh page.</div>
            </div>
        `;
    }
}

// =================================================================
// 3. CATALOG RENDERING & FILTERING
// =================================================================
function renderCatalog() {
    const grid = document.getElementById('product-grid');
    const selectCaliberEl = document.getElementById('search-caliber-select');
    const selectCaliber = selectCaliberEl ? selectCaliberEl.value : 'all';
    
    let filtered = state.products;

    // Apply Caliber Tab or Dropdown Filter
    const filterToApply = state.currentFilter !== 'all' ? state.currentFilter : selectCaliber;
    if (filterToApply !== 'all') {
        filtered = filtered.filter(p => {
            const caliberVal = (p.caliber || '').toLowerCase();
            return caliberVal.includes(filterToApply.toLowerCase());
        });
    }

    // Apply Text Search Filter
    const searchInputEl = document.getElementById('search-input');
    if (searchInputEl && searchInputEl.value.trim() !== '') {
        state.searchQuery = searchInputEl.value;
    }
    if (state.searchQuery.trim() !== '') {
        const query = state.searchQuery.toLowerCase();
        filtered = filtered.filter(p => 
            (p.name || '').toLowerCase().includes(query) || 
            (p.description || '').toLowerCase().includes(query) ||
            (p.platform || '').toLowerCase().includes(query) ||
            (p.fits || '').toLowerCase().includes(query)
        );
    }

    // Update Product Count Counter
    const productCountEl = document.getElementById('product-count');
    if (productCountEl) {
        productCountEl.textContent = filtered.length;
    }

    // Empty state
    if (filtered.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full bg-white border border-gunpost-border p-8 text-center rounded">
                <i class="fa-solid fa-magnifying-glass text-slate-300 text-3xl mb-2"></i>
                <div class="text-sm font-bold text-gunpost-textDark">No Loaders Matching Criteria</div>
                <div class="text-xs text-gunpost-textMuted mt-1">Try clearing your search query or submit a custom loader request.</div>
            </div>
        `;
        return;
    }

    // Render Listings
    grid.innerHTML = filtered.map(item => `
        <div class="gp-card p-4 rounded flex flex-col justify-between transition-all">
            <div>
                <!-- Header Badges -->
                <div class="flex justify-between items-center mb-2 pb-2 border-b border-slate-100 text-[11px]">
                    <span class="bg-gunpost-slate text-white px-2 py-0.5 rounded font-bold">${item.caliber || 'UNIVERSAL'}</span>
                    <span class="text-gunpost-green font-semibold">
                        <i class="fa-solid fa-circle text-[8px] mr-1"></i> ${item.inStock ? 'In Stock' : 'Out of Stock'}
                    </span>
                </div>

                <!-- Listing Title -->
                <h3 class="text-sm font-bold text-gunpost-textDark hover:text-gunpost-slate transition-colors mb-1">
                    ${item.name}
                </h3>

                <!-- Price Tag -->
                <div class="text-base font-bold text-gunpost-green mb-2">
                    $${parseFloat(item.price).toFixed(2)} <span class="text-xs text-slate-500 font-normal">CAD</span>
                </div>

                <!-- Listing Details Box -->
                <div class="bg-slate-50 border border-slate-200 rounded p-2 text-[11px] space-y-1 mb-3">
                    <div class="flex justify-between"><span class="text-slate-500">Caliber:</span> <span class="font-semibold text-gunpost-textDark uppercase">${item.caliber || 'N/A'}</span></div>
                    <div class="flex justify-between"><span class="text-slate-500">Platform:</span> <span class="font-semibold text-gunpost-textDark">${item.platform || 'Multi-Platform'}</span></div>
                    <div class="flex justify-between truncate"><span class="text-slate-500">Fits:</span> <span class="font-semibold text-gunpost-textDark truncate ml-2">${item.fits || 'Standard Magazines'}</span></div>
                </div>

                <p class="text-xs text-gunpost-textMuted mb-4 leading-relaxed">${item.description || 'Precision high-strength polymer magazine assist loader.'}</p>
            </div>

            <!-- Card Action Button -->
            <div class="pt-2 border-t border-slate-100 flex gap-2">
                <button onclick="addToCart('${item.id}')" class="flex-grow bg-gunpost-green hover:bg-gunpost-greenHover text-white font-bold text-xs py-2 px-3 rounded transition-colors flex items-center justify-center space-x-1">
                    <i class="fa-solid fa-cart-plus text-xs"></i>
                    <span>ADD TO CART</span>
                </button>
            </div>
        </div>
    `).join('');
}

// =================================================================
// 4. CART DRAWER & REACTIVE MANAGERS
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

    if (state.cart.length === 0) {
        container.innerHTML = `
            <div class="h-64 flex flex-col items-center justify-center text-center p-4">
                <i class="fa-solid fa-cart-flatbed text-slate-300 text-4xl mb-2"></i>
                <div class="text-xs font-bold text-gunpost-textDark">Your Cart is Empty</div>
                <div class="text-[11px] text-slate-400 mt-1">Select speed loaders from the classifieds list to add.</div>
            </div>
        `;
        return;
    }

    container.innerHTML = state.cart.map(item => `
        <div class="bg-slate-50 border border-slate-200 p-3 rounded flex items-center justify-between text-xs">
            <div class="flex-grow pr-2">
                <div class="font-bold text-gunpost-textDark">${item.name}</div>
                <div class="text-gunpost-green font-bold mt-0.5">$${parseFloat(item.price).toFixed(2)} CAD</div>
                <div class="flex items-center space-x-2 mt-2">
                    <button onclick="updateQuantity('${item.id}', -1)" class="w-5 h-5 bg-white border border-slate-300 rounded text-slate-700 font-bold flex items-center justify-center hover:bg-slate-100">-</button>
                    <span class="font-bold text-gunpost-textDark">${item.quantity}</span>
                    <button onclick="updateQuantity('${item.id}', 1)" class="w-5 h-5 bg-white border border-slate-300 rounded text-slate-700 font-bold flex items-center justify-center hover:bg-slate-100">+</button>
                </div>
            </div>
            <button onclick="removeFromCart('${item.id}')" class="text-slate-400 hover:text-red-600 p-1">
                <i class="fa-solid fa-trash-can text-sm"></i>
            </button>
        </div>
    `).join('');
}

function addToCart(productId) {
    const product = state.products.find(p => p.id === productId);
    if (!product) return;

    const existing = state.cart.find(item => item.id === productId);
    if (existing) {
        existing.quantity++;
    } else {
        state.cart.push({ ...product, quantity: 1 });
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

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `pointer-events-auto bg-gunpost-navy text-white border-l-4 border-gunpost-green px-4 py-2.5 text-xs font-medium shadow-lg flex items-center space-x-2 transition-all transform translate-y-2 opacity-0`;
    toast.innerHTML = `
        <i class="fa-solid ${type === 'success' ? 'fa-circle-check text-green-400' : 'fa-circle-info text-blue-400'}"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);
    
    setTimeout(() => toast.classList.remove('translate-y-2', 'opacity-0'), 10);
    setTimeout(() => {
        toast.classList.add('opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// =================================================================
// 5. EVENT LISTENERS & SETUP
// =================================================================
function setupDrawerEvents() {
    const drawer = document.getElementById('cart-drawer');
    const backdrop = document.getElementById('cart-drawer-backdrop');
    const openBtn = document.getElementById('cart-toggle-btn');
    const closeBtn = document.getElementById('cart-close-btn');

    if (!drawer || !openBtn) return;

    function openCart() {
        drawer.classList.remove('translate-x-full');
        if (backdrop) backdrop.classList.remove('opacity-0', 'pointer-events-none');
    }

    function closeCart() {
        drawer.classList.add('translate-x-full');
        if (backdrop) backdrop.classList.add('opacity-0', 'pointer-events-none');
    }

    openBtn.addEventListener('click', openCart);
    if (closeBtn) closeBtn.addEventListener('click', closeCart);
    if (backdrop) backdrop.addEventListener('click', closeCart);
}

function setupSearchAndFilters() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    const activeLabel = document.getElementById('active-filter-label');

    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => {
                b.classList.remove('bg-gunpost-slate', 'text-white', 'border-slate-700', 'font-bold');
                b.classList.add('bg-slate-100', 'text-gunpost-textDark', 'border-slate-300', 'font-medium');
            });

            btn.classList.remove('bg-slate-100', 'text-gunpost-textDark', 'border-slate-300', 'font-medium');
            btn.classList.add('bg-gunpost-slate', 'text-white', 'border-slate-700', 'font-bold');

            state.currentFilter = btn.dataset.filter;
            if (activeLabel) {
                activeLabel.textContent = state.currentFilter === 'all' 
                    ? 'Showing All Accessories' 
                    : `Filtered by: ${state.currentFilter.toUpperCase()}`;
            }
            
            renderCatalog();
        });
    });

    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            state.searchQuery = e.target.value;
            renderCatalog();
        });
    }

    const caliberSelect = document.getElementById('search-caliber-select');
    if (caliberSelect) {
        caliberSelect.addEventListener('change', () => {
            renderCatalog();
        });
    }
}

// Initialize application on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    loadStripeCatalog();
    renderCart();
    setupDrawerEvents();
    setupSearchAndFilters();

    // Checkout Button Trigger
    const checkoutBtn = document.getElementById('checkout-btn');
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', async () => {
            if (state.cart.length === 0) {
                showToast('Please add items to your cart before proceeding', 'info');
                return;
            }

            checkoutBtn.disabled = true;
            checkoutBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> CREATING CHECKOUT...';

            showToast('Connecting to secure Stripe Checkout...', 'info');

            try {
                const response = await fetch(WORKER_API_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ items: state.cart })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || `Server returned status ${response.status}`);
                }

                if (data.url) {
                    window.location.href = data.url;
                } else {
                    throw new Error('No checkout URL returned from server.');
                }
            } catch (error) {
                console.error('Checkout error:', error);
                showToast('Checkout failed: ' + error.message, 'info');
                
                checkoutBtn.disabled = false;
                checkoutBtn.innerHTML = '<i class="fa-solid fa-lock"></i> <span>PROCEED TO STRIPE CHECKOUT</span>';
            }
        });
    }

    // Custom Order Form Handler
    const customOrderForm = document.getElementById('custom-order-form');
    if (customOrderForm) {
        customOrderForm.addEventListener('submit', (e) => {
            e.preventDefault();
            showToast('Custom loader request submitted successfully!', 'success');
            e.target.reset();
        });
    }
});
