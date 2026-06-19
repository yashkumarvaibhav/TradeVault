/* ═══════════════════════════════════════════════════════════════
   TradeVault – Dashboard Application JavaScript (v2)
   ═══════════════════════════════════════════════════════════════ */

const CATEGORIES = {
    'Equity':    { subcategories: ['Small Cap', 'Mid Cap', 'Large Cap'], styles: ['Intraday', 'Swing', 'Positional'] },
    'Index':     { subcategories: ['Nifty', 'Bank Nifty'],              styles: ['Intraday', 'Swing', 'Positional'] },
    'Forex':     { subcategories: [],                                    styles: ['Intraday', 'Swing', 'Scalp', 'Positional'] },
    'Commodity': { subcategories: [],                                    styles: ['Intraday', 'Swing'] },
    'US Index':  { subcategories: [],                                    styles: ['Intraday', 'Swing'] }
};

const CURRENCY_SYMBOLS = { 'INR': '₹', 'USD': '$' };
const STANDARD_PRICE_STEP = '0.01';
const FOREX_PRICE_STEP = 'any';
const CSRF_TOKEN = window.TRADEVAULT_CSRF_TOKEN || document.querySelector('meta[name="csrf-token"]')?.content || '';

let userInstruments = [];
let selectedInstrument = null;
let userCloseReasons = [];
let userStrategies = [];
let userPlaybooks = [];
let overviewCategory = '';       // current overview tab

function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
}

function optionHTML(value, label = value) {
    return `<option value="${escapeHTML(value)}">${escapeHTML(label)}</option>`;
}

function formatPrice(value, category = '') {
    const num = parseFloat(value);
    if (!Number.isFinite(num)) return '—';
    return num.toFixed(category === 'Forex' ? 5 : 2);
}

function formatPnl(trade) {
    if (trade.status !== 'closed' || trade.computed_pnl === null || trade.computed_pnl === undefined) {
        return { value: '—', className: '' };
    }
    const pnl = parseFloat(trade.computed_pnl);
    const sym = CURRENCY_SYMBOLS[trade.currency] || `${escapeHTML(trade.currency || '')} `;
    return {
        value: `${pnl >= 0 ? '+' : ''}${sym}${pnl.toFixed(2)}`,
        className: pnl >= 0 ? 'pnl-positive' : 'pnl-negative'
    };
}

function formatPositionSize(trade) {
    const size = parseFloat(trade.position_size);
    const effective = parseFloat(trade.effective_units);
    const lotSize = parseFloat(trade.lot_size);
    if (Number.isFinite(size) && Number.isFinite(effective) && Number.isFinite(lotSize) && lotSize > 0 && effective !== size) {
        return `${size.toLocaleString()} lots (${effective.toLocaleString()} units)`;
    }
    return escapeHTML(trade.position_size ?? '—');
}

function formatReviewBadge(trade) {
    if (trade.status !== 'closed') {
        return '<span class="badge review-badge review-open">Open</span>';
    }
    if (trade.reviewed) {
        return '<span class="badge review-badge review-complete">Reviewed</span>';
    }
    return '<span class="badge review-badge review-pending">Pending</span>';
}

function formatCurrencyAmount(currency, value) {
    const num = Number(value || 0);
    const symbol = CURRENCY_SYMBOLS[currency] || `${currency || ''} `;
    return `${symbol}${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatRatio(value) {
    return value === null || value === undefined ? '—' : value;
}

// ─── View Management ─────────────────────────────────────────

const VIEW_SLUGS = {
    'overview': 'overview', 'trades': 'trades', 'open-trades': 'open-trades',
    'review-center': 'review-center', 'playbooks': 'playbooks', 'add-trade': 'add-trade',
    'analytics': 'analytics', 'international': 'international', 'export-import': 'export-import'
};
const VIEW_TITLES = {
    'overview': 'Overview', 'trades': 'My Trades', 'open-trades': 'Open Trades',
    'review-center': 'Review Center', 'playbooks': 'Playbooks', 'add-trade': 'Add Trade',
    'analytics': 'Analytics', 'international': 'International Trades', 'export-import': 'Export / Import'
};

function showView(viewName, pushState = true) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const view = document.getElementById(`view-${viewName}`);
    if (view) view.classList.add('active');

    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navItem = document.querySelector(`.nav-item[data-view="${viewName}"]`);
    if (navItem) navItem.classList.add('active');

    document.getElementById('pageTitle').textContent = VIEW_TITLES[viewName] || 'Dashboard';

    // Update browser URL
    if (pushState && VIEW_SLUGS[viewName]) {
        const newUrl = BASE + '/dashboard/' + VIEW_SLUGS[viewName];
        if (window.location.pathname !== newUrl) {
            history.pushState({ view: viewName }, '', newUrl);
        }
    }

    if (viewName === 'overview') loadOverview();
    if (viewName === 'trades') { populateDynamicFilters(); loadTrades(); }
    if (viewName === 'open-trades') { populateDynamicFilters(); loadOpenTrades(); }
    if (viewName === 'review-center') loadReviewCenter();
    if (viewName === 'playbooks') loadPlaybooksView();
    if (viewName === 'add-trade') { loadInstruments(); loadPlaybooks(); }
    if (viewName === 'analytics') { populateDynamicFilters(); loadAnalytics(); }
    if (viewName === 'international') loadInternationalTrades();
    if (viewName === 'export-import') setupImportUI();
}

// Handle browser back / forward
window.addEventListener('popstate', (e) => {
    if (e.state && e.state.view) {
        showView(e.state.view, false);
    } else {
        // Fallback: parse URL
        const seg = window.location.pathname.split('/').pop();
        if (VIEW_SLUGS[seg]) showView(seg, false);
        else showView('overview', false);
    }
});

// ─── Sidebar ─────────────────────────────────────────────────

document.getElementById('sidebarToggle')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
});

document.querySelectorAll('.nav-item[data-view]').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        showView(item.dataset.view);
        document.getElementById('sidebar').classList.remove('open');
    });
});

document.querySelectorAll('.cat-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const cat = item.dataset.category;
        document.getElementById('filter-category').value = cat;
        updateSubcategoryOptions('filter-category', 'filter-subcategory', 'filter-style');
        showView('trades');
        loadTrades();
        document.getElementById('sidebar').classList.remove('open');
    });
});

// ─── Instrument Autocomplete ─────────────────────────────────

async function loadInstruments() {
    const data = await apiGet('/api/instruments');
    if (data) userInstruments = data;
}

async function loadCloseReasons() {
    const data = await apiGet('/api/close_reasons');
    if (data) userCloseReasons = data;
}

async function loadStrategies() {
    const data = await apiGet('/api/strategies');
    if (data) userStrategies = data;
}

async function loadPlaybooks() {
    const data = await apiGet('/api/playbooks');
    if (data) {
        userPlaybooks = data;
        populatePlaybookSelect('trade-playbook', 'No playbook');
        populatePlaybookSelect('editor-playbook', 'No playbook');
    }
}

function setupInstrumentPicker() {
    const input = document.getElementById('trade-instrument');
    const dropdown = document.getElementById('instrument-dropdown');
    if (!input || !dropdown) return;

    input.addEventListener('focus', () => showInstrumentDropdown(''));
    input.addEventListener('input', () => showInstrumentDropdown(input.value));

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.instrument-picker')) dropdown.classList.remove('open');
        if (!e.target.closest('.platform-picker')) {
            const pd = document.getElementById('platform-dropdown');
            if (pd) pd.classList.remove('open');
        }
        if (!e.target.closest('.strategy-picker')) {
            document.querySelectorAll('.strategy-dropdown').forEach(d => d.classList.remove('open'));
        }
    });

    setupPlatformPicker();
    setupStrategyPicker();
}

function showInstrumentDropdown(filter) {
    const dropdown = document.getElementById('instrument-dropdown');
    const filtered = userInstruments.filter(inst =>
        inst.name.toLowerCase().includes(filter.toLowerCase())
    );
    if (!filtered.length) {
        dropdown.innerHTML = '';
        dropdown.classList.remove('open');
        return;
    }
    dropdown.innerHTML = filtered.map(inst => `
        <div class="dd-item" data-id="${inst.id}">
            <span class="dd-name">${escapeHTML(inst.name)}</span>
            <span class="dd-meta">${escapeHTML(inst.asset_category)}${inst.platform ? ' · ' + escapeHTML(inst.platform) : ''}</span>
            <button class="dd-delete" data-id="${inst.id}" title="Delete instrument">&times;</button>
        </div>
    `).join('');
    dropdown.classList.add('open');

    dropdown.querySelectorAll('.dd-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.closest('.dd-delete')) return;
            selectInstrument(parseInt(item.dataset.id));
            dropdown.classList.remove('open');
        });
    });
    dropdown.querySelectorAll('.dd-delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm('Delete this saved instrument?')) {
                await apiDelete(`/api/instruments/${parseInt(btn.dataset.id)}`);
                await loadInstruments();
                showInstrumentDropdown(document.getElementById('trade-instrument').value);
                showToast('Instrument deleted', 'info');
            }
        });
    });
}

function selectInstrument(instrId) {
    const inst = userInstruments.find(i => i.id === instrId);
    if (!inst) return;
    selectedInstrument = inst;
    document.getElementById('trade-instrument').value = inst.name;
    document.getElementById('instrument-hint').textContent = `✓ Loaded defaults for "${inst.name}"`;
    document.getElementById('instrument-hint').classList.add('hint-loaded');

    if (inst.asset_category) { document.getElementById('trade-category').value = inst.asset_category; updateTradeFormDropdowns(); }
    if (inst.subcategory) document.getElementById('trade-subcategory').value = inst.subcategory;
    if (inst.trading_style) document.getElementById('trade-style').value = inst.trading_style;
    if (inst.instrument_type) document.getElementById('trade-instrument-type').value = inst.instrument_type;
    if (inst.lot_size) document.getElementById('trade-lot-size').value = inst.lot_size;
    if (inst.platform) document.getElementById('trade-platform').value = inst.platform;
    updatePositionFields();
}

// ─── Platform Autocomplete ───────────────────────────────────

function getUniquePlatforms() {
    const s = new Set();
    userInstruments.forEach(i => { if (i.platform && i.platform.trim()) s.add(i.platform.trim()); });
    return [...s].sort();
}

function setupPlatformPicker() {
    const input = document.getElementById('trade-platform');
    const dropdown = document.getElementById('platform-dropdown');
    if (!input || !dropdown) return;
    input.addEventListener('focus', () => showPlatformDropdown(''));
    input.addEventListener('input', () => showPlatformDropdown(input.value));
}

function showPlatformDropdown(filter) {
    const dropdown = document.getElementById('platform-dropdown');
    const all = getUniquePlatforms();
    const filtered = all.filter(p => p.toLowerCase().includes(filter.toLowerCase()));
    if (!filtered.length) { dropdown.classList.remove('open'); return; }

    dropdown.innerHTML = filtered.map(p => `
        <div class="dd-item dd-platform-item"><span class="dd-name">${escapeHTML(p)}</span></div>
    `).join('');
    dropdown.classList.add('open');
    dropdown.querySelectorAll('.dd-platform-item').forEach(item => {
        item.addEventListener('click', () => {
            document.getElementById('trade-platform').value = item.querySelector('.dd-name').textContent;
            dropdown.classList.remove('open');
        });
    });
}

// ─── Strategy Autocomplete ───────────────────────────────────

function getUniqueStrategies() {
    return userStrategies.map(s => s.name).sort();
}

function setupStrategyPicker() {
    const input = document.getElementById('trade-strategy');
    const dropdown = document.getElementById('strategy-dropdown');
    if (!input || !dropdown) return;
    input.addEventListener('focus', () => showStrategyDropdown('trade-strategy', 'strategy-dropdown', ''));
    input.addEventListener('input', () => showStrategyDropdown('trade-strategy', 'strategy-dropdown', input.value));
}

function showStrategyDropdown(inputId, dropdownId, filter) {
    const dropdown = document.getElementById(dropdownId);
    const all = getUniqueStrategies();
    const filtered = all.filter(s => s.toLowerCase().includes(filter.toLowerCase()));
    if (!filtered.length) { dropdown.classList.remove('open'); return; }

    dropdown.innerHTML = filtered.map(s => `
        <div class="dd-item dd-strategy-item"><span class="dd-name">${escapeHTML(s)}</span></div>
    `).join('');
    dropdown.classList.add('open');
    dropdown.querySelectorAll('.dd-strategy-item').forEach(item => {
        item.addEventListener('click', () => {
            document.getElementById(inputId).value = item.querySelector('.dd-name').textContent;
            dropdown.classList.remove('open');
        });
    });
}

// ─── Dynamic Dropdowns ───────────────────────────────────────

function updateSubcategoryOptions(catSelectId, subSelectId, styleSelectId) {
    const category = document.getElementById(catSelectId).value;
    const subSelect = document.getElementById(subSelectId);
    const styleSelect = document.getElementById(styleSelectId);
    subSelect.innerHTML = '<option value="">All</option>';
    styleSelect.innerHTML = '<option value="">All Styles</option>';
    if (category && CATEGORIES[category]) {
        CATEGORIES[category].subcategories.forEach(s => { subSelect.innerHTML += optionHTML(s); });
        CATEGORIES[category].styles.forEach(s => { styleSelect.innerHTML += optionHTML(s); });
    }
}

function updateTradeFormDropdowns() {
    const cat = document.getElementById('trade-category').value;
    const subSelect = document.getElementById('trade-subcategory');
    const styleSelect = document.getElementById('trade-style');
    subSelect.innerHTML = '<option value="">None</option>';
    styleSelect.innerHTML = '<option value="">Select Style</option>';
    if (cat && CATEGORIES[cat]) {
        CATEGORIES[cat].subcategories.forEach(s => { subSelect.innerHTML += optionHTML(s); });
        CATEGORIES[cat].styles.forEach(s => { styleSelect.innerHTML += optionHTML(s); });
    }
    updatePositionFields();
}

function updatePositionFields() {
    const cat = document.getElementById('trade-category').value;
    const instrTypeRow = document.getElementById('instrument-type-row');
    const lotSizeGroup = document.getElementById('lot-size-group');
    const sizeUnitHint = document.getElementById('size-unit-hint');
    const sizeInput = document.getElementById('trade-size');

    if (cat === 'Index' || cat === 'US Index') {
        instrTypeRow.style.display = ''; lotSizeGroup.style.display = '';
        sizeUnitHint.textContent = '(Lots)'; sizeInput.placeholder = 'No. of lots';
    } else if (cat === 'Forex' || cat === 'Commodity') {
        instrTypeRow.style.display = 'none'; lotSizeGroup.style.display = '';
        sizeUnitHint.textContent = '(Lots)'; sizeInput.placeholder = 'No. of lots';
    } else {
        instrTypeRow.style.display = 'none'; lotSizeGroup.style.display = 'none';
        sizeUnitHint.textContent = '(Shares)'; sizeInput.placeholder = 'No. of shares';
    }

    setTradePricePrecision(cat);
    updateRiskPreview();
}

function setPriceInputPrecision(inputIds, isForex) {
    const step = isForex ? FOREX_PRICE_STEP : STANDARD_PRICE_STEP;
    const placeholder = isForex ? '0.00000' : '0.00';

    inputIds.forEach((inputId) => {
        const input = document.getElementById(inputId);
        if (!input) return;
        input.step = step;
        if (!input.value) input.placeholder = placeholder;
    });
}

function setTradePricePrecision(category) {
    setPriceInputPrecision(['trade-entry-price', 'trade-sl', 'trade-target'], category === 'Forex');
}

function setEditorPricePrecision(category) {
    const isForex = category === 'Forex';
    setPriceInputPrecision(['editor-entry-price', 'editor-stop-loss', 'editor-planned-target', 'editor-exit-price'], isForex);
    setPriceInputPrecision(['editor-forex-exit-price'], true);
}

function getTradeFormEffectiveUnits() {
    const category = document.getElementById('trade-category')?.value || '';
    const size = Number(document.getElementById('trade-size')?.value || 0);
    const lotSize = Number(document.getElementById('trade-lot-size')?.value || 0);
    if (['Index', 'US Index', 'Commodity'].includes(category) && lotSize > 0) {
        return size * lotSize;
    }
    return size;
}

function updateRiskPreview() {
    const riskEl = document.getElementById('risk-preview-risk');
    if (!riskEl) return;

    const entry = Number(document.getElementById('trade-entry-price')?.value || 0);
    const stop = Number(document.getElementById('trade-sl')?.value || 0);
    const target = Number(document.getElementById('trade-target')?.value || 0);
    const units = getTradeFormEffectiveUnits();
    const direction = document.querySelector('input[name="trade-direction"]:checked')?.value || 'Long';
    const currency = document.getElementById('trade-currency')?.value || 'INR';
    const note = document.getElementById('risk-preview-note');
    const rrEl = document.getElementById('risk-preview-rr');
    const unitsEl = document.getElementById('risk-preview-units');
    const valueEl = document.getElementById('risk-preview-value');

    const reset = (message) => {
        riskEl.textContent = '--';
        if (rrEl) rrEl.textContent = '--';
        if (unitsEl) unitsEl.textContent = '--';
        if (valueEl) valueEl.textContent = '--';
        if (note) {
            note.textContent = message;
            note.className = '';
        }
    };

    if (entry <= 0 || stop <= 0 || units <= 0) {
        reset('Enter entry, stop, size, and optional target to audit the trade before committing it.');
        return;
    }
    if ((direction === 'Long' && stop >= entry) || (direction === 'Short' && stop <= entry)) {
        reset(direction === 'Long' ? 'Long trades need the stop below entry.' : 'Short trades need the stop above entry.');
        if (note) note.className = 'risk-warning';
        return;
    }

    const risk = Math.abs(entry - stop) * units;
    riskEl.textContent = formatCurrencyAmount(currency, risk);
    if (unitsEl) unitsEl.textContent = units.toLocaleString(undefined, { maximumFractionDigits: 4 });
    if (valueEl) valueEl.textContent = formatCurrencyAmount(currency, entry * units);

    if (target > 0) {
        const validTarget = direction === 'Long' ? target > entry : target < entry;
        if (!validTarget) {
            if (rrEl) rrEl.textContent = '--';
            if (note) {
                note.textContent = direction === 'Long' ? 'Long trade targets should be above entry.' : 'Short trade targets should be below entry.';
                note.className = 'risk-warning';
            }
            return;
        }
        const reward = Math.abs(target - entry) * units;
        if (rrEl) rrEl.textContent = `${(reward / risk).toFixed(2)}R`;
        if (note) {
            note.textContent = reward / risk >= 2 ? 'Plan quality looks strong on reward-to-risk.' : 'R:R is below 2R. Make sure the setup justifies the risk.';
            note.className = reward / risk >= 2 ? 'risk-ok' : 'risk-warning';
        }
    } else if (note) {
        if (rrEl) rrEl.textContent = '--';
        note.textContent = 'Add a planned target to calculate planned R:R.';
        note.className = '';
    }
}

document.getElementById('filter-category')?.addEventListener('change', () => {
    updateSubcategoryOptions('filter-category', 'filter-subcategory', 'filter-style');
});
document.getElementById('trade-category')?.addEventListener('change', () => updateTradeFormDropdowns());
['trade-entry-price', 'trade-sl', 'trade-target', 'trade-lot-size', 'trade-size', 'trade-currency'].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', updateRiskPreview);
    document.getElementById(id)?.addEventListener('change', updateRiskPreview);
});
document.querySelectorAll('input[name="trade-direction"]').forEach((input) => {
    input.addEventListener('change', updateRiskPreview);
});
document.getElementById('analytics-category')?.addEventListener('change', () => {
    updateSubcategoryOptions('analytics-category', 'analytics-subcategory', 'analytics-style');
});

// ─── Populate dynamic filter selects ─────────────────────────

async function populateDynamicFilters() {
    await loadInstruments();
    await loadCloseReasons();
    await loadStrategies();
    await loadPlaybooks();

    // Platform filters
    const platforms = getUniquePlatforms();
    populateSelect('filter-platform', platforms);
    populateSelect('ov-filter-platform', platforms);
    populateSelect('analytics-platform', platforms);

    // Instrument filters
    const instruments = userInstruments.map(i => i.name).sort();
    populateSelect('filter-instrument', instruments);
    populateSelect('ov-filter-instrument', instruments);
    populateSelect('analytics-instrument', instruments);

    // Close reasons
    const defaultReasons = ['Stoploss Hit', 'TP Hit', 'Exited Earlier in Loss', 'Exited Earlier in Profit'];
    const customReasons = userCloseReasons.map(r => r.reason);
    const allReasons = [...new Set([...defaultReasons, ...customReasons])].sort();
    populateSelect('filter-close-reason', allReasons);
    populateSelect('ov-filter-close-reason', allReasons);
    populateSelect('analytics-close-reason', allReasons);

    // Strategy filters
    const strategies = getUniqueStrategies();
    populateSelect('filter-strategy', strategies);
    populateSelect('ov-filter-strategy', strategies);
    populateSelect('analytics-strategy', strategies);

    populatePlaybookSelect('filter-playbook', 'All');
    populatePlaybookSelect('ov-filter-playbook', 'All');
    populatePlaybookSelect('analytics-playbook', 'All');
    populatePlaybookSelect('trade-playbook', 'No playbook');
    populatePlaybookSelect('editor-playbook', 'No playbook');

    // Close reason dropdown in editor modal — rebuild to avoid duplicates
    const editorCR = document.getElementById('editor-close-reason');
    if (editorCR) {
        const currentVal = editorCR.value;
        editorCR.innerHTML = '<option value="">Select reason...</option>';
        allReasons.forEach(r => {
            editorCR.innerHTML += optionHTML(r);
        });
        editorCR.innerHTML += '<option value="__custom__">+ Add Custom Reason</option>';
        editorCR.value = currentVal;
    }
}

function populateSelect(id, items) {
    const sel = document.getElementById(id);
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">All</option>';
    items.forEach(item => { sel.innerHTML += optionHTML(item); });
    sel.value = current; // preserve selection
}

function populatePlaybookSelect(id, emptyLabel = 'All') {
    const sel = document.getElementById(id);
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = optionHTML('', emptyLabel);
    userPlaybooks.forEach(playbook => {
        sel.innerHTML += optionHTML(String(playbook.id), playbook.name);
    });
    sel.value = current;
}

// ─── API Helpers ─────────────────────────────────────────────

const BASE = window.TRADEVAULT_BASE || '';
let wakeupToastActive = false;

function withBase(url) {
    if (!url) return BASE || '';
    if (!BASE || url.startsWith(BASE + '/') || url.startsWith('http')) return url;
    return BASE + url;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function showWakeupToast(message) {
    if (wakeupToastActive) return;
    wakeupToastActive = true;

    let container = document.querySelector('.flash-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'flash-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'flash flash-info';
    const span = document.createElement('span');
    const icon = document.createElement('i');
    icon.className = 'fas fa-hourglass-half';
    span.append(icon, document.createTextNode(` ${message}`));
    toast.appendChild(span);
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
            toast.remove();
            wakeupToastActive = false;
        }, 400);
    }, 6000);
}

async function requestJSON(url, options = {}, nullOnHttpError = false) {
    const fullUrl = BASE + url;
    const retries = 2;

    for (let attempt = 0; attempt <= retries; attempt++) {
        let wakeupTimer = null;
        try {
            wakeupTimer = setTimeout(() => {
                showWakeupToast('The server is taking longer than usual. Still working...');
            }, 4500);

            const res = await fetch(fullUrl, options);
            clearTimeout(wakeupTimer);

            if (res.status === 401 || res.redirected) {
                window.location.href = BASE + '/login';
                return null;
            }

            const isRetryable = res.status >= 500 || res.status === 429;
            if (isRetryable && attempt < retries) {
                showWakeupToast('Temporary server issue. Retrying automatically...');
                await sleep(2000 * (attempt + 1));
                continue;
            }

            const text = await res.text();
            let parsed = {};
            if (text) {
                try {
                    parsed = JSON.parse(text);
                } catch {
                    parsed = { error: text };
                }
            }

            if (!res.ok && nullOnHttpError) return null;
            return parsed;
        } catch (err) {
            if (wakeupTimer) clearTimeout(wakeupTimer);
            if (attempt < retries) {
                showWakeupToast('Network issue. Retrying automatically...');
                await sleep(2000 * (attempt + 1));
                continue;
            }
            showWakeupToast('Request failed. Please retry in a few seconds.');
            return nullOnHttpError ? null : { error: err.message || 'Network error' };
        }
    }
    return nullOnHttpError ? null : { error: 'Request failed after retries' };
}

async function apiGet(url) {
    return requestJSON(url, {}, true);
}

async function apiPost(url, data) {
    return requestJSON(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': CSRF_TOKEN },
        credentials: 'same-origin',
        body: JSON.stringify(data)
    });
}

async function apiPut(url, data) {
    return requestJSON(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': CSRF_TOKEN },
        credentials: 'same-origin',
        body: JSON.stringify(data)
    });
}

async function apiPatch(url, data) {
    return requestJSON(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': CSRF_TOKEN },
        credentials: 'same-origin',
        body: JSON.stringify(data)
    });
}

async function apiDelete(url) {
    return requestJSON(url, {
        method: 'DELETE',
        headers: { 'X-CSRF-Token': CSRF_TOKEN },
        credentials: 'same-origin'
    });
}

// ─── Overview ────────────────────────────────────────────────

function getOverviewFilterParams() {
    const p = new URLSearchParams();
    if (overviewCategory) p.set('category', overviewCategory);
    const map = {
        'ov-filter-subcategory': 'subcategory',
        'ov-filter-style': 'style',
        'ov-filter-direction': 'direction',
        'ov-filter-platform': 'platform',
        'ov-filter-instrument': 'instrument',
        'ov-filter-currency': 'currency',
        'ov-filter-psychology': 'psychology',
        'ov-filter-close-reason': 'close_reason',
        'ov-filter-strategy': 'strategy',
        'ov-filter-playbook': 'playbook_id',
        'ov-filter-from': 'date_from',
        'ov-filter-to': 'date_to'
    };
    for (const [elemId, param] of Object.entries(map)) {
        const el = document.getElementById(elemId);
        if (el && el.value) p.set(param, el.value);
    }
    return p.toString();
}

async function loadOverview() {
    await populateDynamicFilters();

    // Populate subcategory/style for current overview category
    const cat = overviewCategory;
    const subSel = document.getElementById('ov-filter-subcategory');
    const styleSel = document.getElementById('ov-filter-style');
    if (subSel) {
        subSel.innerHTML = '<option value="">All</option>';
        if (cat && CATEGORIES[cat]) CATEGORIES[cat].subcategories.forEach(s => { subSel.innerHTML += optionHTML(s); });
    }
    if (styleSel) {
        styleSel.innerHTML = '<option value="">All Styles</option>';
        if (cat && CATEGORIES[cat]) CATEGORIES[cat].styles.forEach(s => { styleSel.innerHTML += optionHTML(s); });
    }

    const qs = getOverviewFilterParams();
    const analytics = await apiGet(`/api/analytics?${qs}`);
    const trades = await apiGet(`/api/trades?status=open${overviewCategory ? '&category=' + encodeURIComponent(overviewCategory) : ''}`);

    if (analytics) {
        document.getElementById('ov-total').textContent = analytics.total_trades;
        document.getElementById('ov-wins').textContent = analytics.winning_trades;
        document.getElementById('ov-losses').textContent = analytics.losing_trades;
        document.getElementById('ov-winrate').textContent = analytics.win_pct + '%';
        const payoffRatio = analytics.payoff_ratio !== undefined ? analytics.payoff_ratio : analytics.win_loss_ratio;
        document.getElementById('ov-wlratio').textContent = formatRatio(payoffRatio);
        renderEquityCurve('overviewEquityCurve', analytics.equity_curve || []);
        renderMonthlyPnl('overviewMonthlyPnl', analytics.monthly_pnl || []);
    }
    if (trades) {
        document.getElementById('ov-open').textContent = trades.length;
    }
}

function clearOverviewFilters() {
    ['ov-filter-subcategory','ov-filter-style','ov-filter-direction','ov-filter-platform',
     'ov-filter-instrument','ov-filter-psychology','ov-filter-close-reason','ov-filter-strategy',
     'ov-filter-playbook'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
    });
    document.getElementById('ov-filter-currency').value = '';
    document.getElementById('ov-filter-from').value = '';
    document.getElementById('ov-filter-to').value = '';
    loadOverview();
}

// Overview tabs
document.querySelectorAll('.ov-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.ov-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        overviewCategory = tab.dataset.ovCat;
        loadOverview();
    });
});

// ─── Load Trades ─────────────────────────────────────────────

async function loadTrades() {
    const params = new URLSearchParams();
    const map = {
        'filter-category': 'category', 'filter-subcategory': 'subcategory', 'filter-style': 'style',
        'filter-direction': 'direction', 'filter-status': 'status', 'filter-platform': 'platform',
        'filter-instrument': 'instrument', 'filter-currency': 'currency',
        'filter-psychology': 'psychology', 'filter-close-reason': 'close_reason',
        'filter-strategy': 'strategy',
        'filter-playbook': 'playbook_id',
        'filter-from': 'date_from', 'filter-to': 'date_to'
    };
    for (const [elemId, param] of Object.entries(map)) {
        const el = document.getElementById(elemId);
        if (el && el.value) params.set(param, el.value);
    }
    const trades = await apiGet(`/api/trades?${params.toString()}`);
    renderTradesTable(trades || []);
}

function renderTradesTable(trades) {
    const tbody = document.getElementById('trades-tbody');
    if (!trades.length) {
        tbody.innerHTML = '<tr><td colspan="17" class="empty-state">No trades found. Start by adding a trade!</td></tr>';
        return;
    }

    tbody.innerHTML = trades.map(t => {
        const dir = t.direction || 'Long';
        const sym = CURRENCY_SYMBOLS[t.currency] || '₹';
        const pnl = formatPnl(t);
        const dirClass = dir === 'Long' ? 'dir-badge-long' : 'dir-badge-short';

        const psyBadge = t.psychology
            ? `<span class="psy-badge psy-${escapeHTML(t.psychology.toLowerCase())}">${escapeHTML(t.psychology)}${t.psychology_detail ? ' (' + escapeHTML(t.psychology_detail.replace('Weak psychology during ','')) + ')' : ''}</span>`
            : '<span class="text-muted">—</span>';

        return `<tr>
            <td>#${t.id}</td>
            <td><strong>${escapeHTML(t.instrument)}</strong>${t.entry_notes ? '<br><small class="text-muted">' + escapeHTML(truncate(t.entry_notes, 30)) + '</small>' : ''}</td>
            <td>${escapeHTML(t.asset_category)}</td>
            <td><span class="dir-badge ${dirClass}">${escapeHTML(dir)}</span></td>
            <td>${escapeHTML(t.trading_style)}</td>
            <td>${t.platform ? escapeHTML(t.platform) : '—'}</td>
            <td>${sym}${formatPrice(t.entry_price, t.asset_category)}</td>
            <td>${t.exit_price ? sym + formatPrice(t.exit_price, t.asset_category) : '—'}</td>
            <td>${sym}${formatPrice(t.stop_loss, t.asset_category)}</td>
            <td>${formatPositionSize(t)}</td>
            <td class="${pnl.className}">${pnl.value}</td>
            <td>${t.strategy ? escapeHTML(t.strategy) : '<span class="text-muted">—</span>'}</td>
            <td>${t.playbook_name ? `<span class="badge playbook-badge">${escapeHTML(t.playbook_name)}</span>` : '<span class="text-muted">—</span>'}</td>
            <td>${psyBadge}</td>
            <td>${formatReviewBadge(t)}</td>
            <td><span class="badge badge-${escapeHTML(t.status)}">${escapeHTML(t.status)}</span></td>
            <td class="action-btns">
                ${t.status === 'open' ? `<button class="action-btn close-trade" onclick="openTradeEditor(${t.id}, 'close')" title="Close"><i class="fas fa-door-closed"></i></button>` : ''}
                <button class="action-btn edit-trade" onclick="openTradeEditor(${t.id}, 'edit')" title="Edit"><i class="fas fa-edit"></i></button>
                <button class="action-btn delete-trade" onclick="deleteTrade(${t.id})" title="Delete"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    }).join('');
}

function truncate(str, n) { return str.length > n ? str.substring(0, n) + '…' : str; }

function clearFilters() {
    ['filter-category','filter-subcategory','filter-style','filter-direction','filter-status',
     'filter-platform','filter-instrument','filter-psychology','filter-close-reason','filter-strategy',
     'filter-playbook'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
    });
    document.getElementById('filter-currency').value = '';
    document.getElementById('filter-subcategory').innerHTML = '<option value="">All</option>';
    document.getElementById('filter-style').innerHTML = '<option value="">All Styles</option>';
    document.getElementById('filter-from').value = '';
    document.getElementById('filter-to').value = '';
    loadTrades();
}

// ─── Playbooks ───────────────────────────────────────────────

async function loadPlaybooksView() {
    await loadPlaybooks();
    renderPlaybooks();
}

function renderPlaybooks() {
    const tbody = document.getElementById('playbooks-tbody');
    if (!tbody) return;
    if (!userPlaybooks.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No playbooks yet. Define one setup you are allowed to trade.</td></tr>';
        return;
    }
    tbody.innerHTML = userPlaybooks.map((playbook) => {
        const rulesPreview = playbook.setup_rules || playbook.checklist || playbook.notes || '—';
        return `<tr>
            <td><strong>${escapeHTML(playbook.name)}</strong>${playbook.notes ? '<br><small class="text-muted">' + escapeHTML(truncate(playbook.notes, 70)) + '</small>' : ''}</td>
            <td>${playbook.market_scope ? escapeHTML(playbook.market_scope) : '<span class="text-muted">All markets</span>'}</td>
            <td>${rulesPreview === '—' ? '<span class="text-muted">—</span>' : escapeHTML(truncate(rulesPreview.replace(/\n+/g, ' · '), 90))}</td>
            <td class="action-btns">
                <button class="action-btn edit-trade" onclick="editPlaybook(${playbook.id})" title="Edit"><i class="fas fa-edit"></i></button>
                <button class="action-btn delete-trade" onclick="archivePlaybook(${playbook.id})" title="Archive"><i class="fas fa-archive"></i></button>
            </td>
        </tr>`;
    }).join('');
}

function resetPlaybookForm() {
    document.getElementById('playbook-id').value = '';
    document.getElementById('playbook-name').value = '';
    document.getElementById('playbook-market').value = '';
    document.getElementById('playbook-rules').value = '';
    document.getElementById('playbook-checklist').value = '';
    document.getElementById('playbook-notes').value = '';
    document.getElementById('playbook-form-mode').textContent = 'New';
    showView('playbooks');
}

function editPlaybook(playbookId) {
    const playbook = userPlaybooks.find(item => Number(item.id) === Number(playbookId));
    if (!playbook) return;
    document.getElementById('playbook-id').value = playbook.id;
    document.getElementById('playbook-name').value = playbook.name || '';
    document.getElementById('playbook-market').value = playbook.market_scope || '';
    document.getElementById('playbook-rules').value = playbook.setup_rules || '';
    document.getElementById('playbook-checklist').value = playbook.checklist || '';
    document.getElementById('playbook-notes').value = playbook.notes || '';
    document.getElementById('playbook-form-mode').textContent = 'Editing';
    showView('playbooks');
    document.getElementById('playbook-name').focus();
}

async function archivePlaybook(playbookId) {
    if (!confirm('Archive this playbook? Existing trades keep the historical link.')) return;
    const result = await apiDelete(`/api/playbooks/${playbookId}`);
    if (result?.message) {
        showToast('Playbook archived', 'info');
        await loadPlaybooksView();
    } else {
        showToast(result?.error || 'Could not archive playbook', 'error');
    }
}

document.getElementById('playbook-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const playbookId = document.getElementById('playbook-id').value;
    const data = {
        name: document.getElementById('playbook-name').value.trim(),
        market_scope: document.getElementById('playbook-market').value,
        setup_rules: document.getElementById('playbook-rules').value.trim(),
        checklist: document.getElementById('playbook-checklist').value.trim(),
        notes: document.getElementById('playbook-notes').value.trim()
    };
    if (!data.name) {
        showToast('Playbook name is required', 'error');
        return;
    }
    const result = playbookId
        ? await apiPatch(`/api/playbooks/${playbookId}`, data)
        : await apiPost('/api/playbooks', data);
    if (result?.message || result?.id) {
        showToast(playbookId ? 'Playbook updated' : 'Playbook saved', 'success');
        resetPlaybookForm();
        await loadPlaybooksView();
    } else {
        showToast(result?.error || 'Could not save playbook', 'error');
    }
});

// ─── Add Trade ───────────────────────────────────────────────

document.getElementById('add-trade-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const direction = document.querySelector('input[name="trade-direction"]:checked')?.value || 'Long';

    const data = {
        asset_category: document.getElementById('trade-category').value,
        subcategory: document.getElementById('trade-subcategory').value,
        trading_style: document.getElementById('trade-style').value,
        instrument: document.getElementById('trade-instrument').value.trim(),
        entry_price: document.getElementById('trade-entry-price').value,
        entry_datetime: document.getElementById('trade-entry-dt').value,
        stop_loss: document.getElementById('trade-sl').value,
        planned_target: document.getElementById('trade-target').value || '',
        position_size: document.getElementById('trade-size').value,
        direction: direction,
        instrument_type: document.getElementById('trade-instrument-type').value || '',
        lot_size: document.getElementById('trade-lot-size').value || '',
        platform: document.getElementById('trade-platform').value.trim() || '',
        currency: document.getElementById('trade-currency').value || 'INR',
        entry_notes: document.getElementById('trade-entry-notes').value.trim() || '',
        playbook_id: document.getElementById('trade-playbook').value || '',
        strategy: document.getElementById('trade-strategy').value.trim() || ''
    };

    if (!data.asset_category || !data.trading_style || !data.instrument ||
        !data.entry_price || !data.entry_datetime || !data.stop_loss || !data.position_size) {
        showToast('Please fill all required fields', 'error');
        return;
    }

    const result = await apiPost('/api/trades', data);
    if (result.id) {
        showToast('Trade added successfully!', 'success');
        resetTradeForm();
        await loadInstruments();
        await loadStrategies();
        showView('trades');
    } else {
        showToast(result.error || 'Failed to add trade', 'error');
    }
});

function resetTradeForm() {
    const form = document.getElementById('add-trade-form');
    if (form) form.reset();
    selectedInstrument = null;
    const hint = document.getElementById('instrument-hint');
    if (hint) { hint.textContent = 'Type to search saved instruments or enter a new one'; hint.classList.remove('hint-loaded'); }
    document.getElementById('instrument-type-row').style.display = 'none';
    document.getElementById('lot-size-group').style.display = 'none';
    document.getElementById('size-unit-hint').textContent = '(Qty)';
    const longRadio = document.getElementById('dir-long');
    if (longRadio) longRadio.checked = true;
    setTradePricePrecision(document.getElementById('trade-category')?.value || '');
    updateRiskPreview();
}

// ─── Modal Helper ────────────────────────────────────────────

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// ─── Unified Trade Editor Modal ──────────────────────────────

let editorTradeCache = null;
let editorMode = 'edit'; // 'close' or 'edit'
let editorAttachments = [];

function formatFileSize(bytes) {
    const size = Number(bytes || 0);
    if (!Number.isFinite(size) || size <= 0) return '';
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function setupAttachmentInput() {
    const input = document.getElementById('editor-attachment-file');
    const label = document.getElementById('editor-attachment-file-label');
    if (!input || !label) return;
    input.addEventListener('change', () => {
        label.textContent = input.files?.[0]?.name || 'Choose chart image';
    });
}

function resetAttachmentInputs() {
    const input = document.getElementById('editor-attachment-file');
    const caption = document.getElementById('editor-attachment-caption');
    const label = document.getElementById('editor-attachment-file-label');
    if (input) input.value = '';
    if (caption) caption.value = '';
    if (label) label.textContent = 'Choose chart image';
}

function renderTradeAttachments(attachments) {
    const gallery = document.getElementById('editor-attachment-gallery');
    if (!gallery) return;
    if (!attachments.length) {
        gallery.innerHTML = '<div class="empty-state compact">No chart images attached.</div>';
        return;
    }
    gallery.innerHTML = attachments.map((attachment) => {
        const url = withBase(attachment.url);
        const title = attachment.caption || attachment.original_name || 'Chart image';
        const size = formatFileSize(attachment.file_size);
        return `
            <article class="attachment-card">
                <a class="attachment-thumb" href="${escapeHTML(url)}" target="_blank" rel="noopener">
                    <img src="${escapeHTML(url)}" alt="${escapeHTML(title)}" loading="lazy">
                </a>
                <div class="attachment-meta">
                    <strong>${escapeHTML(title)}</strong>
                    <span>${escapeHTML(attachment.original_name || '')}${size ? ` · ${escapeHTML(size)}` : ''}</span>
                </div>
                <button type="button" class="action-btn delete-trade" onclick="deleteTradeAttachment(${attachment.id})" title="Delete image">
                    <i class="fas fa-trash"></i>
                </button>
            </article>`;
    }).join('');
}

async function loadTradeAttachments(tradeId) {
    const gallery = document.getElementById('editor-attachment-gallery');
    if (gallery) gallery.innerHTML = '<div class="empty-state compact">Loading chart images...</div>';
    const attachments = await apiGet(`/api/trades/${tradeId}/attachments`);
    if (!Array.isArray(attachments)) {
        editorAttachments = [];
        if (gallery) gallery.innerHTML = '<div class="empty-state compact">Could not load chart images.</div>';
        return;
    }
    editorAttachments = attachments;
    renderTradeAttachments(editorAttachments);
}

async function uploadTradeAttachment() {
    const tradeId = document.getElementById('editor-trade-id')?.value;
    const input = document.getElementById('editor-attachment-file');
    const caption = document.getElementById('editor-attachment-caption');
    const button = document.getElementById('editor-attachment-upload-btn');
    const file = input?.files?.[0];
    if (!tradeId || !file) {
        showToast('Choose a chart image first', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('caption', caption?.value?.trim() || '');

    if (button) {
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading';
    }

    try {
        const res = await fetch(BASE + `/api/trades/${tradeId}/attachments`, {
            method: 'POST',
            headers: { 'X-CSRF-Token': CSRF_TOKEN },
            credentials: 'same-origin',
            body: formData
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.error) {
            showToast(data.error || 'Could not upload chart image', 'error');
            return;
        }
        resetAttachmentInputs();
        await loadTradeAttachments(tradeId);
        showToast('Chart image attached', 'success');
    } catch (err) {
        showToast('Upload failed: ' + err.message, 'error');
    } finally {
        if (button) {
            button.disabled = false;
            button.innerHTML = '<i class="fas fa-upload"></i> Upload';
        }
    }
}

async function deleteTradeAttachment(attachmentId) {
    if (!confirm('Delete this chart image?')) return;
    const result = await apiDelete(`/api/trade-attachments/${attachmentId}`);
    if (result?.message) {
        showToast('Chart image deleted', 'info');
        const tradeId = document.getElementById('editor-trade-id')?.value;
        if (tradeId) loadTradeAttachments(tradeId);
    } else {
        showToast(result?.error || 'Could not delete chart image', 'error');
    }
}

function setReviewTags(tagsText) {
    const tags = new Set(String(tagsText || '').split(',').map(tag => tag.trim()).filter(Boolean));
    document.querySelectorAll('#editor-mistake-tags input[type="checkbox"]').forEach((input) => {
        input.checked = tags.has(input.value);
        tags.delete(input.value);
    });
    const customInput = document.getElementById('editor-mistake-tags-custom');
    if (customInput) customInput.value = Array.from(tags).join(', ');
}

function getReviewTags() {
    const selected = Array.from(document.querySelectorAll('#editor-mistake-tags input[type="checkbox"]:checked')).map(input => input.value);
    const custom = document.getElementById('editor-mistake-tags-custom')?.value || '';
    custom.split(',').map(tag => tag.trim()).filter(Boolean).forEach(tag => selected.push(tag));
    return Array.from(new Set(selected)).join(', ');
}

function ensurePlaybookOption(selectId, playbookId, playbookName) {
    const select = document.getElementById(selectId);
    if (!select || !playbookId || Array.from(select.options).some(option => option.value === String(playbookId))) {
        return;
    }
    const option = document.createElement('option');
    option.value = String(playbookId);
    option.textContent = playbookName || `Archived playbook #${playbookId}`;
    select.appendChild(option);
}

async function openTradeEditor(tradeId, mode) {
  try {
    await Promise.all([loadStrategies(), loadCloseReasons(), loadInstruments(), loadPlaybooks()]);
    const trade = await apiGet(`/api/trades/${tradeId}`);
    if (!trade) { showToast('Trade not found', 'error'); return; }
    editorTradeCache = trade;
    editorMode = mode;

    const isForex = trade.asset_category === 'Forex';
    const isOpen = trade.status === 'open';
    const isClosing = mode === 'close' && isOpen;

    // Set title
    const titleEl = document.getElementById('trade-editor-title');
    if (isClosing) {
        titleEl.innerHTML = `<i class="fas fa-door-closed"></i> Close Trade #<span id="editor-trade-id-label">${trade.id}</span>`;
    } else {
        titleEl.innerHTML = `<i class="fas fa-edit"></i> Edit Trade #<span id="editor-trade-id-label">${trade.id}</span>`;
    }

    // Populate all fields
    document.getElementById('editor-trade-id').value = trade.id;
    document.getElementById('editor-trade-status').value = trade.status;
    document.getElementById('editor-instrument').value = trade.instrument || '';
    document.getElementById('editor-category').value = trade.asset_category || '';
    updateEditorDropdowns();
    setEditorPricePrecision(trade.asset_category || '');
    document.getElementById('editor-subcategory').value = trade.subcategory || '';
    document.getElementById('editor-style').value = trade.trading_style || '';
    document.getElementById('editor-direction').value = trade.direction || 'Long';
    document.getElementById('editor-instrument-type').value = trade.instrument_type || '';
    document.getElementById('editor-platform').value = trade.platform || '';
    document.getElementById('editor-currency').value = trade.currency || 'INR';
    document.getElementById('editor-strategy').value = trade.strategy || '';
    ensurePlaybookOption('editor-playbook', trade.playbook_id, trade.playbook_name);
    document.getElementById('editor-playbook').value = trade.playbook_id || '';
    document.getElementById('editor-entry-price').value = trade.entry_price || '';
    document.getElementById('editor-entry-dt').value = trade.entry_datetime || '';
    document.getElementById('editor-stop-loss').value = trade.stop_loss || '';
    document.getElementById('editor-planned-target').value = trade.planned_target || '';
    document.getElementById('editor-lot-size').value = trade.lot_size || '';
    document.getElementById('editor-position-size').value = trade.position_size || '';
    document.getElementById('editor-entry-notes').value = trade.entry_notes || '';

    // Setup strategy picker in editor
    const editorStratInput = document.getElementById('editor-strategy');
    const editorStratDropdown = document.getElementById('editor-strategy-dropdown');
    if (editorStratInput) {
        editorStratInput.onfocus = () => showStrategyDropdown('editor-strategy', 'editor-strategy-dropdown', '');
        editorStratInput.oninput = () => showStrategyDropdown('editor-strategy', 'editor-strategy-dropdown', editorStratInput.value);
    }

    // Exit section visibility
    const exitSection = document.getElementById('editor-exit-section');
    if (isClosing || trade.status === 'closed') {
        exitSection.style.display = '';
    } else {
        exitSection.style.display = 'none';
    }

    // Forex vs standard exit
    document.getElementById('editor-standard-exit').style.display = isForex ? 'none' : '';
    document.getElementById('editor-forex-exit').style.display = isForex ? '' : 'none';

    if (isForex) {
        if (trade.manual_pnl !== null && trade.manual_pnl !== undefined) {
            const mpnl = parseFloat(trade.manual_pnl);
            document.getElementById('editor-pnl-type').value = mpnl >= 0 ? 'profit' : 'loss';
            document.getElementById('editor-pnl-amount').value = Math.abs(mpnl);
        } else {
            document.getElementById('editor-pnl-type').value = 'profit';
            document.getElementById('editor-pnl-amount').value = '';
        }
        document.getElementById('editor-forex-exit-price').value = trade.exit_price || '';
        document.getElementById('editor-forex-exit-dt').value = trade.exit_datetime || '';
        if (isClosing && !trade.exit_datetime) {
            const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            document.getElementById('editor-forex-exit-dt').value = now.toISOString().slice(0, 16);
        }
    } else {
        document.getElementById('editor-exit-price').value = trade.exit_price || '';
        document.getElementById('editor-exit-dt').value = trade.exit_datetime || '';
        if (isClosing && !trade.exit_datetime) {
            const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            document.getElementById('editor-exit-dt').value = now.toISOString().slice(0, 16);
        }
    }

    // Close reason
    const crSelect = document.getElementById('editor-close-reason');
    const crCustom = document.getElementById('editor-close-reason-custom');
    crCustom.style.display = 'none';
    crCustom.value = '';
    // Check if trade's close_reason is in the dropdown
    const existingCR = trade.close_reason || '';
    const crOptions = Array.from(crSelect.options).map(o => o.value);
    if (existingCR && !crOptions.includes(existingCR) && existingCR !== '__custom__') {
        // Value not in dropdown, show custom
        crSelect.value = '__custom__';
        crCustom.value = existingCR;
        crCustom.style.display = '';
    } else {
        crSelect.value = existingCR;
    }

    // Psychology
    document.getElementById('editor-psychology').value = trade.psychology || '';
    document.getElementById('editor-psychology-detail').value = trade.psychology_detail || '';
    document.getElementById('editor-psychology-detail-group').style.display = trade.psychology === 'Weak' ? '' : 'none';

    // Exit notes
    document.getElementById('editor-exit-notes').value = trade.exit_notes || '';
    document.getElementById('editor-execution-score').value = trade.execution_score || '';
    document.getElementById('editor-setup-quality').value = trade.setup_quality || '';
    document.getElementById('editor-rule-followed').checked = Boolean(Number(trade.rule_followed || 0));
    document.getElementById('editor-review-notes').value = trade.review_notes || '';
    setReviewTags(trade.mistake_tags || '');
    resetAttachmentInputs();
    await loadTradeAttachments(trade.id);

    // Button text
    const saveBtn = document.getElementById('editor-save-btn');
    if (isClosing) {
        saveBtn.innerHTML = '<i class="fas fa-door-closed"></i> Close Trade';
    } else {
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
    }

    document.getElementById('trade-editor-modal').classList.add('active');
  } catch (err) {
    console.error('openTradeEditor error:', err);
    showToast('Error opening trade editor: ' + err.message, 'error');
  }
}

function updateEditorDropdowns() {
    const cat = document.getElementById('editor-category').value;
    const subSelect = document.getElementById('editor-subcategory');
    const styleSelect = document.getElementById('editor-style');
    subSelect.innerHTML = '<option value="">None</option>';
    styleSelect.innerHTML = '<option value="">Select</option>';
    if (cat && CATEGORIES[cat]) {
        CATEGORIES[cat].subcategories.forEach(s => { subSelect.innerHTML += optionHTML(s); });
        CATEGORIES[cat].styles.forEach(s => { styleSelect.innerHTML += optionHTML(s); });
    }
    setEditorPricePrecision(cat);
}

document.getElementById('editor-category')?.addEventListener('change', updateEditorDropdowns);

// Close reason → custom input
document.getElementById('editor-close-reason')?.addEventListener('change', function() {
    const custom = document.getElementById('editor-close-reason-custom');
    if (this.value === '__custom__') { custom.style.display = ''; custom.focus(); }
    else { custom.style.display = 'none'; custom.value = ''; }
});

// Psychology → detail
document.getElementById('editor-psychology')?.addEventListener('change', function() {
    document.getElementById('editor-psychology-detail-group').style.display = this.value === 'Weak' ? '' : 'none';
    if (this.value !== 'Weak') document.getElementById('editor-psychology-detail').value = '';
});

async function saveTradeEditor() {
  try {
    const tradeId = document.getElementById('editor-trade-id').value;
    const isOpen = document.getElementById('editor-trade-status').value === 'open';
    const isClosing = editorMode === 'close' && isOpen;
    const isForex = document.getElementById('editor-category').value === 'Forex';

    let closeReason = document.getElementById('editor-close-reason').value;
    if (closeReason === '__custom__') closeReason = document.getElementById('editor-close-reason-custom').value.trim();

    const data = {
        instrument: document.getElementById('editor-instrument').value.trim(),
        asset_category: document.getElementById('editor-category').value,
        subcategory: document.getElementById('editor-subcategory').value,
        trading_style: document.getElementById('editor-style').value,
        direction: document.getElementById('editor-direction').value,
        instrument_type: document.getElementById('editor-instrument-type').value,
        platform: document.getElementById('editor-platform').value.trim(),
        currency: document.getElementById('editor-currency').value,
        strategy: document.getElementById('editor-strategy').value.trim(),
        playbook_id: document.getElementById('editor-playbook').value || '',
        entry_price: document.getElementById('editor-entry-price').value,
        entry_datetime: document.getElementById('editor-entry-dt').value,
        stop_loss: document.getElementById('editor-stop-loss').value,
        planned_target: document.getElementById('editor-planned-target').value || '',
        lot_size: document.getElementById('editor-lot-size').value,
        position_size: document.getElementById('editor-position-size').value,
        entry_notes: document.getElementById('editor-entry-notes').value.trim(),
        close_reason: closeReason,
        psychology: document.getElementById('editor-psychology').value,
        psychology_detail: document.getElementById('editor-psychology-detail').value,
        exit_notes: document.getElementById('editor-exit-notes').value.trim(),
        execution_score: document.getElementById('editor-execution-score').value,
        setup_quality: document.getElementById('editor-setup-quality').value,
        rule_followed: document.getElementById('editor-rule-followed').checked,
        mistake_tags: getReviewTags(),
        review_notes: document.getElementById('editor-review-notes').value.trim()
    };

    // Handle exit fields
    if (isClosing) {
        if (isForex) {
            const pnlType = document.getElementById('editor-pnl-type').value;
            const pnlAmount = parseFloat(document.getElementById('editor-pnl-amount').value);
            if (isNaN(pnlAmount) || pnlAmount < 0) {
                showToast('Please enter a valid P&L amount', 'error'); return;
            }
            data.manual_pnl = pnlType === 'loss' ? -pnlAmount : pnlAmount;
            data.exit_price = document.getElementById('editor-forex-exit-price').value || 0;
            data.exit_datetime = document.getElementById('editor-forex-exit-dt').value;
            if (!data.exit_datetime) {
                showToast('Please enter exit date/time', 'error'); return;
            }
        } else {
            data.exit_price = document.getElementById('editor-exit-price').value;
            data.exit_datetime = document.getElementById('editor-exit-dt').value;
            if (!data.exit_price || !data.exit_datetime) {
                showToast('Please enter exit price and date/time', 'error'); return;
            }
        }
        data.status = 'closed';
    } else if (editorTradeCache && editorTradeCache.status === 'closed') {
        // Editing a closed trade — preserve/update exit fields
        if (isForex) {
            const pnlType = document.getElementById('editor-pnl-type').value;
            const pnlAmount = parseFloat(document.getElementById('editor-pnl-amount').value);
            if (!isNaN(pnlAmount) && pnlAmount >= 0) {
                data.manual_pnl = pnlType === 'loss' ? -pnlAmount : pnlAmount;
            }
            data.exit_price = document.getElementById('editor-forex-exit-price').value || 0;
            data.exit_datetime = document.getElementById('editor-forex-exit-dt').value;
        } else {
            data.exit_price = document.getElementById('editor-exit-price').value;
            data.exit_datetime = document.getElementById('editor-exit-dt').value;
        }
	    }

	    const result = await apiPatch(`/api/trades/${tradeId}`, data);
	    if (result && result.message) {
	        closeModal('trade-editor-modal');
	        showToast(isClosing ? 'Trade closed!' : 'Trade updated!', 'success');
	        await loadCloseReasons();
	        await loadStrategies();
	        loadTrades();
	        // Refresh open trades view if visible
	        if (document.getElementById('view-open-trades')?.classList.contains('active')) loadOpenTrades();
	        if (document.getElementById('view-review-center')?.classList.contains('active')) loadReviewCenter();
	    } else {
	        showToast(result?.error || 'Error saving trade', 'error');
	    }
  } catch (err) {
    console.error('saveTradeEditor error:', err);
    showToast('Error saving trade: ' + err.message, 'error');
  }
}

// ─── Open Trades View ────────────────────────────────────────

async function loadOpenTrades() {
    const trades = await apiGet('/api/trades?status=open');
    if (!trades) return;

    document.getElementById('open-trades-count').textContent = trades.length;
    document.getElementById('open-trades-long').textContent = trades.filter(t => (t.direction || 'Long') === 'Long').length;
    document.getElementById('open-trades-short').textContent = trades.filter(t => t.direction === 'Short').length;

    const tbody = document.getElementById('open-trades-tbody');
    if (!trades.length) {
        tbody.innerHTML = '<tr><td colspan="12" class="empty-state">No open trades. All positions are closed!</td></tr>';
        return;
    }

	    tbody.innerHTML = trades.map(t => {
	        const dir = t.direction || 'Long';
	        const sym = CURRENCY_SYMBOLS[t.currency] || '₹';
	        const dirClass = dir === 'Long' ? 'dir-badge-long' : 'dir-badge-short';
	        const entryDate = t.entry_datetime ? t.entry_datetime.replace('T', ' ').substring(0, 16) : '—';

	        return `<tr>
	            <td>#${t.id}</td>
	            <td><strong>${escapeHTML(t.instrument)}</strong>${t.entry_notes ? '<br><small class="text-muted">' + escapeHTML(truncate(t.entry_notes, 30)) + '</small>' : ''}</td>
	            <td>${escapeHTML(t.asset_category)}</td>
	            <td><span class="dir-badge ${dirClass}">${escapeHTML(dir)}</span></td>
	            <td>${escapeHTML(t.trading_style)}</td>
	            <td>${t.platform ? escapeHTML(t.platform) : '—'}</td>
	            <td>${t.strategy ? escapeHTML(t.strategy) : '—'}</td>
	            <td>${sym}${formatPrice(t.entry_price, t.asset_category)}</td>
	            <td>${sym}${formatPrice(t.stop_loss, t.asset_category)}</td>
	            <td>${formatPositionSize(t)}</td>
	            <td>${entryDate}</td>
            <td class="action-btns">
                <button class="action-btn close-trade" onclick="openTradeEditor(${t.id}, 'close')" title="Close"><i class="fas fa-door-closed"></i></button>
                <button class="action-btn edit-trade" onclick="openTradeEditor(${t.id}, 'edit')" title="Edit"><i class="fas fa-edit"></i></button>
                <button class="action-btn delete-trade" onclick="deleteTrade(${t.id})" title="Delete"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    }).join('');
}

// ─── Delete Trade ────────────────────────────────────────────

async function deleteTrade(tradeId) {
    if (!confirm('Are you sure you want to delete this trade?')) return;
    const result = await apiDelete(`/api/trades/${tradeId}`);
    if (result.message) {
        showToast('Trade deleted', 'info');
        loadTrades();
        if (document.getElementById('view-open-trades')?.classList.contains('active')) loadOpenTrades();
        if (document.getElementById('view-review-center')?.classList.contains('active')) loadReviewCenter();
    }
}

// ─── Review Center ───────────────────────────────────────────

function formatCurrencyBreakdown(amounts) {
    const entries = Object.entries(amounts || {});
    if (!entries.length) return '0';
    return entries.map(([currency, value]) => {
        const num = Number(value || 0);
        const symbol = CURRENCY_SYMBOLS[currency] || `${currency} `;
        const sign = num > 0 ? '+' : (num < 0 ? '-' : '');
        return `${sign}${symbol}${Math.abs(num).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }).join(' / ');
}

function formatDateLabel(value) {
    if (!value) return '—';
    return value.replace('T', ' ').slice(0, 16);
}

async function loadReviewCenter() {
    const data = await apiGet('/api/review/summary');
    if (!data) return;

    document.getElementById('rv-pending').textContent = data.pending_review_count || 0;
    document.getElementById('rv-discipline').textContent = `${data.discipline_score || 0}%`;
    document.getElementById('rv-execution').textContent = `${data.avg_execution_score || 0}/5`;
    document.getElementById('rv-rule-rate').textContent = `${data.rule_follow_rate || 0}%`;

    renderReviewCalendar(data.daily_pnl || []);
    renderReviewActions(data.action_items || []);
    renderReviewQueue(data.review_queue || []);
    renderMistakeCost(data);
}

function renderReviewActions(items) {
    const container = document.getElementById('review-action-items');
    if (!container) return;
    container.innerHTML = items.length
        ? items.map(item => `<div class="review-action"><i class="fas fa-arrow-right"></i><span>${escapeHTML(item)}</span></div>`).join('')
        : '<div class="empty-state compact">No action items yet.</div>';
}

function renderReviewQueue(queue) {
    const tbody = document.getElementById('review-queue-tbody');
    if (!tbody) return;
    if (!queue.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No closed trades waiting for review.</td></tr>';
        return;
    }
    tbody.innerHTML = queue.map((trade) => {
        const pnl = formatPnl(trade);
        const realizedR = trade.realized_r !== null && trade.realized_r !== undefined ? `${trade.realized_r}R` : '—';
        const exitAt = formatDateLabel(trade.exit_datetime || trade.entry_datetime);
        return `<tr>
            <td>#${trade.id}</td>
            <td><strong>${escapeHTML(trade.instrument)}</strong><br><small class="text-muted">${escapeHTML(trade.asset_category)} · ${escapeHTML(trade.direction || 'Long')}</small></td>
            <td>
                ${trade.playbook_name ? `<span class="badge playbook-badge">${escapeHTML(trade.playbook_name)}</span>` : '<span class="text-muted">No playbook</span>'}
                ${trade.strategy ? `<br><small class="text-muted">${escapeHTML(trade.strategy)}</small>` : ''}
            </td>
            <td class="${pnl.className}">${pnl.value}</td>
            <td>${escapeHTML(realizedR)}</td>
            <td>${escapeHTML(exitAt)}</td>
            <td><button class="btn btn-outline btn-sm" onclick="openTradeEditor(${trade.id}, 'edit')"><i class="fas fa-clipboard-check"></i> Review</button></td>
        </tr>`;
    }).join('');
}

function renderMistakeCost(data) {
    const total = document.getElementById('review-mistake-total');
    const list = document.getElementById('review-mistake-list');
    if (!total || !list) return;
    total.textContent = `Tagged mistake cost: ${formatCurrencyBreakdown(data.mistake_cost_by_currency || {})}`;
    const rows = data.mistake_cost_by_tag || [];
    list.innerHTML = rows.length
        ? rows.map(row => `
            <div class="mistake-row">
                <span>${escapeHTML(row.tag)}</span>
                <strong>${escapeHTML(formatCurrencyBreakdown(row.cost_by_currency || {}))}</strong>
            </div>
        `).join('')
        : '<div class="empty-state compact">Tag losing trades to see what behavior costs the most.</div>';
}

function renderReviewCalendar(days) {
    const container = document.getElementById('review-calendar-heatmap');
    if (!container) return;
    const byDate = new Map(days.map(day => [day.date, day]));
    const today = new Date();
    const cells = [];
    for (let offset = 41; offset >= 0; offset--) {
        const date = new Date(today);
        date.setDate(today.getDate() - offset);
        const key = date.toISOString().slice(0, 10);
        const day = byDate.get(key);
        const pnl = Number(day?.pnl || 0);
        const direction = !day ? 'empty' : (pnl > 0 ? 'win' : (pnl < 0 ? 'loss' : 'flat'));
        const magnitude = Math.min(4, Math.max(1, Math.ceil(Math.log10(Math.abs(pnl) + 1))));
        const title = day
            ? `${key}: ${day.trades} trade${day.trades === 1 ? '' : 's'}, ${formatCurrencyBreakdown(day.pnl_by_currency)}`
            : `${key}: no closed trades`;
        cells.push(`<div class="calendar-cell ${direction} intensity-${magnitude}" title="${escapeHTML(title)}">
            <span>${date.getDate()}</span>
        </div>`);
    }
    container.innerHTML = cells.join('');
}

// ─── Analytics ───────────────────────────────────────────────

async function loadAnalytics() {
    const params = new URLSearchParams();
    const map = {
        'analytics-category': 'category', 'analytics-subcategory': 'subcategory',
        'analytics-style': 'style', 'analytics-direction': 'direction',
        'analytics-platform': 'platform', 'analytics-instrument': 'instrument',
        'analytics-currency': 'currency', 'analytics-psychology': 'psychology',
        'analytics-close-reason': 'close_reason', 'analytics-strategy': 'strategy',
        'analytics-playbook': 'playbook_id',
        'analytics-from': 'date_from', 'analytics-to': 'date_to'
    };
    for (const [elemId, param] of Object.entries(map)) {
        const el = document.getElementById(elemId);
        if (el && el.value) params.set(param, el.value);
    }

    const data = await apiGet(`/api/analytics?${params.toString()}`);
    if (!data) return;

    // Determine currency symbol based on selected currency filter
    const currVal = document.getElementById('analytics-currency')?.value;
    const sym = data.mixed_currency ? '' : (currVal ? (CURRENCY_SYMBOLS[currVal] || currVal) : (data.currencies?.length === 1 ? (CURRENCY_SYMBOLS[data.currencies[0]] || data.currencies[0]) : ''));
    const warning = document.getElementById('analytics-currency-warning');
    if (warning) warning.style.display = data.mixed_currency ? '' : 'none';
    const currencySummary = document.getElementById('analytics-currency-summary');
    if (currencySummary) {
        const parts = Object.entries(data.pnl_by_currency || {}).map(([cur, val]) => {
            const value = Number(val || 0);
            const curSym = CURRENCY_SYMBOLS[cur] || `${escapeHTML(cur)} `;
            const cls = value >= 0 ? 'pnl-positive' : 'pnl-negative';
            return `<span class="${cls}">${curSym}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>`;
        });
        currencySummary.innerHTML = parts.length
            ? `<i class="fas fa-coins"></i> Net P&L by currency: ${parts.join(' ')}`
            : '';
        currencySummary.style.display = parts.length ? '' : 'none';
    }

    document.getElementById('an-total').textContent = data.total_trades;
    document.getElementById('an-wins').textContent = data.winning_trades;
    document.getElementById('an-losses').textContent = data.losing_trades;
    document.getElementById('an-winpct').textContent = data.win_pct + '%';
    document.getElementById('an-avgwin').textContent = sym + data.avg_win.toLocaleString();
    document.getElementById('an-avgloss').textContent = sym + data.avg_loss.toLocaleString();
    const payoffRatio = data.payoff_ratio !== undefined ? data.payoff_ratio : data.win_loss_ratio;
    const adjustedPayoffRatio = data.adjusted_payoff_ratio !== undefined ? data.adjusted_payoff_ratio : data.adjusted_wl_ratio;
    document.getElementById('an-wlratio').textContent = formatRatio(payoffRatio);
    document.getElementById('an-adjwl').textContent = formatRatio(adjustedPayoffRatio);
    document.getElementById('an-profit-factor').textContent = data.profit_factor === null ? '∞' : data.profit_factor;
    document.getElementById('an-expectancy').textContent = sym + data.expectancy.toLocaleString();
    document.getElementById('an-planned-rr').textContent = data.avg_planned_rr ? `${data.avg_planned_rr}R` : '0';
    document.getElementById('an-realized-r').textContent = data.avg_realized_r ? `${data.avg_realized_r}R` : '0R';
    document.getElementById('an-max-dd').textContent = sym + data.max_drawdown.toLocaleString();
    document.getElementById('an-streak').textContent = data.current_streak || '--';
    document.getElementById('an-lgwin').textContent = sym + data.largest_win.toLocaleString();
    document.getElementById('an-lgloss').textContent = sym + data.largest_loss.toLocaleString();
    document.getElementById('an-windur').textContent = data.avg_win_duration_hrs + 'h';
    document.getElementById('an-lossdur').textContent = data.avg_loss_duration_hrs + 'h';

    renderEquityCurve('analyticsEquityCurve', data.equity_curve || []);
    renderMonthlyPnl('analyticsMonthlyPnl', data.monthly_pnl || []);
    renderCategoryPnl('analyticsCategoryPnl', data.category_pnl || {});
    renderStrategyPnl('analyticsStrategyPnl', data.strategy_pnl || {});
    renderStrategyPnl('analyticsPlaybookPnl', data.playbook_pnl || {}, 'No playbook P&L yet', 'Link trades to playbooks to compare setups.');
    renderReturnDistribution('analyticsReturnDistribution', data.return_distribution || []);
}

function clearAnalyticsFilters() {
    const ids = ['analytics-category', 'analytics-subcategory', 'analytics-style',
                 'analytics-direction', 'analytics-platform', 'analytics-instrument',
                 'analytics-currency', 'analytics-psychology', 'analytics-close-reason',
                 'analytics-strategy', 'analytics-playbook', 'analytics-from', 'analytics-to'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    loadAnalytics();
}

// ─── Chart Instances ─────────────────────────────────────────

const chartInstances = {};

function destroyChart(id) {
    if (chartInstances[id]) { chartInstances[id].destroy(); delete chartInstances[id]; }
}

const CHART_COLORS = {
    green: 'rgba(63,173,168,0.88)',
    red: 'rgba(190,74,71,0.88)',
    blue: 'rgba(56,102,136,0.88)',
    purple: 'rgba(117,93,132,0.88)',
    cyan: 'rgba(56,139,150,0.88)',
    orange: 'rgba(201,122,77,0.88)',
    pink: 'rgba(172,88,116,0.88)',
    amber: 'rgba(202,157,82,0.88)',
    teal: 'rgba(63,173,168,0.88)',
    indigo: 'rgba(74,91,142,0.88)',
};
const PALETTE = Object.values(CHART_COLORS);

function cssVar(name, fallback) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
}

function chartGrid() {
    return { color: cssVar('--chart-grid', 'rgba(28,35,43,0.08)') };
}

function chartTick() {
    return { color: cssVar('--chart-tick', '#61706f'), font: { size: 11 } };
}

function chartTooltip() {
    return {
        backgroundColor: cssVar('--chart-tooltip-bg', 'rgba(255,255,255,0.98)'),
        titleColor: cssVar('--chart-tooltip-title', '#162321'),
        bodyColor: cssVar('--chart-tooltip-body', '#465755'),
        borderColor: cssVar('--chart-tooltip-border', 'rgba(28,35,43,0.12)'),
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12,
        displayColors: true,
        boxPadding: 4
    };
}

function renderEmptyChart(canvasId, title, detail) {
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    chartInstances[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: { labels: [], datasets: [] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false }
            },
            scales: {
                x: { display: false },
                y: { display: false }
            }
        },
        plugins: [{
            id: `empty-${canvasId}`,
            afterDraw(chart) {
                const { ctx: chartCtx, chartArea } = chart;
                if (!chartArea) return;
                const centerX = (chartArea.left + chartArea.right) / 2;
                const centerY = (chartArea.top + chartArea.bottom) / 2;
                chartCtx.save();
                chartCtx.textAlign = 'center';
                chartCtx.textBaseline = 'middle';
                chartCtx.fillStyle = cssVar('--text-secondary', '#666666');
                chartCtx.font = '600 15px Arial, sans-serif';
                chartCtx.fillText(title, centerX, centerY - 12);
                chartCtx.fillStyle = cssVar('--text-muted', '#808080');
                chartCtx.font = '12px Arial, sans-serif';
                chartCtx.fillText(detail, centerX, centerY + 14);
                chartCtx.restore();
            }
        }]
    });
}

// ─── Equity Curve ────────────────────────────────────────

function renderEquityCurve(canvasId, equityData) {
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;
    if (!equityData.length) {
        renderEmptyChart(canvasId, 'No closed trades yet', 'Close a trade to build the equity curve.');
        return;
    }

    const labels = equityData.map((d, i) => {
        if (d.date) {
            const dt = d.date.replace('T', ' ').substring(0, 10);
            return dt;
        }
        return `#${i + 1}`;
    });
    const cumData = equityData.map(d => d.cumulative);
    const perTradePnl = equityData.map(d => d.pnl);

    // Determine gradient: green above 0, red below
    const gradient = ctx.createLinearGradient(0, 0, 0, ctx.canvas.parentElement?.clientHeight || 300);
    const lastVal = cumData[cumData.length - 1] || 0;
    if (lastVal >= 0) {
        gradient.addColorStop(0, 'rgba(34,197,94,0.25)');
        gradient.addColorStop(1, 'rgba(34,197,94,0.01)');
    } else {
        gradient.addColorStop(0, 'rgba(239,68,68,0.01)');
        gradient.addColorStop(1, 'rgba(239,68,68,0.25)');
    }

    chartInstances[canvasId] = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Cumulative P&L',
                data: cumData,
                borderColor: lastVal >= 0 ? CHART_COLORS.green : CHART_COLORS.red,
                backgroundColor: gradient,
                borderWidth: 2.5,
                fill: true,
                tension: 0.3,
                pointRadius: cumData.length > 30 ? 0 : 3,
                pointHoverRadius: 5,
                pointBackgroundColor: lastVal >= 0 ? CHART_COLORS.green : CHART_COLORS.red
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    ...chartTooltip(),
                    callbacks: {
                        title: (items) => {
                            const i = items[0].dataIndex;
                            const inst = equityData[i]?.instrument || '';
                            return `Trade #${i + 1}${inst ? ' – ' + inst : ''}`;
                        },
                        afterTitle: (items) => labels[items[0].dataIndex],
                        label: (item) => `Cumulative: ${item.raw >= 0 ? '+' : ''}${item.raw.toLocaleString()}`,
                        afterLabel: (item) => {
                            const pnl = perTradePnl[item.dataIndex];
                            return `This trade: ${pnl >= 0 ? '+' : ''}${pnl.toLocaleString()}`;
                        }
                    }
                }
            },
            scales: {
                x: { display: true, ticks: { ...chartTick(), maxRotation: 45, maxTicksLimit: 12 }, grid: chartGrid() },
                y: { ticks: chartTick(), grid: chartGrid() }
            }
        }
    });
}

// ─── Monthly P&L Bar Chart ───────────────────────────────

function renderMonthlyPnl(canvasId, monthlyData) {
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;
    if (!monthlyData.length) {
        renderEmptyChart(canvasId, 'No monthly P&L yet', 'Closed trades will group by month here.');
        return;
    }

    const labels = monthlyData.map(d => {
        const parts = d.month.split('-');
        const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        return monthNames[parseInt(parts[1]) - 1] + ' ' + parts[0].slice(2);
    });
    const values = monthlyData.map(d => d.pnl);
    const colors = values.map(v => v >= 0 ? CHART_COLORS.green : CHART_COLORS.red);

    chartInstances[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Monthly P&L',
                data: values,
                backgroundColor: colors,
                borderColor: colors.map(c => c.replace('0.88', '1')),
                borderWidth: 1,
                borderRadius: 6,
                barPercentage: 0.7
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    ...chartTooltip(),
                    callbacks: {
                        label: (item) => `P&L: ${item.raw >= 0 ? '+' : ''}${item.raw.toLocaleString()}`
                    }
                }
            },
            scales: {
                x: { ticks: chartTick(), grid: chartGrid() },
                y: { ticks: chartTick(), grid: chartGrid() }
            }
        }
    });
}

// ─── Category P&L Horizontal Bar ─────────────────────────

function renderCategoryPnl(canvasId, categoryData) {
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;
    if (!Object.keys(categoryData || {}).length) {
        renderEmptyChart(canvasId, 'No category P&L yet', 'Closed trades will show market performance here.');
        return;
    }

    const sorted = Object.entries(categoryData).sort((a, b) => b[1] - a[1]);
    const labels = sorted.map(d => d[0]);
    const values = sorted.map(d => d[1]);
    const colors = values.map(v => v >= 0 ? CHART_COLORS.green : CHART_COLORS.red);

    chartInstances[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'P&L',
                data: values,
                backgroundColor: colors,
                borderColor: colors.map(c => c.replace('0.88', '1')),
                borderWidth: 1,
                borderRadius: 6,
                barPercentage: 0.6
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, indexAxis: 'y',
            plugins: {
                legend: { display: false },
                tooltip: {
                    ...chartTooltip(),
                    callbacks: {
                        label: (item) => `P&L: ${item.raw >= 0 ? '+' : ''}${item.raw.toLocaleString()}`
                    }
                }
            },
            scales: {
                x: { ticks: chartTick(), grid: chartGrid() },
                y: { ticks: { ...chartTick(), font: { size: 12, weight: 600 } }, grid: { display: false } }
            }
        }
    });
}

// ─── Strategy P&L Doughnut ───────────────────────────────

function renderStrategyPnl(canvasId, strategyData, emptyTitle = 'No strategy P&L yet', emptyDetail = 'Tag trades with strategies to compare them.') {
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;
    if (!Object.keys(strategyData || {}).length) {
        renderEmptyChart(canvasId, emptyTitle, emptyDetail);
        return;
    }

    const sorted = Object.entries(strategyData).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    const labels = sorted.map(d => d[0]);
    const values = sorted.map(d => d[1]);
    const bgColors = sorted.map((d, i) => PALETTE[i % PALETTE.length]);

    chartInstances[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'P&L',
                data: values,
                backgroundColor: bgColors,
                borderColor: bgColors.map(c => c.replace('0.88', '1')),
                borderWidth: 1,
                borderRadius: 6,
                barPercentage: 0.6
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, indexAxis: 'y',
            plugins: {
                legend: { display: false },
                tooltip: {
                    ...chartTooltip(),
                    callbacks: {
                        label: (item) => `P&L: ${item.raw >= 0 ? '+' : ''}${item.raw.toLocaleString()}`
                    }
                }
            },
            scales: {
                x: { ticks: chartTick(), grid: chartGrid() },
                y: { ticks: { ...chartTick(), font: { size: 12, weight: 600 } }, grid: { display: false } }
            }
        }
    });
}

function renderReturnDistribution(canvasId, distributionData) {
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;
    if (!distributionData.length) {
        renderEmptyChart(canvasId, 'No return distribution yet', 'Closed trades will appear in 2% buckets.');
        return;
    }

    const labels = distributionData.map(d => d.range);
    const values = distributionData.map(d => d.count);

    chartInstances[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Trades',
                data: values,
                backgroundColor: CHART_COLORS.teal,
                borderColor: 'rgba(63,173,168,1)',
                borderWidth: 1,
                borderRadius: 6,
                barPercentage: 0.75
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    ...chartTooltip(),
                    callbacks: {
                        label: (item) => `${item.raw} trade${item.raw === 1 ? '' : 's'}`
                    }
                }
            },
            scales: {
                x: { ticks: { ...chartTick(), maxRotation: 45, maxTicksLimit: 14 }, grid: chartGrid() },
                y: { beginAtZero: true, ticks: { ...chartTick(), precision: 0 }, grid: chartGrid() }
            }
        }
    });
}

// ─── Toast Notifications ─────────────────────────────────────

function showToast(message, type = 'info') {
    let container = document.querySelector('.flash-container');
    if (!container) { container = document.createElement('div'); container.className = 'flash-container'; document.body.appendChild(container); }
    const toast = document.createElement('div');
    toast.className = `flash flash-${type}`;
    const span = document.createElement('span');
    span.textContent = message;
    const close = document.createElement('button');
    close.className = 'flash-close';
    close.type = 'button';
    close.textContent = '×';
    close.addEventListener('click', () => toast.remove());
    toast.append(span, close);
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 400); }, 3500);
}

// ─── Initialize ──────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    loadInstruments();
    loadCloseReasons();
    loadStrategies();
    loadPlaybooks();
    setupInstrumentPicker();
    setupAttachmentInput();
    setTradePricePrecision(document.getElementById('trade-category')?.value || '');

    // Determine initial view from URL path (e.g. /dashboard/trades)
    const pathParts = window.location.pathname.replace(BASE, '').split('/').filter(Boolean);
    const lastSeg = pathParts[pathParts.length - 1] || '';
    const initialView = VIEW_SLUGS[lastSeg] ? lastSeg : 'overview';

    // Replace current history entry with state
    history.replaceState({ view: initialView }, '', window.location.pathname);
    showView(initialView, false);
});

window.addEventListener('tradevault-theme-change', () => {
    if (document.getElementById('view-overview')?.classList.contains('active')) {
        loadOverview();
    }
    if (document.getElementById('view-analytics')?.classList.contains('active')) {
        loadAnalytics();
    }
});

// ─── International Trades (Non-INR) ─────────────────────────

async function loadInternationalTrades() {
    const params = new URLSearchParams();
    // Always exclude INR — show only non-INR
    const currFilter = document.getElementById('intl-filter-currency')?.value;
    const catFilter = document.getElementById('intl-filter-category')?.value;
    const statusFilter = document.getElementById('intl-filter-status')?.value;
    if (catFilter) params.set('category', catFilter);
    if (statusFilter) params.set('status', statusFilter);

    const allTrades = await apiGet(`/api/trades?${params.toString()}`);
    if (!allTrades) return;

    // Client-side filter: only non-INR trades
    let trades = allTrades.filter(t => t.currency && t.currency !== 'INR');
    if (currFilter) trades = trades.filter(t => t.currency === currFilter);

    // Summary stats
    const openCount = trades.filter(t => t.status === 'open').length;
    const closedCount = trades.filter(t => t.status === 'closed').length;
    // Group P&L by currency for display
    const pnlByCurrency = {};
    trades.forEach(t => {
        if (t.status !== 'closed') return;
        const cur = t.currency || 'USD';
        if (!pnlByCurrency[cur]) pnlByCurrency[cur] = 0;
        pnlByCurrency[cur] += Number(t.computed_pnl || 0);
    });

    document.getElementById('intl-total').textContent = trades.length;
    document.getElementById('intl-open').textContent = openCount;
    document.getElementById('intl-closed').textContent = closedCount;

    // Show P&L grouped by currency
    const pnlParts = Object.entries(pnlByCurrency).map(([cur, val]) => {
        const sym = CURRENCY_SYMBOLS[cur] || cur + ' ';
        const cls = val >= 0 ? 'pnl-positive' : 'pnl-negative';
        return `<span class="${cls}">${sym}${val.toFixed(2)}</span>`;
    });
    document.getElementById('intl-pnl').innerHTML = pnlParts.join(' ') || '0';

    // Render table
    const tbody = document.getElementById('intl-trades-tbody');
    if (!trades.length) {
        tbody.innerHTML = '<tr><td colspan="11" class="empty-state">No international trades found. Add trades with a non-INR currency.</td></tr>';
        return;
    }

	    tbody.innerHTML = trades.map(t => {
	        const dir = t.direction || 'Long';
	        const sym = CURRENCY_SYMBOLS[t.currency] || t.currency + ' ';
	        const pnl = formatPnl(t);
	        const dirClass = dir === 'Long' ? 'dir-badge-long' : 'dir-badge-short';

	        return `<tr>
	            <td>#${t.id}</td>
	            <td><strong>${escapeHTML(t.instrument)}</strong></td>
	            <td>${escapeHTML(t.asset_category)}</td>
	            <td><span class="dir-badge ${dirClass}">${escapeHTML(dir)}</span></td>
	            <td><span class="badge badge-currency">${escapeHTML(t.currency)}</span></td>
	            <td>${sym}${formatPrice(t.entry_price, t.asset_category)}</td>
	            <td>${t.exit_price ? sym + formatPrice(t.exit_price, t.asset_category) : '—'}</td>
	            <td>${formatPositionSize(t)}</td>
	            <td class="${pnl.className}">${pnl.value}</td>
	            <td><span class="badge badge-${escapeHTML(t.status)}">${escapeHTML(t.status)}</span></td>
            <td class="action-btns">
                ${t.status === 'open' ? `<button class="action-btn close-trade" onclick="openTradeEditor(${t.id}, 'close')" title="Close"><i class="fas fa-door-closed"></i></button>` : ''}
                <button class="action-btn edit-trade" onclick="openTradeEditor(${t.id}, 'edit')" title="Edit"><i class="fas fa-edit"></i></button>
                <button class="action-btn delete-trade" onclick="deleteTrade(${t.id})" title="Delete"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    }).join('');
}

// ─── Export / Import ─────────────────────────────────────────

function exportTrades() {
    window.location.href = BASE + '/api/trades/export';
}

let importFile = null;

function setupImportUI() {
    const dropZone = document.getElementById('import-drop-zone');
    const fileInput = document.getElementById('import-file-input');
    const btn = document.getElementById('import-btn');
    if (!dropZone || !fileInput) return;

    // Click to browse
    dropZone.onclick = () => fileInput.click();

	    fileInput.onchange = () => {
	        if (fileInput.files.length > 0) {
	            importFile = fileInput.files[0];
	            dropZone.innerHTML = `<i class="fas fa-file-check"></i><p>${escapeHTML(importFile.name)}</p><small>${(importFile.size / 1024).toFixed(1)} KB</small>`;
	            btn.disabled = false;
	        }
	    };

    // Drag & drop
    dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); };
    dropZone.ondragleave = () => dropZone.classList.remove('drag-over');
    dropZone.ondrop = (e) => {
        e.preventDefault(); dropZone.classList.remove('drag-over');
	        if (e.dataTransfer.files.length > 0) {
	            importFile = e.dataTransfer.files[0];
	            dropZone.innerHTML = `<i class="fas fa-file-check"></i><p>${escapeHTML(importFile.name)}</p><small>${(importFile.size / 1024).toFixed(1)} KB</small>`;
	            btn.disabled = false;
	        }
    };
}

async function importTrades() {
	    if (!importFile) { showToast('Please select a file first', 'error'); return; }
	    if (!confirm('Import trades from this file? Existing trades will NOT be deleted. Duplicate instruments and duplicate trades will be skipped.')) return;

    const formData = new FormData();
    formData.append('file', importFile);

    const btn = document.getElementById('import-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Importing...';

    try {
	        const res = await fetch(BASE + '/api/trades/import', {
	            method: 'POST',
	            headers: { 'X-CSRF-Token': CSRF_TOKEN },
	            credentials: 'same-origin',
	            body: formData
	        });
        const data = await res.json();
        const resultDiv = document.getElementById('import-result');
        resultDiv.style.display = '';

	        if (data.error) {
	            resultDiv.innerHTML = `<div class="import-error"><i class="fas fa-times-circle"></i> ${escapeHTML(data.error)}</div>`;
	            showToast(data.error, 'error');
	        } else {
	            resultDiv.innerHTML = `<div class="import-success">
	                <i class="fas fa-check-circle"></i> ${escapeHTML(data.message)}
	            </div>`;
            showToast('Import successful!', 'success');
        }
    } catch (err) {
        showToast('Import failed: ' + err.message, 'error');
	    } finally {
	        btn.disabled = false;
	        btn.innerHTML = '<i class="fas fa-file-import"></i> Import Data';
	        importFile = null;
	        btn.disabled = true;
	        const input = document.getElementById('import-file-input');
	        if (input) input.value = '';
	        const dropZone = document.getElementById('import-drop-zone');
	        if (dropZone) {
	            dropZone.innerHTML = '<i class="fas fa-cloud-upload-alt"></i><p>Click to select file or drag &amp; drop</p><small>Only .json files from TradeVault export</small>';
	        }
	    }
	}
