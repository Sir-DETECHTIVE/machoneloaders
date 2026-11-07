// =================================================================
// MACH ONE LOADERS — STOREFRONT (v3)
// All products, add-ons, deals, photos and videos come from Stripe
// through the Cloudflare Worker.
// =================================================================

// 1. CONFIG & STATE
const API_URL = 'https://mach-one-api.jaythedetechtive.workers.dev';
const CART_KEY = 'machone-cart';
const ROUTES = ['home', 'catalog', 'finder', 'instructions', 'bulk'];

const state = {
    products: [],
    loaded: false,
    loadError: false,
    cart: loadCart(),
    catalogBrand: 'all',
    catalogQuery: '',
    finderBrand: '',
    finderModel: '',
    instructionsQuery: '',
};

// =================================================================
// 2. HELPERS
// =================================================================
function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

const money = value => `$${Number(value || 0).toFixed(2)}`;
const page = () => document.getElementById('page');

function loadCart() {
    try {
        return JSON.parse(localStorage.getItem(CART_KEY)) || [];
    } catch {
        return [];
    }
}

function saveCart() {
    try {
        localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
    } catch {
        // Storage unavailable; the cart still works for this visit
    }
}

// Product groups, all driven by Stripe metadata "type" and "parent"
const mainProducts = () => state.products.filter(p => p.type === 'product');
const addonsFor = id => state.products.filter(p => p.type === 'addon' && p.parent === id);
const dealsFor = id => state.products.filter(p => p.type === 'deal' && p.parent === id);
const findProduct = id => state.products.find(p => p.id === id);
const brandsOf = list => [...new Set(list.map(p => p.brand))].sort();

function matchesSearch(product, query) {
    return [product.name, product.brand, product.model, product.description, product.keywords]
        .some(value => (value || '').toLowerCase().includes(query));
}

function youtubeId(url) {
    const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    return match ? match[1] : null;
}

function videoEmbed(url) {
    const id = youtubeId(url);
    if (id) {
        return `
            <div class="aspect-video w-full bg-black rounded overflow-hidden">
                <iframe class="w-full h-full" src="https://www.youtube-nocookie.com/embed/${id}"
                    title="Product video" loading="lazy" allowfullscreen
                    referrerpolicy="strict-origin-when-cross-origin"></iframe>
            </div>`;
    }
    if (/^https?:\/\//.test(url)) {
        return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener"
            class="inline-flex items-center space-x-2 bg-gunpost-slate hover:bg-gunpost-navy text-white text-xs font-bold px-4 py-2 rounded">
            <i class="fa-solid fa-play"></i><span>WATCH VIDEO</span></a>`;
    }
    return '';
}

function productImage(product, heightClass = 'h-44') {
    if (product.images[0]) {
        return `<img src="${escapeHtml(product.images[0])}" alt="${escapeHtml(product.name)}"
            class="w-full ${heightClass} object-contain bg-white">`;
    }
    return `<div class="w-full ${heightClass} bg-slate-100 flex items-center justify-center text-slate-300">
        <i class="fa-solid fa-image text-4xl"></i></div>`;
}

function notice(icon, iconClass, title, text) {
    return `
        <div class="bg-white border border-gunpost-border p-8 text-center rounded">
            <i class="fa-solid ${icon} ${iconClass} text-3xl mb-2"></i>
            <div class="text-sm font-bold text-gunpost-textDark">${title}</div>
            <div class="text-xs text-gunpost-textMuted mt-1">${text}</div>
        </div>`;
}

// =================================================================
// 3. PRODUCT CARDS
// =================================================================
function productCard(p) {
    const inStock = p.inStock;
    return `
        <div class="gp-card rounded flex flex-col overflow-hidden">
            <button data-open="${escapeHtml(p.id)}" class="text-left flex-grow">
                ${productImage(p)}
                <div class="p-4">
                    <div class="flex justify-between items-center mb-2 text-[11px]">
                        <span class="bg-gunpost-slate text-white px-2 py-0.5 rounded font-bold">${escapeHtml(p.brand)}</span>
                        <span class="${inStock ? 'text-gunpost-green' : 'text-red-600'} font-semibold">
                            <i class="fa-solid fa-circle text-[8px] mr-1"></i>${inStock ? 'In Stock' : 'Out of Stock'}
                        </span>
                    </div>
                    ${p.promo ? `<div class="text-[11px] font-bold text-gunpost-accent mb-1">${escapeHtml(p.promo)}</div>` : ''}
                    <h3 class="text-sm font-bold text-gunpost-textDark mb-1">${escapeHtml(p.name)}</h3>
                    ${p.model ? `<div class="text-[11px] text-gunpost-textMuted mb-1">Model: ${escapeHtml(p.model)}</div>` : ''}
                    <div class="text-base font-bold text-gunpost-green">${money(p.price)} <span class="text-xs text-slate-500 font-normal">CAD</span></div>
                </div>
            </button>
            <div class="px-4 pb-4">
                <button data-add="${escapeHtml(p.id)}" ${inStock ? '' : 'disabled'}
                    class="w-full bg-gunpost-green hover:bg-gunpost-greenHover disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-xs py-2 rounded transition-colors">
                    ${inStock ? 'ADD TO CART' : 'UNAVAILABLE'}
                </button>
            </div>
        </div>`;
}

const cardGrid = (list, cols = 'md:grid-cols-2 lg:grid-cols-3') =>
    `<div class="grid grid-cols-1 ${cols} gap-4">${list.map(productCard).join('')}</div>`;

function sectionTitle(title, subtitle = '') {
    return `
        <div class="mb-4">
            <h2 class="text-sm font-bold text-gunpost-textDark uppercase tracking-wider flex items-center">
                <i class="fa-solid fa-star text-gunpost-green mr-2"></i>${title}
            </h2>
            ${subtitle ? `<p class="text-xs text-gunpost-textMuted mt-1">${subtitle}</p>` : ''}
        </div>`;
}

// =================================================================
// 4. ROUTING & PAGE LOADING
// =================================================================
function currentRoute() {
    const r = location.hash.replace('#', '') || 'home';
    return ROUTES.includes(r) ? r : 'home';
}

function route() {
    const r = currentRoute();
    document.querySelectorAll('.nav-link').forEach(a => {
        const active = a.dataset.nav === r;
        a.classList.toggle('bg-gunpost-navy', active);
        a.classList.toggle('text-white', active);
    });

    if (state.loadError) {
        page().innerHTML = notice('fa-circle-exclamation', 'text-red-500', 'Unable to load the store',
            'Please refresh the page. If the problem continues, contact sales@machoneloaders.ca.');
        return;
    }
    if (!state.loaded) {
        page().innerHTML = notice('fa-spinner fa-spin', 'text-gunpost-slate', 'Loading...',
            'Fetching the live catalog from Stripe.');
        return;
    }

    const renderers = { home: renderHome, catalog: renderCatalog, finder: renderFinder,
        instructions: renderInstructions, bulk: renderBulk };
    renderers[r]();
    window.scrollTo(0, 0);
}

async function loadCatalog() {
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        state.products = await response.json();
        state.loaded = true;
    } catch (error) {
        console.error('Failed to load catalog:', error);
        state.loadError = true;
    }
    route();
}

// Jump to the catalog with a brand or search applied
function goCatalog(brand = 'all', query = '') {
    state.catalogBrand = brand;
    state.catalogQuery = query;
    if (location.hash === '#catalog') {
        route();
    } else {
        location.hash = 'catalog';
    }
}

// =================================================================
// 5. HOME PAGE
// =================================================================
function renderHome() {
    const items = mainProducts();
    const promos = items.filter(p => p.promo);
    const featured = items.filter(p => p.featured);
    const popular = (featured.length ? featured : items).slice(0, 4);
    const brands = brandsOf(items);

    page().innerHTML = `
        <section class="bg-gunpost-navy text-white rounded p-8 md:p-12 mb-8 shadow">
            <div class="max-w-2xl space-y-4">
                <span class="bg-gunpost-green text-white text-[10px] font-bold px-2 py-0.5 rounded">MADE IN ONTARIO</span>
                <h1 class="text-3xl md:text-4xl font-bold leading-tight">Faster reloads. Built in Canada.</h1>
                <p class="text-sm text-slate-300">
                    Precision polymer speed loaders and firearm accessories for Canadian range shooters.
                    CAD pricing, secure Stripe checkout, and tracked shipping across Canada.
                </p>
                <div class="flex flex-wrap gap-3 pt-2">
                    <a href="#catalog" class="bg-gunpost-green hover:bg-gunpost-greenHover text-white font-bold text-xs px-5 py-2.5 rounded">SHOP THE CATALOG</a>
                    <a href="#finder" class="bg-white/10 hover:bg-white/20 text-white font-bold text-xs px-5 py-2.5 rounded border border-white/20">FIND MY MODEL</a>
                </div>
            </div>
        </section>

        ${promos.length ? `
            <section class="mb-10">
                ${sectionTitle('Current Promotions', 'Limited-time offers on Canadian-made loaders.')}
                ${cardGrid(promos)}
            </section>` : ''}

        ${popular.length ? `
            <section class="mb-10">
                ${sectionTitle('Popular Products', 'Our most-ordered loaders and accessories.')}
                ${cardGrid(popular)}
            </section>` : `
            <section class="mb-10">${notice('fa-box-open', 'text-slate-300', 'No products yet', 'Products you add in Stripe will appear here.')}</section>`}

        ${brands.length ? `
            <section class="mb-10">
                ${sectionTitle('Shop by Brand')}
                <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                    ${brands.map(b => `
                        <button data-brand-tile="${escapeHtml(b)}"
                            class="bg-white border border-gunpost-border hover:border-gunpost-slate rounded p-4 text-left shadow-sm transition-colors">
                            <div class="text-sm font-bold text-gunpost-textDark">${escapeHtml(b)}</div>
                            <div class="text-[11px] text-gunpost-textMuted">${items.filter(p => p.brand === b).length} products</div>
                        </button>`).join('')}
                </div>
            </section>` : ''}

        <section class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10 text-xs">
            <div class="bg-white border border-gunpost-border rounded p-4">
                <i class="fa-solid fa-flag-canada text-gunpost-green text-lg mb-2"></i>
                <div class="font-bold text-gunpost-textDark">Made in Ontario</div>
                <p class="text-gunpost-textMuted mt-1">Designed and assembled in our Ontario workshop.</p>
            </div>
            <div class="bg-white border border-gunpost-border rounded p-4">
                <i class="fa-solid fa-lock text-gunpost-green text-lg mb-2"></i>
                <div class="font-bold text-gunpost-textDark">Secure checkout</div>
                <p class="text-gunpost-textMuted mt-1">Payments are handled by Stripe. We never see your card details.</p>
            </div>
            <div class="bg-white border border-gunpost-border rounded p-4">
                <i class="fa-solid fa-truck text-gunpost-green text-lg mb-2"></i>
                <div class="font-bold text-gunpost-textDark">Tracked shipping</div>
                <p class="text-gunpost-textMuted mt-1">Shipped across Canada with tracking. See Legal Information for details.</p>
            </div>
        </section>

        <section class="bg-white border border-gunpost-border rounded p-6 flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
                <div class="text-base font-bold text-gunpost-textDark">Buying for a range or a team?</div>
                <p class="text-xs text-gunpost-textMuted mt-1">Ask about bulk pricing and we'll reply by email.</p>
            </div>
            <a href="#bulk" class="bg-gunpost-green hover:bg-gunpost-greenHover text-white font-bold text-xs px-5 py-2.5 rounded whitespace-nowrap">REQUEST BULK PRICING</a>
        </section>`;
}

// =================================================================
// 6. CATALOG PAGE
// =================================================================
function brandButton(value, label) {
    const active = state.catalogBrand === value;
    return `<button data-brand-filter="${escapeHtml(value)}"
        class="${active
            ? 'bg-gunpost-slate text-white border-slate-700 font-bold'
            : 'bg-slate-100 text-gunpost-textDark hover:bg-slate-200 border-slate-300 font-medium'} px-3 py-1.5 rounded border text-xs">
        ${escapeHtml(label)}</button>`;
}

function renderCatalog() {
    const brands = brandsOf(mainProducts());

    page().innerHTML = `
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
            <h1 class="text-lg font-bold text-gunpost-textDark">CATALOG</h1>
            <input id="catalog-search" type="search" value="${escapeHtml(state.catalogQuery)}"
                placeholder="Search by name, brand, or model"
                class="w-full md:w-80 bg-white border border-slate-300 p-2 rounded text-xs focus:outline-none focus:border-gunpost-slate">
        </div>
        <div class="flex flex-wrap gap-2 mb-4">
            ${brandButton('all', 'All Brands')}
            ${brands.map(b => brandButton(b, b)).join('')}
        </div>
        <div id="catalog-count" class="text-xs text-gunpost-textMuted mb-3"></div>
        <div id="catalog-grid"></div>`;

    document.getElementById('catalog-search').addEventListener('input', e => {
        state.catalogQuery = e.target.value;
        renderCatalogGrid();
    });
    renderCatalogGrid();
}

function renderCatalogGrid() {
    const query = state.catalogQuery.trim().toLowerCase();
    let list = mainProducts();
    if (state.catalogBrand !== 'all') list = list.filter(p => p.brand === state.catalogBrand);
    if (query) list = list.filter(p => matchesSearch(p, query));

    document.getElementById('catalog-count').innerHTML =
        `<span class="font-bold text-gunpost-textDark">${list.length}</span> listing${list.length === 1 ? '' : 's'}`;

    document.getElementById('catalog-grid').innerHTML = list.length
        ? cardGrid(list)
        : notice('fa-magnifying-glass', 'text-slate-300', 'No products match',
            'Try a different search or choose another brand.');
}

// =================================================================
// 7. MODEL FINDER (brand = metadata key, model = metadata value)
// =================================================================
function renderFinder() {
    const items = mainProducts();
    const brands = brandsOf(items);
    const models = state.finderBrand
        ? [...new Set(items.filter(p => p.brand === state.finderBrand).map(p => p.model).filter(Boolean))].sort()
        : [];

    let results = '';
    if (state.finderBrand) {
        let list = items.filter(p => p.brand === state.finderBrand);
        if (state.finderModel) list = list.filter(p => p.model === state.finderModel);
        results = list.length
            ? cardGrid(list)
            : notice('fa-magnifying-glass', 'text-slate-300', 'No match yet', 'No loaders are listed for that model.');
    }

    page().innerHTML = `
        <h1 class="text-lg font-bold text-gunpost-textDark mb-1">MODEL FINDER</h1>
        <p class="text-xs text-gunpost-textMuted mb-6">Choose your make and model to see the loaders built for it.</p>

        <div class="bg-white border border-gunpost-border rounded p-5 grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 text-xs">
            <label class="block">
                <span class="block font-bold text-gunpost-textDark mb-1">Make (brand)</span>
                <select id="finder-brand" class="w-full bg-white border border-slate-300 p-2 rounded">
                    <option value="">Select a make</option>
                    ${brands.map(b => `<option value="${escapeHtml(b)}" ${b === state.finderBrand ? 'selected' : ''}>${escapeHtml(b)}</option>`).join('')}
                </select>
            </label>
            <label class="block">
                <span class="block font-bold text-gunpost-textDark mb-1">Model</span>
                <select id="finder-model" class="w-full bg-white border border-slate-300 p-2 rounded" ${models.length ? '' : 'disabled'}>
                    <option value="">All models</option>
                    ${models.map(m => `<option value="${escapeHtml(m)}" ${m === state.finderModel ? 'selected' : ''}>${escapeHtml(m)}</option>`).join('')}
                </select>
            </label>
        </div>

        <div>${results || notice('fa-gun', 'text-slate-300', 'Start with your make', 'Pick a make above and we will show every loader that fits it.')}</div>`;

    document.getElementById('finder-brand').addEventListener('change', e => {
        state.finderBrand = e.target.value;
        state.finderModel = '';
        renderFinder();
    });
    document.getElementById('finder-model').addEventListener('change', e => {
        state.finderModel = e.target.value;
        renderFinder();
    });
}

// =================================================================
// 8. PRODUCT INSTRUCTIONS (videos with search)
// =================================================================
function renderInstructions() {
    page().innerHTML = `
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
            <div>
                <h1 class="text-lg font-bold text-gunpost-textDark">PRODUCT INSTRUCTIONS</h1>
                <p class="text-xs text-gunpost-textMuted mt-1">Setup and loading videos for each product.</p>
            </div>
            <input id="instructions-search" type="search" value="${escapeHtml(state.instructionsQuery)}"
                placeholder="Search by product, brand, or model"
                class="w-full md:w-80 bg-white border border-slate-300 p-2 rounded text-xs focus:outline-none focus:border-gunpost-slate">
        </div>
        <div id="instructions-list" class="space-y-6"></div>`;

    document.getElementById('instructions-search').addEventListener('input', e => {
        state.instructionsQuery = e.target.value;
        renderInstructionsList();
    });
    renderInstructionsList();
}

function renderInstructionsList() {
    const query = state.instructionsQuery.trim().toLowerCase();
    const list = mainProducts()
        .filter(p => p.video)
        .filter(p => !query || matchesSearch(p, query));

    document.getElementById('instructions-list').innerHTML = list.length
        ? list.map(p => `
            <div class="bg-white border border-gunpost-border rounded p-4 shadow-sm">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <div>
                        <div class="text-sm font-bold text-gunpost-textDark">${escapeHtml(p.name)}</div>
                        <div class="text-[11px] text-gunpost-textMuted">${escapeHtml(p.brand)}${p.model ? ' · ' + escapeHtml(p.model) : ''}</div>
                    </div>
                    <button data-open="${escapeHtml(p.id)}" class="text-xs font-bold text-gunpost-slate hover:text-gunpost-navy underline">VIEW PRODUCT</button>
                </div>
                ${videoEmbed(p.video)}
            </div>`).join('')
        : notice('fa-circle-play', 'text-slate-300', 'No videos found',
            query ? 'Try a different search.' : 'Instruction videos will appear here once they are added in Stripe.');
}

// =================================================================
// 9. BULK ORDERS
// =================================================================
function renderBulk() {
    const productOptions = mainProducts()
        .map(p => `<option value="${escapeHtml(p.name)}">${escapeHtml(p.brand)} · ${escapeHtml(p.name)}</option>`)
        .join('');

    page().innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div class="lg:col-span-5 space-y-4">
                <h1 class="text-lg font-bold text-gunpost-textDark">BULK ORDERS</h1>
                <p class="text-xs text-gunpost-textMuted leading-relaxed">
                    Buying for a range, club, or business? Tell us what you need and we'll reply by email
                    with bulk pricing and availability.
                </p>
                <div class="text-xs space-y-2 text-gunpost-green font-medium">
                    <div><i class="fa-solid fa-circle-check mr-2"></i>Volume pricing for clubs and businesses</div>
                    <div><i class="fa-solid fa-circle-check mr-2"></i>Custom quantities and mixed orders</div>
                    <div><i class="fa-solid fa-circle-check mr-2"></i>Reply within 2 business days</div>
                </div>
            </div>

            <form id="bulk-form" class="lg:col-span-7 bg-white border border-gunpost-border rounded p-6 space-y-4 text-xs">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label class="block">
                        <span class="block font-bold text-gunpost-textDark mb-1">Name <span class="text-gunpost-accent">*</span></span>
                        <input name="name" type="text" required autocomplete="name" class="w-full bg-white border border-slate-300 p-2 rounded focus:outline-none focus:border-gunpost-slate">
                    </label>
                    <label class="block">
                        <span class="block font-bold text-gunpost-textDark mb-1">Business Name (if applicable)</span>
                        <input name="business" type="text" autocomplete="organization" class="w-full bg-white border border-slate-300 p-2 rounded focus:outline-none focus:border-gunpost-slate">
                    </label>
                    <label class="block">
                        <span class="block font-bold text-gunpost-textDark mb-1">Email <span class="text-gunpost-accent">*</span></span>
                        <input name="email" type="email" required autocomplete="email" class="w-full bg-white border border-slate-300 p-2 rounded focus:outline-none focus:border-gunpost-slate">
                    </label>
                    <label class="block">
                        <span class="block font-bold text-gunpost-textDark mb-1">Phone Number (optional)</span>
                        <input name="phone" type="tel" autocomplete="tel" class="w-full bg-white border border-slate-300 p-2 rounded focus:outline-none focus:border-gunpost-slate">
                    </label>
                </div>
                <label class="block">
                    <span class="block font-bold text-gunpost-textDark mb-1">Product Interested In <span class="text-gunpost-accent">*</span></span>
                    <select name="product" required class="w-full bg-white border border-slate-300 p-2 rounded">
                        <option value="">Select a product</option>
                        ${productOptions}
                        <option value="Other / not listed">Other / not listed</option>
                    </select>
                </label>
                <label class="block">
                    <span class="block font-bold text-gunpost-textDark mb-1">Message <span class="text-gunpost-accent">*</span></span>
                    <textarea name="message" required rows="5" placeholder="Quantities, timing, delivery city, and anything else we should know."
                        class="w-full bg-white border border-slate-300 p-2 rounded focus:outline-none focus:border-gunpost-slate"></textarea>
                </label>

                <!-- Honeypot: hidden from people, filled in only by bots -->
                <div class="hidden" aria-hidden="true">
                    <label>Leave this field empty
                        <input name="website" type="text" tabindex="-1" autocomplete="off">
                    </label>
                </div>

                <button id="bulk-submit" type="submit"
                    class="w-full bg-gunpost-green hover:bg-gunpost-greenHover text-white font-bold text-xs px-5 py-2.5 rounded transition-colors">
                    SEND BULK ORDER INQUIRY
                </button>
            </form>
        </div>`;

    document.getElementById('bulk-form').addEventListener('submit', submitBulk);
}

async function submitBulk(e) {
    e.preventDefault();
    const form = e.target;
    const button = document.getElementById('bulk-submit');
    const data = Object.fromEntries(new FormData(form).entries());

    button.disabled = true;
    button.textContent = 'SENDING...';

    try {
        const response = await fetch(`${API_URL}/bulk-order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || `Error ${response.status}`);

        form.reset();
        showToast('Thanks! Your bulk order inquiry was sent. We will reply by email.', 'success', 7000);
    } catch (error) {
        console.error('Bulk order error:', error);
        showToast(`Could not send your inquiry: ${error.message}`, 'error', 8000);
    } finally {
        button.disabled = false;
        button.textContent = 'SEND BULK ORDER INQUIRY';
    }
}

// =================================================================
// 10. PRODUCT WINDOW (photos, add-ons, deals)
// =================================================================
function openProduct(id) {
    const p = findProduct(id);
    if (!p) return;

    const addons = addonsFor(id);
    const deals = dealsFor(id);

    const gallery = p.images.length
        ? `<img id="pm-main" src="${escapeHtml(p.images[0])}" alt="${escapeHtml(p.name)}" class="w-full h-80 object-contain bg-white rounded">
           ${p.images.length > 1 ? `
           <div class="flex gap-2 mt-3 overflow-x-auto">
               ${p.images.map(src => `
                   <button data-thumb="${escapeHtml(src)}" class="w-16 h-16 flex-shrink-0 border border-gunpost-border rounded overflow-hidden">
                       <img src="${escapeHtml(src)}" alt="" class="w-full h-full object-cover">
                   </button>`).join('')}
           </div>` : ''}`
        : `<div class="w-full h-80 bg-slate-100 rounded flex items-center justify-center text-slate-300">
               <i class="fa-solid fa-image text-6xl"></i></div>`;

    const miniCard = (item, label) => `
        <div class="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded p-3">
            ${item.images[0]
                ? `<img src="${escapeHtml(item.images[0])}" alt="" class="w-14 h-14 object-cover rounded bg-white">`
                : `<div class="w-14 h-14 rounded bg-slate-100 flex items-center justify-center text-slate-300"><i class="fa-solid fa-image"></i></div>`}
            <div class="flex-grow">
                <div class="text-xs font-bold text-gunpost-textDark">${escapeHtml(item.name)}</div>
                <div class="text-[11px] text-gunpost-textMuted">${label}</div>
            </div>
            <div class="text-right">
                <div class="text-sm font-bold text-gunpost-green">${money(item.price)}</div>
                <button data-add="${escapeHtml(item.id)}" ${item.inStock ? '' : 'disabled'}
                    class="mt-1 bg-gunpost-green hover:bg-gunpost-greenHover disabled:bg-slate-300 text-white text-[11px] font-bold px-3 py-1 rounded">
                    ${item.inStock ? 'ADD' : 'UNAVAILABLE'}</button>
            </div>
        </div>`;

    document.getElementById('product-modal-body').innerHTML = `
        <button data-close-modal class="absolute top-3 right-3 z-10 bg-white/90 hover:bg-white text-gunpost-textDark w-9 h-9 rounded-full shadow flex items-center justify-center" aria-label="Close">
            <i class="fa-solid fa-xmark"></i>
        </button>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
            <div>${gallery}</div>
            <div class="space-y-4 text-xs">
                <div class="flex items-center gap-2">
                    <span class="bg-gunpost-slate text-white px-2 py-0.5 rounded font-bold">${escapeHtml(p.brand)}</span>
                    <span class="${p.inStock ? 'text-gunpost-green' : 'text-red-600'} font-semibold">
                        <i class="fa-solid fa-circle text-[8px] mr-1"></i>${p.inStock ? 'In Stock' : 'Out of Stock'}</span>
                </div>
                <h2 class="text-xl font-bold text-gunpost-textDark">${escapeHtml(p.name)}</h2>
                ${p.model ? `<div class="text-gunpost-textMuted">Model: <span class="font-bold text-gunpost-textDark">${escapeHtml(p.model)}</span></div>` : ''}
                <div class="text-2xl font-bold text-gunpost-green">${money(p.price)} <span class="text-xs text-slate-500 font-normal">CAD</span></div>
                ${p.promo ? `<div class="font-bold text-gunpost-accent">${escapeHtml(p.promo)}</div>` : ''}
                <p class="text-gunpost-textMuted leading-relaxed">${escapeHtml(p.description || 'No description provided.')}</p>
                <button data-add="${escapeHtml(p.id)}" ${p.inStock ? '' : 'disabled'}
                    class="w-full bg-gunpost-green hover:bg-gunpost-greenHover disabled:bg-slate-300 text-white font-bold py-3 rounded transition-colors">
                    ${p.inStock ? 'ADD TO CART' : 'UNAVAILABLE'}
                </button>
            </div>
        </div>

        ${deals.length ? `
            <div class="border-t border-gunpost-border p-6 space-y-3">
                <h3 class="text-sm font-bold text-gunpost-textDark uppercase tracking-wider">Bundle Deals</h3>
                ${deals.map(d => miniCard(d, 'Bundle deal')).join('')}
            </div>` : ''}

        ${addons.length ? `
            <div class="border-t border-gunpost-border p-6 space-y-3">
                <h3 class="text-sm font-bold text-gunpost-textDark uppercase tracking-wider">Add-ons</h3>
                ${addons.map(a => miniCard(a, 'Add-on')).join('')}
            </div>` : ''}`;

    document.getElementById('product-modal').classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
}

function closeProduct() {
    document.getElementById('product-modal').classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
}

// =================================================================
// 11. CART
// =================================================================
function addToCart(productId) {
    const product = findProduct(productId);
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
            quantity: 1,
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

function renderCart() {
    const container = document.getElementById('cart-items-container');
    if (!container) return;

    const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = state.cart.reduce((sum, item) => sum + parseFloat(item.price) * item.quantity, 0);

    document.getElementById('cart-counter').textContent = count;
    document.getElementById('cart-subtotal').textContent = `${money(subtotal)} CAD`;
    document.getElementById('cart-total').textContent = `${money(subtotal)} CAD`;

    saveCart();

    if (state.cart.length === 0) {
        container.innerHTML = `
            <div class="h-64 flex flex-col items-center justify-center text-center p-4">
                <i class="fa-solid fa-cart-flatbed text-slate-300 text-4xl mb-2"></i>
                <div class="text-xs font-bold text-gunpost-textDark">Your cart is empty</div>
                <div class="text-[11px] text-slate-400 mt-1">Add loaders and accessories from the catalog.</div>
            </div>`;
        return;
    }

    container.innerHTML = state.cart.map(item => `
        <div class="bg-slate-50 border border-slate-200 p-3 rounded flex items-center justify-between text-xs">
            <div class="flex-grow pr-2">
                <div class="font-bold text-gunpost-textDark">${escapeHtml(item.name)}</div>
                <div class="text-gunpost-green font-bold mt-0.5">${money(item.price)} CAD</div>
                <div class="flex items-center space-x-2 mt-2">
                    <button data-qty="${escapeHtml(item.id)}" data-delta="-1" class="w-6 h-6 bg-white border border-slate-300 rounded font-bold hover:bg-slate-100">-</button>
                    <span class="font-bold text-gunpost-textDark">${item.quantity}</span>
                    <button data-qty="${escapeHtml(item.id)}" data-delta="1" class="w-6 h-6 bg-white border border-slate-300 rounded font-bold hover:bg-slate-100">+</button>
                </div>
            </div>
            <button data-remove="${escapeHtml(item.id)}" class="text-slate-400 hover:text-red-600 p-1" aria-label="Remove item">
                <i class="fa-solid fa-trash-can text-sm"></i>
            </button>
        </div>`).join('');
}

function setupCart() {
    const drawer = document.getElementById('cart-drawer');
    const backdrop = document.getElementById('cart-drawer-backdrop');

    const openCart = () => {
        drawer.classList.remove('translate-x-full');
        backdrop.classList.remove('opacity-0', 'pointer-events-none');
    };
    const closeCart = () => {
        drawer.classList.add('translate-x-full');
        backdrop.classList.add('opacity-0', 'pointer-events-none');
    };

    document.getElementById('cart-toggle-btn').addEventListener('click', openCart);
    document.getElementById('cart-close-btn').addEventListener('click', closeCart);
    backdrop.addEventListener('click', closeCart);
    window.closeCart = closeCart;
}

// =================================================================
// 12. CHECKOUT
// =================================================================
function setupCheckout() {
    const button = document.getElementById('checkout-btn');
    const resetButton = () => {
        button.disabled = false;
        button.innerHTML = '<i class="fa-solid fa-lock"></i> <span>PROCEED TO STRIPE CHECKOUT</span>';
    };

    button.addEventListener('click', async () => {
        if (state.cart.length === 0) {
            showToast('Add items to your cart before checking out.', 'info');
            return;
        }

        button.disabled = true;
        button.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> CREATING CHECKOUT...';
        showToast('Connecting to secure Stripe Checkout...', 'info');

        try {
            const items = state.cart.map(({ id, name, priceId, quantity }) => ({ id, name, priceId, quantity }));

            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items }),
            });
            const data = await response.json();

            if (!response.ok) throw new Error(data.error || `Server returned status ${response.status}`);
            if (!data.url) throw new Error('No checkout link was returned.');

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
    const status = new URLSearchParams(location.search).get('status');

    if (status === 'success') {
        state.cart = [];
        renderCart();
        showToast('Payment received. Thank you for your order!', 'success', 8000);
    } else if (status === 'cancel') {
        showToast('Checkout cancelled. Your cart has been kept.', 'info', 6000);
    }

    if (status) history.replaceState({}, '', location.pathname + location.hash);
}

// =================================================================
// 13. TOASTS
// =================================================================
function showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container');
    const icons = {
        success: 'fa-circle-check text-green-400',
        error: 'fa-circle-exclamation text-red-400',
        info: 'fa-circle-info text-blue-400',
    };

    const toast = document.createElement('div');
    toast.className = 'pointer-events-auto bg-gunpost-navy text-white border-l-4 border-gunpost-green px-4 py-2.5 text-xs font-medium shadow-lg flex items-center space-x-2 transition-all transform translate-y-2 opacity-0';
    toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i><span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => toast.classList.remove('translate-y-2', 'opacity-0'), 10);
    setTimeout(() => {
        toast.classList.add('opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// =================================================================
// 14. EVENTS (delegated, so dynamically rendered buttons work)
// =================================================================
document.addEventListener('click', e => {
    const t = e.target;

    const add = t.closest('[data-add]');
    if (add) return addToCart(add.dataset.add);

    const open = t.closest('[data-open]');
    if (open) return openProduct(open.dataset.open);

    const brandFilter = t.closest('[data-brand-filter]');
    if (brandFilter) {
        state.catalogBrand = brandFilter.dataset.brandFilter;
        return renderCatalog();
    }

    const tile = t.closest('[data-brand-tile]');
    if (tile) return goCatalog(tile.dataset.brandTile);

    const thumb = t.closest('[data-thumb]');
    if (thumb) {
        document.getElementById('pm-main').src = thumb.dataset.thumb;
        return;
    }

    if (t.closest('[data-close-modal]') || t.id === 'product-modal') return closeProduct();

    const qty = t.closest('[data-qty]');
    if (qty) return updateQuantity(qty.dataset.qty, Number(qty.dataset.delta));

    const remove = t.closest('[data-remove]');
    if (remove) return removeFromCart(remove.dataset.remove);
});

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        closeProduct();
        if (window.closeCart) window.closeCart();
    }
});

// =================================================================
// 15. INIT
// =================================================================
document.addEventListener('DOMContentLoaded', () => {
    setupCart();
    setupCheckout();
    renderCart();
    handleCheckoutReturn();

    document.getElementById('header-search').addEventListener('submit', e => {
        e.preventDefault();
        goCatalog('all', document.getElementById('header-search-input').value.trim());
    });

    window.addEventListener('hashchange', route);
    route();
    loadCatalog();
});
