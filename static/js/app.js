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

let userInstruments = [];
let selectedInstrument = null;
let userCloseReasons = [];
let userStrategies = [];
let overviewCategory = '';       // current overview tab

// ─── View Management ─────────────────────────────────────────

const VIEW_SLUGS = {
    'overview': 'overview', 'trades': 'trades', 'open-trades': 'open-trades',
    'add-trade': 'add-trade', 'analytics': 'analytics', 'international': 'international',
    'export-import': 'export-import'
};
const VIEW_TITLES = {
    'overview': 'Overview', 'trades': 'My Trades', 'open-trades': 'Open Trades',
    'add-trade': 'Add Trade', 'analytics': 'Analytics', 'international': 'International Trades',
    'export-import': 'Export / Import'
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
    if (viewName === 'add-trade') loadInstruments();
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
        dropdown.innerHTML = '<div class="dd-empty">No saved instruments. Type a new name.</div>';
        dropdown.classList.add('open');
        return;
    }
    dropdown.innerHTML = filtered.map(inst => `
        <div class="dd-item" data-id="${inst.id}">
            <span class="dd-name">${inst.name}</span>
            <span class="dd-meta">${inst.asset_category}${inst.platform ? ' · ' + inst.platform : ''}</span>
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
        <div class="dd-item dd-platform-item"><span class="dd-name">${p}</span></div>
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
        <div class="dd-item dd-strategy-item"><span class="dd-name">${s}</span></div>
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
        CATEGORIES[category].subcategories.forEach(s => { subSelect.innerHTML += `<option>${s}</option>`; });
        CATEGORIES[category].styles.forEach(s => { styleSelect.innerHTML += `<option>${s}</option>`; });
    }
}

function updateTradeFormDropdowns() {
    const cat = document.getElementById('trade-category').value;
    const subSelect = document.getElementById('trade-subcategory');
    const styleSelect = document.getElementById('trade-style');
    subSelect.innerHTML = '<option value="">None</option>';
    styleSelect.innerHTML = '<option value="">Select Style</option>';
    if (cat && CATEGORIES[cat]) {
        CATEGORIES[cat].subcategories.forEach(s => { subSelect.innerHTML += `<option>${s}</option>`; });
        CATEGORIES[cat].styles.forEach(s => { styleSelect.innerHTML += `<option>${s}</option>`; });
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
}

document.getElementById('filter-category')?.addEventListener('change', () => {
    updateSubcategoryOptions('filter-category', 'filter-subcategory', 'filter-style');
});
document.getElementById('trade-category')?.addEventListener('change', () => updateTradeFormDropdowns());
document.getElementById('analytics-category')?.addEventListener('change', () => {
    updateSubcategoryOptions('analytics-category', 'analytics-subcategory', 'analytics-style');
});

// ─── Populate dynamic filter selects ─────────────────────────

async function populateDynamicFilters() {
    await loadInstruments();
    await loadCloseReasons();
    await loadStrategies();

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

    // Close reason dropdown in editor modal — rebuild to avoid duplicates
    const editorCR = document.getElementById('editor-close-reason');
    if (editorCR) {
        const currentVal = editorCR.value;
        editorCR.innerHTML = '<option value="">Select reason...</option>';
        allReasons.forEach(r => {
            editorCR.innerHTML += `<option value="${r}">${r}</option>`;
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
    items.forEach(item => { sel.innerHTML += `<option value="${item}">${item}</option>`; });
    sel.value = current; // preserve selection
}

// ─── API Helpers ─────────────────────────────────────────────

const BASE = window.TRADEVAULT_BASE || '';
let wakeupToastActive = false;

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
    toast.innerHTML = `<span><i class="fas fa-hourglass-half"></i> ${message}</span>`;
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
                showWakeupToast('Free server may be waking up. This can take up to ~60 seconds.');
            }, 4500);

            const res = await fetch(fullUrl, options);
            clearTimeout(wakeupTimer);

            if (res.status === 401 || res.redirected) {
                window.location.href = BASE + '/login';
                return null;
            }

            const isRetryable = res.status >= 500 || res.status === 429;
            if (isRetryable && attempt < retries) {
                showWakeupToast('Server is waking up. Retrying automatically...');
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
                showWakeupToast('Waking free server. Retrying...');
                await sleep(2000 * (attempt + 1));
                continue;
            }
            showWakeupToast('Server is still waking up. Please retry in a few seconds.');
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
}

async function apiPut(url, data) {
    return requestJSON(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
}

async function apiPatch(url, data) {
    return requestJSON(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
}

async function apiDelete(url) {
    return requestJSON(url, { method: 'DELETE' });
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
        if (cat && CATEGORIES[cat]) CATEGORIES[cat].subcategories.forEach(s => { subSel.innerHTML += `<option>${s}</option>`; });
    }
    if (styleSel) {
        styleSel.innerHTML = '<option value="">All Styles</option>';
        if (cat && CATEGORIES[cat]) CATEGORIES[cat].styles.forEach(s => { styleSel.innerHTML += `<option>${s}</option>`; });
    }

    const qs = getOverviewFilterParams();
    const analytics = await apiGet(`/api/analytics?${qs}`);
    const trades = await apiGet(`/api/trades?status=open${overviewCategory ? '&category=' + encodeURIComponent(overviewCategory) : ''}`);

    if (analytics) {
        document.getElementById('ov-total').textContent = analytics.total_trades;
        document.getElementById('ov-wins').textContent = analytics.winning_trades;
        document.getElementById('ov-losses').textContent = analytics.losing_trades;
        document.getElementById('ov-winrate').textContent = analytics.win_pct + '%';
        document.getElementById('ov-wlratio').textContent = analytics.win_loss_ratio;
        renderEquityCurve('overviewEquityCurve', analytics.equity_curve || []);
        renderMonthlyPnl('overviewMonthlyPnl', analytics.monthly_pnl || []);
    }
    if (trades) {
        document.getElementById('ov-open').textContent = trades.length;
    }
}

function clearOverviewFilters() {
    ['ov-filter-subcategory','ov-filter-style','ov-filter-direction','ov-filter-platform',
     'ov-filter-instrument','ov-filter-psychology','ov-filter-close-reason','ov-filter-strategy'].forEach(id => {
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
        tbody.innerHTML = '<tr><td colspan="15" class="empty-state">No trades found. Start by adding a trade!</td></tr>';
        return;
    }

    tbody.innerHTML = trades.map(t => {
        const dir = t.direction || 'Long';
        const sym = CURRENCY_SYMBOLS[t.currency] || '₹';
        const isForex = t.asset_category === 'Forex';
        let pnl = '—';
        if (t.status === 'closed') {
            if (isForex && t.manual_pnl !== null && t.manual_pnl !== undefined) {
                pnl = parseFloat(t.manual_pnl).toFixed(2);
            } else if (!isForex && t.exit_price) {
                pnl = (dir === 'Short'
                    ? (t.entry_price - t.exit_price) * t.position_size
                    : (t.exit_price - t.entry_price) * t.position_size).toFixed(2);
            }
        }
        const pnlClass = pnl !== '—' ? (parseFloat(pnl) >= 0 ? 'pnl-positive' : 'pnl-negative') : '';
        const pnlDisplay = pnl !== '—' ? (parseFloat(pnl) >= 0 ? `+${sym}${pnl}` : `${sym}${pnl}`) : '—';
        const dirClass = dir === 'Long' ? 'dir-badge-long' : 'dir-badge-short';

        const psyBadge = t.psychology
            ? `<span class="psy-badge psy-${t.psychology.toLowerCase()}">${t.psychology}${t.psychology_detail ? ' (' + t.psychology_detail.replace('Weak psychology during ','') + ')' : ''}</span>`
            : '<span class="text-muted">—</span>';

        return `<tr>
            <td>#${t.id}</td>
            <td><strong>${t.instrument}</strong>${t.entry_notes ? '<br><small class="text-muted">' + truncate(t.entry_notes, 30) + '</small>' : ''}</td>
            <td>${t.asset_category}</td>
            <td><span class="dir-badge ${dirClass}">${dir}</span></td>
            <td>${t.trading_style}</td>
            <td>${t.platform || '—'}</td>
            <td>${sym}${parseFloat(t.entry_price).toFixed(2)}</td>
            <td>${t.exit_price ? sym + parseFloat(t.exit_price).toFixed(2) : '—'}</td>
            <td>${sym}${parseFloat(t.stop_loss).toFixed(2)}</td>
            <td>${t.position_size}</td>
            <td class="${pnlClass}">${pnlDisplay}</td>
            <td>${t.strategy || '<span class="text-muted">—</span>'}</td>
            <td>${psyBadge}</td>
            <td><span class="badge badge-${t.status}">${t.status}</span></td>
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
     'filter-platform','filter-instrument','filter-psychology','filter-close-reason','filter-strategy'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
    });
    document.getElementById('filter-currency').value = '';
    document.getElementById('filter-subcategory').innerHTML = '<option value="">All</option>';
    document.getElementById('filter-style').innerHTML = '<option value="">All Styles</option>';
    document.getElementById('filter-from').value = '';
    document.getElementById('filter-to').value = '';
    loadTrades();
}

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
        position_size: document.getElementById('trade-size').value,
        direction: direction,
        instrument_type: document.getElementById('trade-instrument-type').value || '',
        lot_size: document.getElementById('trade-lot-size').value || '',
        platform: document.getElementById('trade-platform').value.trim() || '',
        currency: document.getElementById('trade-currency').value || 'INR',
        entry_notes: document.getElementById('trade-entry-notes').value.trim() || '',
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
}

// ─── Modal Helper ────────────────────────────────────────────

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// ─── Unified Trade Editor Modal ──────────────────────────────

let editorTradeCache = null;
let editorMode = 'edit'; // 'close' or 'edit'

async function openTradeEditor(tradeId, mode) {
  try {
    await Promise.all([loadStrategies(), loadCloseReasons(), loadInstruments()]);
    const trades = await apiGet('/api/trades');
    const trade = trades?.find(t => t.id === tradeId);
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
    document.getElementById('editor-subcategory').value = trade.subcategory || '';
    document.getElementById('editor-style').value = trade.trading_style || '';
    document.getElementById('editor-direction').value = trade.direction || 'Long';
    document.getElementById('editor-instrument-type').value = trade.instrument_type || '';
    document.getElementById('editor-platform').value = trade.platform || '';
    document.getElementById('editor-currency').value = trade.currency || 'INR';
    document.getElementById('editor-strategy').value = trade.strategy || '';
    document.getElementById('editor-entry-price').value = trade.entry_price || '';
    document.getElementById('editor-entry-dt').value = trade.entry_datetime || '';
    document.getElementById('editor-stop-loss').value = trade.stop_loss || '';
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
        CATEGORIES[cat].subcategories.forEach(s => { subSelect.innerHTML += `<option>${s}</option>`; });
        CATEGORIES[cat].styles.forEach(s => { styleSelect.innerHTML += `<option>${s}</option>`; });
    }
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
        entry_price: document.getElementById('editor-entry-price').value,
        entry_datetime: document.getElementById('editor-entry-dt').value,
        stop_loss: document.getElementById('editor-stop-loss').value,
        lot_size: document.getElementById('editor-lot-size').value,
        position_size: document.getElementById('editor-position-size').value,
        entry_notes: document.getElementById('editor-entry-notes').value.trim(),
        close_reason: closeReason,
        psychology: document.getElementById('editor-psychology').value,
        psychology_detail: document.getElementById('editor-psychology-detail').value,
        exit_notes: document.getElementById('editor-exit-notes').value.trim()
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
    closeModal('trade-editor-modal');
    if (result.message) {
        showToast(isClosing ? 'Trade closed!' : 'Trade updated!', 'success');
        await loadCloseReasons();
        await loadStrategies();
        loadTrades();
        // Refresh open trades view if visible
        if (document.getElementById('view-open-trades')?.classList.contains('active')) loadOpenTrades();
    } else {
        showToast(result.error || 'Error saving trade', 'error');
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
            <td><strong>${t.instrument}</strong>${t.entry_notes ? '<br><small class="text-muted">' + truncate(t.entry_notes, 30) + '</small>' : ''}</td>
            <td>${t.asset_category}</td>
            <td><span class="dir-badge ${dirClass}">${dir}</span></td>
            <td>${t.trading_style}</td>
            <td>${t.platform || '—'}</td>
            <td>${t.strategy || '—'}</td>
            <td>${sym}${parseFloat(t.entry_price).toFixed(2)}</td>
            <td>${sym}${parseFloat(t.stop_loss).toFixed(2)}</td>
            <td>${t.position_size}</td>
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
    }
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
    const sym = currVal ? (CURRENCY_SYMBOLS[currVal] || currVal) : '';

    document.getElementById('an-total').textContent = data.total_trades;
    document.getElementById('an-wins').textContent = data.winning_trades;
    document.getElementById('an-losses').textContent = data.losing_trades;
    document.getElementById('an-winpct').textContent = data.win_pct + '%';
    document.getElementById('an-avgwin').textContent = sym + data.avg_win.toLocaleString();
    document.getElementById('an-avgloss').textContent = sym + data.avg_loss.toLocaleString();
    document.getElementById('an-wlratio').textContent = data.win_loss_ratio;
    document.getElementById('an-adjwl').textContent = data.adjusted_wl_ratio;
    document.getElementById('an-lgwin').textContent = sym + data.largest_win.toLocaleString();
    document.getElementById('an-lgloss').textContent = sym + data.largest_loss.toLocaleString();
    document.getElementById('an-windur').textContent = data.avg_win_duration_hrs + 'h';
    document.getElementById('an-lossdur').textContent = data.avg_loss_duration_hrs + 'h';

    renderEquityCurve('analyticsEquityCurve', data.equity_curve || []);
    renderMonthlyPnl('analyticsMonthlyPnl', data.monthly_pnl || []);
    renderCategoryPnl('analyticsCategoryPnl', data.category_pnl || {});
    renderStrategyPnl('analyticsStrategyPnl', data.strategy_pnl || {});
}

function clearAnalyticsFilters() {
    const ids = ['analytics-category', 'analytics-subcategory', 'analytics-style',
                 'analytics-direction', 'analytics-platform', 'analytics-instrument',
                 'analytics-currency', 'analytics-psychology', 'analytics-close-reason',
                 'analytics-strategy', 'analytics-from', 'analytics-to'];
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
    green: 'rgba(34,197,94,0.85)',
    red: 'rgba(239,68,68,0.85)',
    blue: 'rgba(59,130,246,0.85)',
    purple: 'rgba(139,92,246,0.85)',
    cyan: 'rgba(6,182,212,0.85)',
    orange: 'rgba(249,115,22,0.85)',
    pink: 'rgba(236,72,153,0.85)',
    amber: 'rgba(245,158,11,0.85)',
    teal: 'rgba(20,184,166,0.85)',
    indigo: 'rgba(99,102,241,0.85)',
};
const PALETTE = Object.values(CHART_COLORS);

const CHART_GRID = { color: 'rgba(255,255,255,0.04)' };
const CHART_TICK = { color: '#666688', font: { size: 11 } };
const CHART_TOOLTIP = {
    backgroundColor: 'rgba(12,13,36,0.95)', titleColor: '#e8e8f0',
    bodyColor: '#a0a0c0', borderColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, cornerRadius: 10, padding: 12, displayColors: true,
    boxPadding: 4
};

// ─── Equity Curve ────────────────────────────────────────

function renderEquityCurve(canvasId, equityData) {
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx || !equityData.length) return;

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
                    ...CHART_TOOLTIP,
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
                x: { display: true, ticks: { ...CHART_TICK, maxRotation: 45, maxTicksLimit: 12 }, grid: CHART_GRID },
                y: { ticks: CHART_TICK, grid: CHART_GRID }
            }
        }
    });
}

// ─── Monthly P&L Bar Chart ───────────────────────────────

function renderMonthlyPnl(canvasId, monthlyData) {
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx || !monthlyData.length) return;

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
                borderColor: colors.map(c => c.replace('0.85', '1')),
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
                    ...CHART_TOOLTIP,
                    callbacks: {
                        label: (item) => `P&L: ${item.raw >= 0 ? '+' : ''}${item.raw.toLocaleString()}`
                    }
                }
            },
            scales: {
                x: { ticks: CHART_TICK, grid: CHART_GRID },
                y: { ticks: CHART_TICK, grid: CHART_GRID }
            }
        }
    });
}

// ─── Category P&L Horizontal Bar ─────────────────────────

function renderCategoryPnl(canvasId, categoryData) {
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx || !Object.keys(categoryData).length) return;

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
                borderColor: colors.map(c => c.replace('0.85', '1')),
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
                    ...CHART_TOOLTIP,
                    callbacks: {
                        label: (item) => `P&L: ${item.raw >= 0 ? '+' : ''}${item.raw.toLocaleString()}`
                    }
                }
            },
            scales: {
                x: { ticks: CHART_TICK, grid: CHART_GRID },
                y: { ticks: { ...CHART_TICK, font: { size: 12, weight: 600 } }, grid: { display: false } }
            }
        }
    });
}

// ─── Strategy P&L Doughnut ───────────────────────────────

function renderStrategyPnl(canvasId, strategyData) {
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx || !Object.keys(strategyData).length) return;

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
                borderColor: bgColors.map(c => c.replace('0.85', '1')),
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
                    ...CHART_TOOLTIP,
                    callbacks: {
                        label: (item) => `P&L: ${item.raw >= 0 ? '+' : ''}${item.raw.toLocaleString()}`
                    }
                }
            },
            scales: {
                x: { ticks: CHART_TICK, grid: CHART_GRID },
                y: { ticks: { ...CHART_TICK, font: { size: 12, weight: 600 } }, grid: { display: false } }
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
    toast.innerHTML = `<span>${message}</span><button class="flash-close" onclick="this.parentElement.remove()">&times;</button>`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 400); }, 3500);
}

// ─── Initialize ──────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    loadInstruments();
    loadCloseReasons();
    loadStrategies();
    setupInstrumentPicker();

    // Determine initial view from URL path (e.g. /dashboard/trades)
    const pathParts = window.location.pathname.replace(BASE, '').split('/').filter(Boolean);
    const lastSeg = pathParts[pathParts.length - 1] || '';
    const initialView = VIEW_SLUGS[lastSeg] ? lastSeg : 'overview';

    // Replace current history entry with state
    history.replaceState({ view: initialView }, '', window.location.pathname);
    showView(initialView, false);
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
    let totalPnl = 0;
    // Group P&L by currency for display
    const pnlByCurrency = {};
    trades.forEach(t => {
        if (t.status !== 'closed') return;
        const cur = t.currency || 'USD';
        if (!pnlByCurrency[cur]) pnlByCurrency[cur] = 0;
        let pnl = 0;
        const isForex = t.asset_category === 'Forex';
        if (isForex && t.manual_pnl !== null && t.manual_pnl !== undefined) {
            pnl = t.manual_pnl;
        } else if (t.exit_price) {
            const dir = t.direction || 'Long';
            pnl = dir === 'Short'
                ? (t.entry_price - t.exit_price) * t.position_size
                : (t.exit_price - t.entry_price) * t.position_size;
        }
        pnlByCurrency[cur] += pnl;
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
        const isForex = t.asset_category === 'Forex';
        let pnl = '—';
        if (t.status === 'closed') {
            if (isForex && t.manual_pnl !== null && t.manual_pnl !== undefined) {
                pnl = parseFloat(t.manual_pnl).toFixed(2);
            } else if (t.exit_price) {
                pnl = (dir === 'Short'
                    ? (t.entry_price - t.exit_price) * t.position_size
                    : (t.exit_price - t.entry_price) * t.position_size).toFixed(2);
            }
        }
        const pnlClass = pnl !== '—' ? (parseFloat(pnl) >= 0 ? 'pnl-positive' : 'pnl-negative') : '';
        const pnlDisplay = pnl !== '—' ? (parseFloat(pnl) >= 0 ? `+${sym}${pnl}` : `${sym}${pnl}`) : '—';
        const dirClass = dir === 'Long' ? 'dir-badge-long' : 'dir-badge-short';

        return `<tr>
            <td>#${t.id}</td>
            <td><strong>${t.instrument}</strong></td>
            <td>${t.asset_category}</td>
            <td><span class="dir-badge ${dirClass}">${dir}</span></td>
            <td><span class="badge badge-currency">${t.currency}</span></td>
            <td>${sym}${parseFloat(t.entry_price).toFixed(t.asset_category === 'Forex' ? 5 : 2)}</td>
            <td>${t.exit_price ? sym + parseFloat(t.exit_price).toFixed(t.asset_category === 'Forex' ? 5 : 2) : '—'}</td>
            <td>${t.position_size}</td>
            <td class="${pnlClass}">${pnlDisplay}</td>
            <td><span class="badge badge-${t.status}">${t.status}</span></td>
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
            dropZone.innerHTML = `<i class="fas fa-file-check"></i><p>${importFile.name}</p><small>${(importFile.size / 1024).toFixed(1)} KB</small>`;
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
            dropZone.innerHTML = `<i class="fas fa-file-check"></i><p>${importFile.name}</p><small>${(importFile.size / 1024).toFixed(1)} KB</small>`;
            btn.disabled = false;
        }
    };
}

async function importTrades() {
    if (!importFile) { showToast('Please select a file first', 'error'); return; }
    if (!confirm('Import trades from this file? Existing trades will NOT be deleted. Duplicate instruments will be skipped.')) return;

    const formData = new FormData();
    formData.append('file', importFile);

    const btn = document.getElementById('import-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Importing...';

    try {
        const res = await fetch(BASE + '/api/trades/import', { method: 'POST', body: formData });
        const data = await res.json();
        const resultDiv = document.getElementById('import-result');
        resultDiv.style.display = '';

        if (data.error) {
            resultDiv.innerHTML = `<div class="import-error"><i class="fas fa-times-circle"></i> ${data.error}</div>`;
            showToast(data.error, 'error');
        } else {
            resultDiv.innerHTML = `<div class="import-success">
                <i class="fas fa-check-circle"></i> ${data.message}
            </div>`;
            showToast('Import successful!', 'success');
        }
    } catch (err) {
        showToast('Import failed: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-file-import"></i> Import Data';
        importFile = null;
    }
}
