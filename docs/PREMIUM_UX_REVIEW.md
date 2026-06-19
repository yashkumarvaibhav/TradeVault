# TradeVault — Premium UX Review & Implementation Backlog

**Status:** REVIEW COMPLETE — implementation is explicitly **on hold** until the owner approves this document and asks to proceed.
**Produced:** 2026-06-18; reference-image audit completed 2026-06-19.
**How:** A disposable `uxreview` account was seeded with 30 realistic trades (8 open / 22 closed / 15 reviewed across all 5 asset classes, 3 playbooks). Playwright captured 24 screenshots (every view, light + dark, mobile, plus the Add-Trade form and Close/Review modals). Three principal-level product-design reviews covered (A) data-entry & trade lifecycle, (B) data viewing & analytics, and (C) brand / visual system / a11y. The rendered app and underlying code were reviewed together. Finally, all 14 external reference images (`i1`–`i14`) were inspected at original resolution and translated into TradeVault-specific visual, interaction, and feature recommendations in Appendix D.

---

## ⛔ HARD RULE — Preserve all existing functionality

When implementing, **do not remove or regress any existing feature.** Improvements are additive/refactoring of presentation, never feature deletion. Inventory of features that must survive every change:

- **Manual trade entry** across 5 asset classes (Equity, Index, Forex, Commodity, US Index) with subcategories, trading styles, instrument types, lot sizes, platforms, and currency (INR/USD).
- **Instrument autocomplete** with saved-default backfill (category/subcat/style/lot/platform).
- **Reusable libraries:** strategies, close reasons, and **playbooks** (market scope, setup rules, checklist, notes, active/archive).
- **Live Risk Preview** (1R risk, planned R:R, effective units, position value) before save.
- **Long/Short** direction; directional stop/target validation.
- **Trade close** (exit price/date, close reason, psychology + detail, exit notes; **Forex manual P&L** path).
- **Trade attachments** (per-trade image uploads).
- **Review fields:** execution score (1–5), rule-followed, mistake tags, setup quality, review notes, reviewed-at.
- **Review Center:** discipline score, rule-follow rate, mistake-cost-by-tag, 42-day outcome heatmap, review queue, "one concrete adjustment".
- **Analytics:** profit factor, expectancy/trade, adjusted W/L, avg planned R:R, avg realized R, max drawdown, current streak, largest win/loss, avg win/loss hold duration, equity curve, monthly P&L, category P&L, strategy P&L, return distribution, per-currency net P&L, mixed-currency warning.
- **International** section (non-INR kept separate by design).
- **Filtering:** subcategory, style, direction, platform, instrument, currency, psychology, close reason, strategy, playbook, date range; Overview category tabs (Overall/Equity/Index/Forex/Commodity/US Index).
- **Export / Import** (TradeVault JSON).
- **Auth & security:** register, TOTP recovery setup, username+password login, forgot-password via TOTP, unlock-account via TOTP, change password, failed-attempt account lockout, CSRF protection.
- **Theming:** light/dark with persistence and theme-aware charts.

> If a recommendation below appears to conflict with an existing feature, **keep the feature** and adapt the recommendation.

---

## Consolidated, prioritized synthesis

Reviewers agreed the foundation is strong (not a generic admin template). Strengths to **preserve and build on**: the live Risk Preview on Add Trade, asset-aware position sizing, instrument autocomplete, proper (token-driven, theme-reactive) chart theming, the Review Center concept, disciplined design tokens, and the new logo system.

### 🔴 P0 — Correctness & trust (silently undermine the "premium" feel)
1. **"W/L Ratio 6.16" is mislabeled.** It is the *payoff ratio* (avg win ÷ avg loss); a 54.55% win rate is a ~1.2 count ratio. Two contradictory headline numbers destroy trust. → relabel "Payoff Ratio (Avg W ÷ Avg L)" and/or add a true W:L; unify with the Analytics label.
2. **INR + USD summed as raw numbers** in Overview equity curve, Monthly P&L, and analytics totals; mixed-currency warning only on Analytics, not the default Overview. → propagate warning + per-currency split to Overview; one equity line per currency; long-term store FX-at-close.
3. **Close-trade opens the entire entry form**, exit inputs below the fold (risk of corrupting historical entry data). → focused exit panel at top; collapse entry details to a read-only summary with "Edit entry details" disclosure.
4. **No realized P&L / R preview before confirming a close.** → mirror the Risk Preview as a Close Preview (realized P&L, realized R, one-line verdict), live on input; Forex derives R from manual amount ÷ original 1R.
5. **Accessibility:** no `:focus-visible` anywhere; no `prefers-reduced-motion`.
6. **Brand inconsistency:** 4 of 6 auth pages (setup-totp, forgot-password, change-password, unlock-account) still use FontAwesome glyphs in the logo chip instead of the new icon mark.

### 🟠 P1 — Clearly worth doing
- Add-trade **currency always defaults ₹INR** even for Forex/US Index → wrong-currency risk math; persist currency on instrument and inherit it.
- Add-trade **entry date/time not pre-filled** (close pre-fills "now") → pre-fill local now.
- **Validation only as a generic, auto-dismissing toast** with raw schema field names (`asset_category`) → inline, field-anchored errors; map names to labels; don't auto-dismiss errors.
- **Review flow tedious** (review fields buried under 5 sections) → lead with review fields; 1-click score/quality chips.
- **Overview hierarchy inverted:** 6 count cards (no Net P&L) + a 14-field filter wall buries the charts → lead with Net P&L / Profit Factor / Expectancy; collapse filters to a popover/below charts.
- **My Trades table won't scale:** no pagination, no column sorting, 17 columns, numbers left-aligned → server pagination, click-to-sort, right-align + `tabular-nums`, column de-densification, sticky header.
- **Tabular figures missing** on all headline numbers → add `font-variant-numeric: tabular-nums`.
- **Charts** lack currency on axes/tooltips, compact notation, zero baseline; duplicate equity X-labels → fix all.
- **Dense UI typography needs tighter hierarchy** → retain the identity-mandated Arial + Newsreader pairing, but improve weights, line-height, label tracking, and tabular numeral treatment. Do not silently replace the approved brand typography with the references' generic sans stack.
- Dark **muted-gray text fails contrast** (~4.0:1) → lighten `--text-faint`.
- Hero **"View Analytics" CTA links to wrong section** + weak outline on dark → fix anchor + strengthen border.
- Leftover **`fa-chart-line` (old motif) in hero badge** → swap glyph.
- **Password `minlength=6`** undercuts the security pitch → raise to 12 + strength hint (coordinate backend).

### 🟡 P2 — Polish & depth
- **Missing premium analytics:** R-multiple histogram, day-of-week & time-of-day performance, per-strategy/playbook win-rate + expectancy, drawdown (underwater) curve, MAE/MFE (roadmap; needs capture).
- Open Trades: icon-only "Close" beside destructive Delete; no aggregate open-risk (Σ 1R) summary.
- No sticky mobile Save on Add Trade; Risk Preview as 2×2 on mobile.
- Flat shadow/radius scale (light `--shadow` == `--shadow-lg`); barren auth pages (no wordmark/atmosphere); cryptic "2W" streak + unexplained "∞" profit factor; International per-currency + symbol; truncated/clipped playbook rules; mockup traffic-light dots use semantic tokens; floating theme FAB generic on auth.
- **Microcopy rewrites** across landing, auth, and form success/error strings.
- Introduce a **dedicated trade-detail canvas** (not another mega-modal): trade result header, execution/risk facts, rules/review, chart attachments, and notes in one connected workspace.
- Turn the existing **42-day outcome map into a calendar drill-down** and add a year-intensity mode; selecting a day reveals that day's trades without losing the current Review Center.
- Add **global command search** across trades, instruments, playbooks, strategies, and review notes; this supplements rather than replaces filters and navigation.
- Later-phase product depth: **print/PDF performance report**, R-normalized what-if/Monte Carlo analysis, and richer notes. Keep JSON import/export and every existing analytics surface.

### Single highest-leverage move
Split the one mega-modal into **Close / Review / Edit** intents (shared template, mode-specific ordering/title/CTA). Resolves P0 #3, P0 #4, and the review-tedium P1 together.

### Visual north star from i1–i14

TradeVault should feel like an **editorial trading workstation**: calm white or ink-dark foundations, thin structural borders, compact but readable data, and a bento-like composition whose size hierarchy tells the user what to inspect first. The references are rich because related information is composed into task-specific workspaces—not because every surface is colorful. Keep TradeVault teal, Newsreader headings, Arial UI text, light/dark parity, and all existing product depth. Borrow the references' information architecture, direct manipulation, immediate calculations, and disciplined density; do not copy their purple/blue identity, lion mark, or option-centric assumptions.

**Decision precedence:** Appendices A–C preserve the original specialist reviews for evidence and traceability. Where they conflict with the consolidated synthesis, Appendix D, the HARD RULE, or `graphic-identity.md`, the consolidated decisions win. In particular, the earlier suggestion to replace Arial with Inter is **not accepted** in this final review; the approved Newsreader + Arial system remains.

---
---

# APPENDIX A — Full reviewer report: Data-Entry & Trade-Lifecycle
*(verbatim)*

# TradeVault — Data-Entry & Trade-Lifecycle UX Review
*Scope: Add Trade, Close Trade, Review/Edit, Open Trades, Review Center. Principal-level, opinionated.*

## What's already excellent (preserve this)

- **The Risk Preview panel on Add Trade is genuinely premium.** Live 1R Risk / Planned R:R / Effective Units / Position Value, plus the coaching note that turns red ("R:R is below 2R. Make sure the setup justifies the risk.") and validates stop-vs-entry direction *before* save (`updateRiskPreview`, app.js:412). This is the single best interaction in the flow and exactly the kind of thing serious traders trust.
- **Asset-aware position sizing.** Switching category swaps the size unit hint between (Shares)/(Lots), reveals Lot Size and Futures/Options type, and folds lot size into effective units for risk math (`updatePositionFields`, app.js:358). That's real domain understanding.
- **Instrument autocomplete with default-loading.** Selecting a saved instrument backfills category, subcategory, style, lot size, platform and confirms with `✓ Loaded defaults for "X"` (app.js:248-263). Excellent friction reduction for repeat entry.
- **Forex manual-P&L is handled as a first-class path** with a dedicated profit/loss + amount UI and an explicit "Forex trades require manual P&L entry" notice (dashboard.html:1057). Correct and honest about the asset class.
- **Server-side validation is robust and directional** (long stop below entry, target above entry, lot size required for lot-based assets) — app.py:941-953. The logic is sound; only the *wording/surfacing* needs work (below).
- **Review Center framing is sharp.** "Turn closed trades into one concrete adjustment," Mistake Cost by tag, and the Daily Outcome Map heatmap give the review loop a real point of view rather than a dumb table.

---

## Findings (prioritized)

### [P0] Closing a trade opens the entire entry form — exit inputs are below the fold
**Location:** Close Trade modal (`#trade-editor-modal`, opened via `openTradeEditor(id,'close')`). Screenshots `modal-close-trade-dark.png` / `-light.png`.
**Issue:** "Close Trade #31" opens with **Asset & Instrument** (instrument, category, subcategory, style, direction, instrument type, platform, currency, strategy, playbook) followed by the full **Entry Details** block — all pre-filled and re-editable. The actual Exit Price / Exit Date fields sit in a third section the user must scroll past two full sections to reach. Closing a position should be the fastest, most focused action in the app; instead it's the same wall as creating one.
**Why it matters:** Closing is the highest-frequency lifecycle action and it's emotionally loaded (you just took a win/loss). Forcing the user to scroll past 14 already-correct entry fields to type one exit price is slow, and worse, it invites *accidental edits to historical entry data* at the exact moment the trader is least careful. It reads as a generic CRUD form, not a premium product.
**Concrete fix:** In `'close'` mode, render a **focused exit panel at the top**: Exit Price, Exit Date/Time (pre-filled to now — already done), Close Reason, then the realized-P&L preview (see next finding), then Psychology + Exit/Review notes. Collapse Asset & Instrument and Entry Details into a single read-only summary strip ("GBPUSD · Forex · Long · Entry 1.24580 · SL 1.23330 · 20,000") with an "Edit entry details" disclosure for the rare correction case. Keep the full editable form only for `'edit'` mode.

### [P0] No realized P&L / R-multiple preview before confirming a close
**Location:** Close Trade modal, Exit Details. Confirmed in code: there are **no input listeners** on `#editor-exit-price` / `#editor-pnl-amount` / `#editor-forex-exit-price`, and `saveTradeEditor` (app.js:1335) posts straight to PATCH with no preview.
**Issue:** The Add Trade screen audits risk *before* you commit, but the Close screen shows you *nothing* before you commit the result. The realized R-multiple only appears later, in the Review Queue table column (app.js:1537). The trader confirms a close blind.
**Why it matters:** The moment of truth in a journal is "what did this trade actually make/lose, in money and in R?" Surfacing it pre-confirm closes the loop with the Risk Preview and is a signature premium touch ("you risked 1R = ₹3,750; you're realizing +2.4R = +₹9,000"). Its absence makes the close feel like a dead-end form.
**Concrete fix:** Mirror the Add Trade Risk Preview as a **Close Preview** that lives directly under Exit Price and updates on input: Realized P&L (entry/exit/size, direction-aware), Realized R (P&L ÷ 1R risk), and a one-line verdict ("Closed at +2.4R — above your plan" / "Stopped at −1.0R, as planned" / "Cut at −0.4R, before your stop"). For Forex, derive R from the manually-entered amount ÷ the original 1R risk. Add `input` listeners on the exit fields exactly like app.js:480-486 does for the entry form.

### [P1] Add Trade currency never adapts to asset class — always defaults to ₹ INR
**Location:** Add Trade → Trade Details → Currency (`#trade-currency`, dashboard.html:628). The form always opens on ₹ INR and code never re-derives it.
**Issue:** Selecting **Forex (GBPUSD)** or **US Index (NAS100)** still defaults the position to ₹ INR. The Risk Preview then computes Position Value and 1R Risk in rupees for a dollar-denominated instrument — silently wrong numbers. Compare the Open Trades screenshot where GBPUSD/NAS100 correctly show `$`.
**Why it matters:** Wrong-currency risk math on a tool whose entire promise is accurate manual data erodes trust instantly, and it's a per-trade footgun.
**Concrete fix:** When category changes to Forex or US Index, default `#trade-currency` to USD (and when a saved instrument is selected, inherit its last-used currency). Persist `currency` on the instrument record alongside the other defaults so `selectInstrument` (app.js:248) backfills it. Keep it user-overridable.

### [P1] Add Trade entry date/time is not pre-filled — but the close modal pre-fills exit
**Location:** Add Trade → Entry Date & Time (`#trade-entry-dt`), shows empty `mm/dd/yyyy, --:-- --`.
**Issue:** The close flow thoughtfully defaults exit datetime to *now* (app.js:1248, 1255), but the add flow leaves entry datetime blank, forcing manual date-picker entry on every new trade. Inconsistent and higher-friction on the more frequent action.
**Why it matters:** For a manual journal logged in near-real-time, "now" is the right default the vast majority of the time. Making the user open a date picker every entry is needless friction.
**Concrete fix:** On Add Trade load (and on `resetTradeForm`), pre-fill `#trade-entry-dt` to the local now via the same `setMinutes(-getTimezoneOffset())` + `toISOString().slice(0,16)` pattern already used for exits.

### [P1] Validation surfaces only as toasts with raw field names — never inline, never pointing at the field
**Location:** Add Trade submit (app.js:977 `'Please fill all required fields'`); backend errors like `asset_category is required` / `Stop loss must be below entry price for long trades` (app.py:850-948) bubble straight into `showToast(result.error,'error')`.
**Issue:** Two problems. (1) Client check fires a single generic toast and highlights *nothing* — the user must hunt across two cards and ~12 fields to find what's missing. (2) Server messages leak schema names (`asset_category`, `trading_style`) that don't match the on-screen labels ("Asset Category", "Trading Style"). Toasts also auto-dismiss in 3.5s (app.js:2055), so the error vanishes before the user finishes scrolling to fix it.
**Why it matters:** "Please fill all required fields" with no field indication is the canonical un-premium form experience. Field-name leakage looks like a bug.
**Concrete fix:** (a) Validate field-by-field and apply an `.field-error` class + inline message under each offending input, then scroll-focus the first one. (b) Map backend field names to display labels before toasting, or have the API return a `{field, message}` pair the client can render inline. (c) Don't auto-dismiss `error` toasts — require manual close (the close button already exists).

### [P1] The shared modal makes "Review" and "Close" feel identical and tedious
**Location:** Review Center → "Review" button and Open Trades → "Close"/"Edit" all call the same `#trade-editor-modal` (app.js:1466-1468, 1549).
**Issue:** Clicking **Review** on a closed trade opens the full editable everything — Asset & Instrument, Entry, Exit, Psychology, *then* the Trade Review section (Execution Score, Setup Quality, Rule Check, Mistake Tags, Review Notes) buried at the bottom. Logging a review means scrolling past five sections of already-final data to reach the five fields you actually want. The Review Center hero promises "one concrete adjustment," but the act of reviewing is a long scroll.
**Why it matters:** Review is the differentiating habit this product is selling. If it's tedious, it won't get done, and the Review Center metrics stay empty.
**Concrete fix:** In `'review'`/closed-trade-from-queue context, lead with the **Trade Review** section (score, setup quality, rules, mistake tags, notes) plus a read-only result summary (instrument, P&L, R, exit). Make Execution Score and Setup Quality 1-click chip/star rows rather than dropdowns (a dropdown for a 1–5 score is two clicks where one should do). Demote the full editable form behind "Edit trade details."

### [P2] Modal title says "Edit Trade" in static HTML and only swaps to "Close Trade" via JS
**Location:** `#trade-editor-title` defaults to `Edit Trade #` (dashboard.html:923); JS overwrites for close mode (app.js:1187). Functionally fine, but two distinct actions ("Close", "Edit", "Review") all live in one modal whose chrome barely differentiates them.
**Issue/Why it matters:** The Save button copy does adapt ("Close Trade" vs "Save Changes", app.js:1294), which is good — but a trader reviewing should see "Review Trade #31", not "Edit". Mode-specific titles + accent reinforce intent and reduce the "am I about to overwrite something?" hesitation.
**Concrete fix:** Add a third `'review'` mode with title "Review Trade #N" and a clipboard-check icon; reserve "Edit" strictly for the gear/edit affordance.

### [P2] Microcopy that isn't yet premium
**Location/Issue/Fix (specific rewrites):**
- Add Trade submit success: `'Trade added successfully!'` → drop the exclamation+"successfully"; **"Trade logged — added to Open Trades."** (and it currently jumps to the *Trades* view, app.js:989, not Open Trades — confusing after adding an open position; route to Open Trades).
- Generic required toast `'Please fill all required fields'` → **"Add an exit price and date to close this trade."** style per-context messages.
- Instrument hint `"Type to search saved instruments or enter a new one"` is good; keep.
- Risk Preview empty note `"Enter entry, stop, size, and optional target to audit the trade before committing it."` is excellent — keep.
- Close Reason placeholder option `"Select reason..."` and the buried section header **"Close Reason & Psychology"** — once closing is focused, rename to **"Why are you closing?"** and surface it directly under the exit price.
- Mistake-tags custom field `"Add custom tags, comma separated"` — fine, but consider **"Add your own tag, then Enter"** with chip-on-enter behavior rather than comma parsing (`getReviewTags`, app.js:1154, currently relies on comma splitting which is less discoverable).
- Review Notes placeholder `"What should change on the next similar setup?"` — strong, keep.

### [P2] Open Trades table buries the primary action and lacks a P&L/"distance to stop" cue
**Location:** Open Trades → Active Positions, three icon-only action buttons (Close/Edit/Delete, app.js:1465-1469). Screenshot `dash-open-trades-dark.png`.
**Issue:** "Close" is the primary verb on this screen (the intro copy even says "Close a trade by clicking the Close button") yet it's an unlabeled door icon sitting equal-weight beside Edit and a destructive Delete. There's also no live unrealized context (current open risk, R at risk) — the table is static entry data.
**Why it matters:** Icon-only + adjacent destructive delete invites misclicks; the primary action should be unmistakable. And an open-positions screen with no risk-at-a-glance is a missed premium moment.
**Concrete fix:** Make Close a labeled text button ("Close") visually primary; keep Edit/Delete as secondary icons, and separate Delete (or put it behind an overflow "⋯"). Add a column or summary stat for **total open risk (Σ 1R)** so the trader sees aggregate exposure across the 8 open positions.

### [P2] Mobile Add Trade collapses everything to one column with no sticky save
**Location:** `dash-add-trade-mobile-dark.png`.
**Issue:** Every field stacks full-width (fine), but Save/Reset sit at the very bottom after a long scroll, and the Risk Preview's 4 stats become a tall single column, pushing Save further down. No sticky CTA.
**Why it matters:** On mobile, committing the trade requires scrolling past the entire form each time.
**Concrete fix:** Sticky bottom action bar with Save Trade on mobile; render the Risk Preview as a compact 2×2 grid rather than 4 stacked rows.

---

### One structural recommendation
The single highest-leverage change is **splitting the one mega-modal into three intents** — **Close** (focused exit + realized P&L preview), **Review** (review fields first), **Edit** (full form) — sharing one underlying template but with mode-specific ordering, titles, and CTAs. That one move resolves the two P0s and the P1 review-tedium finding together, and is what separates this from a generic CRUD journal and pushes it toward the "god-tier" feel the owner wants.

**Files referenced:** `/home/siddhartha/TradeVault/app/templates/dashboard.html` (lines 483-680 add-trade, 920-1218 editor modal, 1221-1392 open-trades/review-center); `/home/siddhartha/TradeVault/app/static/js/app.js` (412 updateRiskPreview, 953 add-trade submit, 1172 openTradeEditor, 1335 saveTradeEditor, 1433 loadOpenTrades, 1505 loadReviewCenter, 2041 showToast); `/home/siddhartha/TradeVault/app/app.py` (846 validate_trade_fields, 1807 POST, 1883 PUT close, 1942 PATCH).

---
---

# APPENDIX B — Full reviewer report: Data Viewing & Analytics
*(verbatim)*

# TradeVault — Data Viewing & Analytics Review

**Reviewer lens:** Principal product designer / data-viz (Linear / Stripe / Bloomberg). Scope: viewing & analytics only.

## What's already excellent

- **The Analytics page is genuinely strong and the real crown jewel.** It already ships the metrics most "premium" journals charge for: Profit Factor, Expectancy/Trade, Adjusted W/L, Avg Planned R:R, Avg Realized R, Max Drawdown, Current Streak, Largest Win/Loss, and Avg Win/Loss Duration (`dashboard.html:786–859`, computed in `app.py:2235–2297`). That is a serious metric set. The problem (below) is almost entirely that the *Overview* doesn't borrow from it.
- **Chart theming is done properly, not bootstrap-default.** `cssVar()`/`chartGrid()`/`chartTick()`/`chartTooltip()` (`app.js:1695–1720`) pull live CSS variables so charts re-theme on dark/light toggle (`app.js:2079–2086`), and the equity curve uses a sign-aware gradient + rich tooltips with per-trade P&L (`app.js:1786–1832`). This is above the bar for a self-hosted tool.
- **Color semantics are consistent and correct.** Win=green / loss=red holds across stat-card icons, metric-card left borders (`style.css:2105–2106`), monthly/category bars (`app.js:1860,1909`), P&L cells, and the calendar heatmap. No green-loss / red-win confusion anywhere.
- **Empty states are first-class.** `renderEmptyChart()` (`app.js:1722`) draws a centered title+detail directly on the canvas with sensible copy ("Close a trade to build the equity curve") rather than a blank box. Tables have honest empty rows too.
- **The Review Center is a differentiated, opinionated view.** Discipline score, rule-follow rate, mistake-cost-by-tag, and a 42-day outcome heatmap (`app.js:1570–1592`) turn raw trades into a behavioral loop. Few journals have this; it's a premium signature feature.
- **Currency mixing is at least acknowledged in Analytics.** The `mixed_currency` warning banner + per-currency net P&L summary (`app.js:1617–1632`, `dashboard.html:779–784`) is the correct instinct — it just hasn't been carried through to the numbers or to the Overview.

---

## Prioritized findings

### [P0] Overview headline "W/L Ratio 6.16" is mislabeled and not credible
- **Location:** Overview → 5th stat card "W/L Ratio" (`dashboard.html:136–142`, fed by `analytics.win_loss_ratio` in `app.js:750`).
- **Issue:** The value bound here is `win_loss_ratio = avg_win / |avg_loss|` (`app.py:2243`) — that's the **payoff ratio** (average winner vs average loser), not a win/loss *ratio*. A 54.55% win rate is 12W:10L, i.e. a count ratio of **1.2**, yet the card reads **6.16**. Any trader reading "W/L Ratio 6.16" next to "Win Rate 54.55%" will (a) assume it's wrong, or (b) assume they win 6× as often as they lose. It destroys trust in the very first screen — fatal for a product whose owner says viewing is "very very important."
- **Why it matters:** The headline number being internally contradictory is the single most credibility-damaging thing on the dashboard. Bloomberg's whole value is that you never question a printed number.
- **Concrete fix:** Rename the card to **"Payoff Ratio (Avg W ÷ Avg L)"** and keep 6.16, OR add a true count-based **W:L** card (`12 : 10`). Ideally show both: "Payoff 6.16" and "W/L 1.2". The same label exists in Analytics as the more honest "Win/Loss Ratio" (`an-wlratio`) — unify the wording so the same number isn't called two things.

### [P0] Overview equity curve, Monthly P&L, and (downstream) Analytics totals silently add INR + USD as raw numbers
- **Location:** `app.py:2183–2228` (`pnl_by_currency` is tracked, but `equity_curve`, `monthly_pnl`, `avg_win/avg_loss`, `expectancy`, `max_drawdown`, `largest_win/loss` are computed on raw summed `pnl` with **no FX normalization**). Surfaced on Overview equity curve (`app.js:751`) and Monthly P&L (`app.js:752`), which have **no currency warning at all** (the warning only exists on Analytics).
- **Issue:** A ₹900,000 equity step and a $900,000 step are added on the same axis. The Overview equity curve hitting ~1,400,000 is a meaningless blended number. The Overview has a Currency filter but defaults to **All**, so the default first-impression chart is mathematically invalid, and unlike Analytics it shows **no** "multiple currencies present" banner.
- **Why it matters:** This is a correctness bug masquerading as a chart. For a trading journal it's the cardinal sin — the equity curve is the hero artifact.
- **Concrete fix:** (1) Port the `mixed_currency` warning + per-currency net summary to the Overview, not just Analytics. (2) When `mixed_currency` is true, either default the currency filter to the user's primary currency, or render **one equity line per currency** (two datasets, legend on). (3) Long term: store an FX rate per trade at close and offer a "Base currency" toggle so blended P&L is opt-in and labeled "approx. @ entered FX."

### [P1] Overview information hierarchy is upside-down: the most important number (net P&L) is absent, and a 14-field filter wall buries the charts
- **Location:** Overview stat grid (`dashboard.html:107–150`) + "Advanced Filters" card (`dashboard.html:153–225`).
- **Issue:** The six headline cards are Total / Wins / Losses / Win Rate / W/L / Open — **all counts, zero money.** The number a trader actually wants first ("How much am I up?") isn't a card at all; it's hidden inside the equity curve. Then a giant 14-control "Advanced Filters" block sits *between* the stat cards and the equity curve (visible in `dash-overview-dark.png`), pushing the hero chart below the fold on a laptop. On mobile (`dash-overview-mobile-dark.png`) the filter block is a ~600px scroll of stacked dropdowns before any chart appears.
- **Why it matters:** Premium dashboards lead with the answer; filters are a tool you reach for, not a toll gate. Right now the screen leads with plumbing.
- **Concrete fix:** (1) Add a **Net P&L** card (per-currency, color-coded) as card #1, and a **Profit Factor** and **Expectancy** card — you already compute all three. (2) Collapse "Advanced Filters" into a single "Filters" pill/popover (or move it below the charts). The default Overview should be: tabs → KPI cards → equity curve → monthly P&L, with filters one click away. (3) Reorder cards by importance: Net P&L, Win Rate, Profit Factor, then counts.

### [P1] My Trades table will not survive 100+ rows: no pagination, no sorting, 17 columns, no numeric alignment
- **Location:** `dashboard.html:361–387` (17 `<th>`), `app.js:802–843` (renderer), `app.py:1664` (`ORDER BY entry_datetime DESC`, **no LIMIT**), `style.css:1505–1509` (`td` has no right-align).
- **Issue:**
  - **No pagination/virtualization** — `api_get_trades` returns every row; at 500 trades the DOM is 500×17 cells in one paint. The `dash-trades-dark.png` shot already shows ~30 rows running off-screen with no footer/count.
  - **No column sorting** — there are zero click handlers on `<th>` (grep confirms). You cannot sort by P&L, the one thing a trader sorts by. Sort is fixed to entry date.
  - **Numbers are left-aligned.** Entry/Exit/SL/Size/P&L all inherit default left alignment; P&L cells only get color + weight (`style.css:1541–1542`), not `text-align:right` or `tabular-nums`. Columns of prices don't line up by decimal — the table reads like an admin CRUD grid, not a terminal.
  - **17 columns at 0.85rem** with `white-space:nowrap` forces horizontal scroll; on light shot (`dash-trades-light.png`) it's an unreadable wall.
- **Why it matters:** "Viewing data is very very important," and this is *the* data view. It's the screen furthest from "Bloomberg-but-beautiful" and closest to "bootstrap admin template."
- **Concrete fix:** (1) Add server-side pagination (`LIMIT/OFFSET` + `sort`/`dir` params) with a footer "Showing 1–50 of 312 · ‹ ›". (2) Make headers click-to-sort (P&L, R, date, instrument) with arrow affordance. (3) Right-align all numeric columns and add `font-variant-numeric: tabular-nums` to `.data-table td`. (4) Demote 4–5 columns (Style, Platform, Psychology detail, SL) into an expandable row or a column-picker, so the default view is scannable. (5) Add a sticky header on vertical scroll.

### [P1] Tabular figures are missing on every headline number — the "premium" tell
- **Location:** `.stat-card-value` (`style.css:1253–1257`) and `.metric-value` (`style.css:2117–2120`) are `font-weight:800` but have **no** `font-variant-numeric: tabular-nums`. Only `.calendar-cell` and `.risk-preview strong` use it (`style.css:1373,1739`).
- **Issue:** Proportional digits mean "54.55%", "123,323.85", and "-20,006.39" jitter horizontally; in the analytics metrics grid (`dash-analytics-dark.png`) the 18 values don't align on a vertical rhythm. This is exactly the micro-detail that separates Stripe/Linear from a template.
- **Why it matters:** It's the cheapest possible upgrade with the highest "feels expensive" return. Numeric typography *is* the product here.
- **Concrete fix:** Add `font-variant-numeric: tabular-nums` to `.stat-card-value`, `.metric-value`, `.data-table td`, and P&L cells. Consider a dedicated numeric font (the `--font-mono` stack already exists at `style.css:69`) for big figures to lean into the terminal feel.

### [P1] Charts have no currency on the axis and no units on tooltips
- **Location:** All chart tick callbacks (`app.js:1837,1888–1889,1937,1986`) and tooltips (`app.js:1827,1883,1932,1981`) print bare `toLocaleString()` — no ₹/$, no compact "1.2M".
- **Issue:** The equity Y-axis reads "1,400,000" with no unit; the tooltip says "Cumulative: +1,400,000" with no currency. For a single-currency user it's ambiguous; for a mixed user it's actively wrong (see P0). Also the equity X-axis in the shots shows **two adjacent "2026-06-18" labels** because labels are date-only strings (`app.js:1777`) and same-day trades collapse to identical ticks.
- **Why it matters:** Axis labeling and number formatting are the literal definition of chart quality in your brief.
- **Concrete fix:** (1) Add a currency symbol to tick/tooltip callbacks (pass the resolved `sym` into the render fns), and use compact notation on the axis (`1.4M`, `900k`). (2) De-dupe/uniquify equity X labels (append `#index` or time when dates repeat). (3) Add a thin zero baseline (`y` grid emphasis at 0) so above/below water is instantly readable.

### [P2] Missing high-value analytics views for a "god-tier" journal
- **Location:** Analytics page (`dashboard.html:683–917`).
- **Issue / gaps** (you already have expectancy, profit factor, drawdown, streak, durations, return distribution — credit given). Still missing the genuinely differentiating views:
  - **R-multiple distribution** — you compute `avg_realized_r` (`app.py:2249`) but only show *percent* buckets in Return Distribution (`build_return_distribution`). Traders think in R, not %. Add an **R-multiple histogram** (-3R…+5R buckets) next to it.
  - **Day-of-week / time-of-day performance** — you have `entry_datetime`; a "P&L by weekday" and "P&L by entry hour" heatmap is high-signal and cheap. Lives as two small cards in a new "Timing" row.
  - **Win-rate-by-bucket, not just P&L-by-bucket** — Category/Strategy/Playbook charts (`app.js:1897–1991`) show total P&L only. A setup can be net-positive on one fat winner; add **win-rate + expectancy per strategy/playbook** (small table or dual-axis) so the user sees *consistency*, not just total.
  - **MAE/MFE** — not captured at all; if you ever add max-adverse/favorable-excursion fields, an MAE-vs-outcome scatter is the single most respected pro chart. Flag as a roadmap item (needs data entry support).
  - **Drawdown over time** — you compute `max_drawdown` as a scalar (`app.py:2222–2228`) but never plot the **underwater/drawdown curve**. That's a natural second line under the equity curve.
- **Why it matters:** These are the views that justify "premium" over a free spreadsheet.
- **Concrete fix:** Add a "Timing" charts row (weekday + hour) and an R-multiple histogram immediately; add per-strategy win-rate/expectancy to the existing breakdown cards; backlog MAE/MFE + drawdown curve.

### [P2] "Current Streak" renders as raw code ("2W"), and several values can read "∞"/"--" without context
- **Location:** `an-streak` shows `current_streak` like `"2W"` (`app.py:2277`, `app.js:1647`); profit factor shows `∞` (`app.js:1642`).
- **Issue:** `2W` is terse to the point of cryptic on a premium card; `∞` for profit factor (no losses) is correct but unexplained. In `dash-analytics-dark.png` the streak card just shows "2W" with no win/loss color or icon.
- **Why it matters:** Polish. Each headline metric should be self-explanatory and color-coded.
- **Concrete fix:** Render "2 Wins in a row" (or "🟢 2W") with green/red coloring matching streak type; add a tooltip/footnote on Profit Factor explaining ∞ = no losing trades in range.

### [P2] International page repeats the mixed-currency sin in its summary and lacks per-currency breakdown
- **Location:** International "Total P&L" card `intl-pnl` (`dashboard.html:1459–1465`), rendered in `app.js:2124`.
- **Issue:** The section's stated purpose is "kept separate as they cannot be directly compared" (`dashboard.html:1401`) — yet the summary still risks blending if multiple non-INR currencies exist (e.g. USD + future EUR), and the screenshot shows a single "Total P&L 1270.13" without a currency symbol prefix in the card label.
- **Why it matters:** Consistency with the (correct) philosophy stated in the same section.
- **Concrete fix:** Show Total P&L **per currency** (you already have `formatCurrencyBreakdown`), and prefix the symbol on the card value.

### [P2] Playbooks "Rules" column is truncated and clipped on the right edge
- **Location:** Playbooks → Saved Playbooks table, Rules column (`dash-playbooks-dark.png`; renderer `app.js:875–886` truncates to 90 chars; the table also runs off the card's right edge in the shot).
- **Issue:** "Break of 15-min openin…", "Higher highs/lows; buy…", "Price 2+ ATR from VWA…" are all cut off, and the column visibly overflows the card. A playbook with no visible rules is a low-value list.
- **Why it matters:** Playbooks are a viewing surface for *what you're allowed to trade*; truncated rules defeat the purpose.
- **Concrete fix:** Either wrap rules to 2 lines, move to a card-grid layout (rules as body text), or add a hover/expand. Ensure the table respects the card width (`table-layout: fixed` + the column-picker idea from the trades fix).

---

### Key files for follow-up
- `/home/siddhartha/TradeVault/app/templates/dashboard.html` — view markup (`#view-overview` 96–246, `#view-trades` 249–389, `#view-analytics` 683–917)
- `/home/siddhartha/TradeVault/app/static/js/app.js` — `loadOverview` 725, `renderTradesTable` 802, `loadAnalytics` 1596, chart renderers 1766–2037, formatting helpers 35–77
- `/home/siddhartha/TradeVault/app/app.py` — `api_analytics` 2046–2316 (currency-blending + W/L-ratio math), `api_get_trades` 1590–1670 (no pagination/limit, fixed sort)
- `/home/siddhartha/TradeVault/app/static/css/style.css` — `.stat-card-value` 1253, `.metric-value` 2117, `.data-table` 1487–1542 (missing tabular-nums + numeric right-align)

**Single highest-leverage fix:** relabel/repair the Overview "W/L Ratio" card and propagate the mixed-currency warning + per-currency split to the Overview. Those two [P0]s are the difference between "I trust this terminal" and "this number is wrong, what else is wrong."

---
---

# APPENDIX C — Full reviewer report: Brand & Visual System
*(verbatim)*

# TradeVault — Brand & Visual System Review
*Principal brand/product design pass. Scope: design system, branding, landing, auth, global consistency, a11y, responsive. Forms and analytics flows reviewed by others; cross-cutting issues noted.*

## What's already excellent

- **The new logo system is genuinely premium and largely well-deployed.** The teal "vault/chart-check" mark + Newsreader wordmark reads as editorial-fintech, not template SaaS. The theme-aware swap (`brand-wordmark--light`/`--dark` toggled at `style.css:448-451`) is correct, and the wordmark is used consistently in landing nav, footer, and the dashboard sidebar header — all sized down sensibly (30px nav / 26px sidebar+footer).
- **Token architecture is disciplined.** A single `--accent` (`#3fada8` light / `#7ce4de` dark) with derived `-hover/-soft/-glow/-contrast` ramps, plus a dedicated chart-token family (`--chart-grid`, `--chart-tick`, `--chart-tooltip-*`). This is the kind of structure most "premium" clones never build.
- **Deliberate serif/sans pairing.** Newsreader on all headings + the wordmark, brand numbers (`.stat-number`, `.hero h1`) — the editorial identity claim in the CSS header comment is actually delivered on landing and in card titles ("Equity Curve", "Monthly P&L").
- **Genuine dark/light parity in the data UI.** The dashboard overview, analytics, and review center all look fully finished in both themes — semantic green/red/orange are re-tuned per theme (`--green` etc. at `:114-119`) rather than reused, which keeps the equity curve and P&L bars legible on both backgrounds.
- **Accent used with intent in chrome.** Teal is reserved for active state (active nav item, "Overall" tab pill), primary CTAs, focus glow, and data emphasis — it is *not* sprayed. The KPI cards smartly use neutral-tinted icon chips (blue/green/red/orange) instead of all-teal.
- **Input focus is handled well** (`:328-333`): teal border + 3px `--accent-glow` ring on every field. The login screenshot shows it working.

---

## Prioritized findings

### [P0] Auth pages are inconsistent: 4 of 6 still use FontAwesome icons in the logo chip
- **Location:** `setup_totp.html:9`, `forgot_password.html:10`, `change_password.html:11`, `unlock_account.html:9` — `.auth-logo` contains `<i class="fas fa-shield-halved/key/lock-open">`. Compare `login.html:10` and `register.html:10`, which correctly use `<img src="img/icon.png">`.
- **Issue:** Half the "front door" pages show a generic FA glyph in the brand chip while the other half show the real icon mark. The brand-new logo is literally absent from the recovery/unlock funnel.
- **Why it matters:** These pages are exactly where a user is stressed (locked out, recovering) and judging trustworthiness. Mixed marks read as half-finished. It also undercuts the whole "we just integrated a logo system" effort.
- **Concrete fix:** Replace the FA `<i>` in all four with the same markup as login/register: `<div class="auth-logo"><img src="{{ static_url('img/icon.png') }}" alt="TradeVault" width="512" height="512"></div>`. If you want the page-specific glyph (key/shield), keep the brand icon as the chip and move the contextual icon into the `<h1>` instead.

### [P0] No `:focus-visible` styling on buttons, links, or nav — keyboard users get nothing or only the UA default
- **Location:** Entire `style.css` — `grep` confirms zero `:focus-visible` rules. Only `input/select/textarea:focus` is styled (`:328`). `.btn`, `.nav-links a`, `.theme-toggle`, sidebar nav, tabs, and the flash close button have no focus indicator.
- **Issue:** Tabbing through the landing CTAs, the sidebar, the theme toggle, or the modal close button shows no consistent ring (and `outline:none` patterns elsewhere risk removing the UA default too). This is a WCAG 2.4.7 failure.
- **Why it matters:** A "god-tier premium" product is expected to be fully keyboard-navigable; this is the single most common a11y gap that disqualifies a site from "Linear/Stripe caliber."
- **Concrete fix:** Add a global token-driven ring:
  ```css
  :where(a, button, .btn, [role="button"], summary, [tabindex]):focus-visible {
      outline: 2px solid var(--accent-primary);
      outline-offset: 2px;
      border-radius: var(--radius-sm);
  }
  ```

### [P0] No `prefers-reduced-motion` support, yet motion is used globally
- **Location:** `html { scroll-behavior: smooth }` (`:133`), `@keyframes slideIn` on every flash (`:176, :193`), `.theme-toggle` transform on hover, button transitions.
- **Issue:** Nothing respects the OS "reduce motion" setting. Smooth-scroll on anchor jumps + sliding toasts can trigger vestibular discomfort.
- **Why it matters:** WCAG 2.3.3; also a baseline expectation at the quality bar requested.
- **Concrete fix:**
  ```css
  @media (prefers-reduced-motion: reduce) {
      html { scroll-behavior: auto; }
      *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; }
  }
  ```

### [P1] Body sans is `Arial` — the weakest possible partner for a Newsreader serif
- **Location:** `--font-sans: Arial, "Helvetica Neue", "Segoe UI", Geneva, sans-serif;` (`:68`), used as `--font` everywhere for body, labels, buttons, tables, KPI labels.
- **Issue:** You loaded Newsreader from Google Fonts but pair it with system Arial. On the landing hero, feature cards, and dense trade table, the body text is plain Arial. Arial next to a refined serif is the tell of a template — it flattens the "premium editorial" intent the serif is establishing.
- **Why it matters:** The serif is doing all the brand lifting alone; the 90% of text that's sans looks generic. Stripe/Linear-tier sites pair an editorial serif with a crafted grotesque (Inter, Söhne, Geist, etc.).
- **Concrete fix:** Load one geometric/grotesque webfont and set `--font-sans: "Inter", "Helvetica Neue", system-ui, sans-serif;` (Inter is free, ships variable, and reads great at the 0.8–0.95rem sizes used in labels/tables). Add it to the existing `fonts.googleapis.com` request you already make at `base.html:32`.

### [P1] Muted-gray contrast on dark theme is borderline/failing for small text
- **Location:** Dark tokens `--text-muted: #a7b2b3` and `--text-faint: #839193` (`:87-88`), used on `--bg-page #10191b`. Applied to `.stat-label` (0.8rem), `.mockup-title`, table secondary rows, KPI card labels ("Total Trades", "Win Rate" label), `.auth-links`.
- **Issue:** `#839193` on `#10191b` is ~4.0:1 — under the 4.5:1 minimum for normal text. `#a7b2b3` is ~6:1 (ok), but `--text-faint` is used on the smallest copy (landing stat labels, instrument sub-rows in the trade log), exactly where it fails. On the landing dark shot the "Asset Classes / Style Types" labels are noticeably dim.
- **Why it matters:** WCAG 1.4.3, and it literally reduces perceived polish — premium dark UIs keep secondary text readable, not ghosted.
- **Concrete fix:** Lighten the faint token to ~`#94a3a4` (≈4.6:1) and reserve sub-4.5:1 grays only for ≥18px/bold. Verify `.stat-label` and trade-log instrument sub-text specifically.

### [P1] Hero CTA pairing is visually unbalanced and the secondary CTA mislabels its destination
- **Location:** `landing.html:36-43`. Primary "Create Journal" (`btn-primary`) + secondary "View Analytics" (`btn-outline`, `fa-chart-column`) — the latter anchors to `#features`, not analytics.
- **Issue:** (a) "View Analytics" jumps to the Features section, not the Analytics section (`#analytics`) — a broken expectation. (b) Two `btn-lg` side-by-side both compete; the outline button on dark has a faint `--border-light` border that nearly disappears (see landing-dark shot — it reads as floating text).
- **Why it matters:** Mislabeled nav erodes trust on the most-scrutinized screen; weak secondary affordance looks unfinished.
- **Concrete fix:** Point it at `#analytics` and rename to "See the Analytics" — or, since there's no live demo, make it a tertiary text link ("Explore features →") so the single primary CTA carries the page. Strengthen `.btn-outline` border on dark to `--border-strong`.

### [P1] Leftover generic `fa-chart-line` (the OLD identity) inside the hero badge
- **Location:** `landing.html:29` — `<i class="fas fa-chart-line"></i> Private Trade Review Workspace`. Also reused decoratively at `:153` (Index category) and in dashboard section headers (`dashboard.html:59, 230, 865`).
- **Issue:** The brief flags the old generic FA chart-line as the thing being replaced — and it's still the very first icon a visitor sees on landing (the badge), echoing the retired mark right next to the new wordmark.
- **Why it matters:** Reusing the deprecated chart-line glyph beside the new brand mark muddies the identity at the most visible spot.
- **Concrete fix:** Swap the hero-badge glyph for something that isn't the old logo motif (`fa-circle-check`, `fa-lock`, or the brand icon itself). The in-context dashboard `fa-chart-line` on "Equity Curve" headers is fine (it's a chart), but avoid it in the hero badge.

### [P1] Password policy "Min 6 characters" undercuts the premium/security positioning
- **Location:** `register.html:22`, `forgot_password.html:28`, `change_password.html:31` — `minlength="6"`, placeholder "Min 6 characters".
- **Issue:** The product leans hard on security as a value prop (TOTP recovery, account lockout, unlock flow) yet permits 6-char passwords. The juxtaposition reads as cheap.
- **Why it matters:** For a self-hosted vault of trading data, 6 chars is a credibility hit, especially with copy that says "set up authenticator recovery."
- **Concrete fix:** Raise to `minlength="12"`, update placeholder to "At least 12 characters", and add a lightweight strength hint. (Coordinate with backend validation — flag to the forms reviewer.)

### [P2] Auth pages have no wordmark/branding above the chip — they feel like a component, not a "front door"
- **Location:** `login.html` / `register.html` `.auth-header` — icon chip + serif H1, but no "TradeVault" wordmark and a vast empty dark canvas around a centered card (see login-dark / register-dark shots).
- **Issue:** The icon-only chip plus a sea of empty `--bg-page` reads minimal-bordering-on-barren. There's no brand reassurance ("this is TradeVault") and no atmosphere.
- **Why it matters:** Stripe/Linear auth screens establish brand + a sense of place (subtle gradient, product glimpse, or wordmark). Right now it's a floating box.
- **Concrete fix:** Add the `wordmark` (small) above the icon chip or in a top-left corner; introduce a faint radial accent-glow background (`radial-gradient(... var(--accent-glow) ...)`) so the dark canvas isn't dead. Optionally tighten `.auth-card` max-width so it feels intentional rather than lost.

### [P2] Microcopy is competent-but-flat; several strings read template-y
- **Location:** Landing + auth strings.
- **Issue / fixes (concrete rewrites):**
  - Hero subtitle (`landing.html:33`) is one 38-word run-on listing five comma-separated features + five markets. → Split: lead line "The private journal for traders who review their work." then a tighter support line.
  - "A Journal Built for Post-Trade Review" (`:97`) is fine; but section subtitle "Capture the planned trade, close the position, then review…" is process-y. → "Every trade becomes a record you can question later."
  - CTA "Start With a Clean Trading Record" / "Create a private TradeVault workspace and keep each trade reviewable from entry to exit." is serviceable but generic. → headline "Keep an honest record of every trade."
  - Login subtitle "TOTP is only used for recovery and unlocks." exposes an acronym to a first-time visitor. → "Two-factor codes are only needed for recovery and unlocks."
  - Register button "Register & Set Up Recovery" is clunky. → "Create Account" (the recovery step is the next screen anyway).
- **Why it matters:** At this tier, copy is a brand surface; the current strings describe mechanics rather than sell the *feeling* of disciplined review.

### [P2] Radius scale is effectively flat — `--radius-sm/md/lg` are 10/12/16 but buttons, inputs, and cards mostly land on the same 10–12px
- **Location:** `:56-59`. `.btn` uses `--radius-sm` (10), inputs `--radius-sm`, cards `--radius`/`--radius-lg`. The pill elements (`hero-badge` 100px, `theme-toggle` 999px, tab pills) are the only real differentiation.
- **Issue:** Not wrong, but the elevation/shape language is monotone — everything is a softly-rounded rectangle with the same `--shadow` (`0 8px 24px`). On the overview the KPI cards, filter panel, and chart cards all share one shadow/radius, so hierarchy comes only from size.
- **Why it matters:** Premium systems use elevation deliberately (raised vs. flush). Here `--shadow` and `--shadow-lg` are *identical in light theme* (`:61-62` both `0 8px 24px ...0.08`), so there's effectively one shadow tier in light mode.
- **Concrete fix:** Differentiate light `--shadow-lg` (e.g. `0 18px 42px rgba(51,51,51,0.12)`) from `--shadow`, and reserve the larger one for modals/hero mockup only. Keep KPI cards on `--shadow-sm` or borderless-flush so the data reads calmer.

### [P2] Floating circular theme toggle (FA moon/sun) collides with the brand and feels app-generic on auth/landing
- **Location:** `base.html:53-57` floating `.theme-toggle-floating` (bottom-right) on all non-inline pages (login, register, recovery). Landing uses an inline nav toggle instead.
- **Issue:** A 44px FA-glyph FAB hovering bottom-right of the otherwise minimal auth screens (visible in login/register shots) is a slightly generic "bootstrap admin" tell, and it's a second, differently-placed toggle pattern than landing's inline one.
- **Why it matters:** Two toggle paradigms + a floating FAB on a premium login page is inconsistent.
- **Concrete fix:** On auth pages, move the toggle inline (top-right of the card or page) to match landing's `nav-theme-toggle` pattern; reserve the floating FAB only where there's genuinely no chrome to host it.

### [P2] Responsive: mobile dashboard top bar is cramped and KPI cards collapse to a tall single stack
- **Location:** `dash-overview-mobile-dark.png`. The hamburger + "Overview" + gear sit tight against the top edge; the 6 KPI cards become a long vertical scroll before any chart, and the Advanced Filters panel renders ~13 stacked selects pushing the equity curve far down.
- **Issue:** On mobile the most valuable content (charts) is buried under a wall of full-width filter selects. KPI cards as a 1-col stack is a lot of scrolling.
- **Why it matters:** Mobile is where "cramped" most hurts perceived quality.
- **Concrete fix:** Collapse Advanced Filters into a closed `<details>`/drawer on mobile; render KPI cards 2-up (grid-template-columns: repeat(2,1fr)) under ~640px; add a bit more top padding to the mobile topbar. (Landing mobile, by contrast, looks well-handled — single column, good rhythm.)

### [P2] Mockup "traffic-light" dots use semantic red/green tokens — minor but reads as accidental
- **Location:** `.mockup-dots span:nth-child(1/2/3)` → `--red/--orange/--green` (`:587-589`).
- **Issue:** Window-chrome dots colored with your P&L semantic tokens can subconsciously read as status (loss/warn/win) on a *Performance Dashboard* mockup card.
- **Concrete fix:** Use neutral fixed dot colors (e.g., `#ff5f57/#febc2e/#28c840` macOS-style, or three neutral grays) so semantic red/green stay meaningful only in data.

---

### Quick-win checklist (highest ROI first)
1. Put `img/icon.png` in the 4 remaining auth pages (P0, trivial).
2. Add global `:focus-visible` + `prefers-reduced-motion` blocks (P0, ~12 lines).
3. Bump dark `--text-faint` to ~`#94a3a4` (P1, one token).
4. Fix the "View Analytics" anchor target + strengthen outline-button border on dark (P1).
5. Retain the approved Arial + Newsreader identity; tighten the dense-UI type scale and add tabular figures rather than introducing a third-party sans without a brand decision.
6. Raise password `minlength` to 12 across the three forms (P1, coordinate with backend).

**Files referenced:** landing.html, base.html, login.html, register.html, setup_totp.html, forgot_password.html, change_password.html, unlock_account.html, static/css/style.css.

---
---

# APPENDIX D — Inspiration analysis (reference UIs i1–i14)

> Detailed teardown of the 14 reference screenshots the owner found "very very rich." Each note records what to BORROW (pattern/feel) — adapted to TradeVault's manual-entry, multi-asset, INR+USD model — and what to AVOID. **Borrowing inspiration must never remove an existing TradeVault feature** (see HARD RULE above).

## How to read this appendix

The screenshots appear to be multiple surfaces of one rich trading-journal product, plus one separate dark dashboard reference. They are not a requirements document and their data model is not TradeVault's. Each review therefore separates:

- **Observed visual/interaction system:** what makes the screenshot feel finished.
- **TradeVault adaptation:** how the pattern should fit our existing manual-entry, five-asset-class, playbook, review, attachment, INR/USD, auth, and theme systems.
- **Do not copy:** details that would weaken our identity, accessibility, correctness, or scope.

Recommendations marked **data-dependent** require schema or analytics work and must not be faked in the UI. The purple/blue reference accent must map to TradeVault teal; reference sans typography must map to the approved Newsreader + Arial identity; light and dark implementations must be designed together.

---

## i1 — Dashboard overview (`i1-dashboard.png`)

### What makes it visually rich

- A narrow icon rail and shallow command bar keep navigation present without consuming the canvas. Search, theme, account balance, and avatar are global; page filters and Add Trade are local. That two-level action hierarchy is unusually clear.
- The opening row answers four questions in seconds: total result, win rate, trade volume, and expectancy. A fifth **Risk Rules** card breaks the KPI-card monotony with live operational facts (trading window and daily-trade limit).
- The body uses an asymmetric bento rather than equal cards. Recent Trades and the monthly calendar occupy the broad left column; the equity curve is the visual anchor on the right; smaller diagnostic cards (long vs short, quick stats, top performers, notes, risk discipline) orbit those anchors.
- Repeated row patterns are extremely economical: a 2px direction/result rail, bold symbol, tiny semantic chip, condensed execution details, aligned P&L, and faint status. Density comes from alignment, not from tiny boxes around every datum.
- The calendar communicates date, result, and inactivity simultaneously. Green/red washes are pale enough to preserve text; empty days remain structurally visible.
- Color is disciplined. Green/red communicate results, purple identifies interaction, and almost everything else is neutral. Icons sit in faint tinted squares rather than becoming decoration.
- Cards use hairline borders, very soft shadows, 12–16px corners, generous internal padding, and almost no gradients. Large values use heavy weight and tabular-looking figures; captions are uppercase with open tracking.

### TradeVault adaptation

- Rebuild Overview around a first row of **Net P&L by currency**, Win Rate, Profit Factor/Expectancy, and Total Trades, followed by a compact **Risk & Review** card showing open 1R at risk, unreviewed closed trades, and rule-follow rate. Do not blend INR and USD to imitate the single-dollar screenshot.
- Put the equity curve and calendar/heatmap above the full filter wall. Keep every existing filter, but place them in an expandable filter drawer with active-filter chips and a visible count.
- Use the existing review queue and mistake data to populate small "attention" modules, rather than inventing generic widgets.
- Preserve Overview category tabs and existing charts. A bento layout changes hierarchy, not functionality.
- Add a recent-trades strip and open-positions strip only if they deep-link to the existing detail/close flows; avoid duplicating entire tables on Overview.

### Do not copy

- Do not use one giant cross-currency P&L number.
- Do not replace the TradeVault sidebar/wordmark with an icon-only anonymous rail on desktop; a compact/collapsed state can be optional.
- Do not show risk-rule values unless they come from real user-configurable rules. A decorative "0/2" would reduce trust.
- Do not make every diagnostic visible on small screens. Mobile should show primary KPIs, attention items, then charts; secondary cards can become horizontal scrollers or disclosures.

---

## i2 — Trade log and filtering (`i2-logAndFilter.png`)

### What makes it visually rich

- A slim summary ribbon above the filter bar keeps the filtered dataset in context: P&L, win rate, trade count, profit factor, and live P&L. This makes filtering feel analytical rather than clerical.
- Search, date, asset, side, status, result, and P&L range form one unified toolbar. Import and Add Trade remain visually separate as page actions. View-density/layout toggles and a column-control affordance acknowledge that traders inspect the same data in different ways.
- The table is dense but highly scannable: uppercase headers, strict column alignment, consistent row height, colored chips for asset/side/status/setup/emotion, stars for confidence, and green/red only where outcome meaning exists.
- P&L and R multiple are adjacent, which lets the eye compare money and process quality without travelling across the row. Duration, setup, confidence, and emotion extend the record beyond transaction data into review context.
- Row selection and an overflow menu support bulk/secondary actions without crowding every row with many icons.

### TradeVault adaptation

- Keep every current filter field. Consolidate them into a sticky filter toolbar with a compact first row (search, date, asset, status/result) and an expandable "More filters" area for subcategory, style, platform, currency, psychology, close reason, strategy, and playbook.
- Add an always-visible filtered summary strip with **per-currency** P&L plus win rate, trade count, profit factor, and average realized R. Never sum INR and USD raw.
- Add sorting, pagination, sticky headers, right-aligned tabular numeric cells, and user-selectable columns. Default columns should prioritize Instrument, Date, Direction, Status, P&L, R, Strategy/Playbook, and Actions; no existing field is deleted—secondary fields live in column settings or an expandable row.
- Use row click/Enter to open the dedicated trade-detail canvas. Keep explicit Close/Edit/Delete actions, but visually separate primary lifecycle action from destructive delete.
- Translate existing execution score/setup quality/mistake tags into compact review chips; do not add a separate duplicate "confidence" model unless product semantics are defined.

### Do not copy

- Do not rely on color alone for chips; retain text and icons where useful.
- Do not render 17 fixed columns at mobile or laptop widths. Horizontal scrolling is a fallback, not the default design.
- Do not treat open unrealized P&L as accurate unless TradeVault gains a trusted market-price source.
- Do not hide Import merely because the reference emphasizes Export elsewhere; TradeVault's import path remains first-class.

---

## i3 — Trade detail, replay, and notes (`i3-logAndFilter.png`)

### What makes it visually rich

- This is a task-specific canvas, not a modal. A compact result header combines instrument, contract/direction, status, time range, confidence, tags, P&L, return, and size without forcing the user through the entry form.
- The upper facts are divided into three semantic modules: **Execution**, **Risk & Targets**, and **Risk Rules/Setups**. This is more readable than a generic key-value dump because each group answers a different review question.
- The central candlestick chart is the dominant artifact. Entry and exit markers sit in context, while replay and timeframe controls are placed inside the chart frame rather than in remote chrome.
- Running P&L below the chart adds MAE, MFE, and captured-move percentage. The page connects outcome, price path, and decision quality.
- The right-side Trade Notes editor is a genuine second workspace: rich formatting, structured table, bullets, pull quote, embedded image, and media strip. Notes remain visible while inspecting the trade instead of being buried at the bottom.
- Visual hierarchy is excellent: large P&L, medium section titles, monospaced/tabular prices, faint metadata, then semantic tags. Borders establish zones without heavy elevation.

### TradeVault adaptation

- Create a dedicated Trade Detail/Review view reached from My Trades, Open Trades, Review Queue, calendar days, and search. It should compose existing data: trade summary, entry/exit/risk facts, close reason and psychology, execution review, playbook/rules, chart attachments, and review notes.
- Preserve attachments and elevate them into a chart/media panel with thumbnail navigation, caption, full-size view, and upload/delete controls. Do not replace the existing image storage/API.
- Place Close, Review, and Edit as distinct intents in the header. Closed trade review should never reopen a wall of editable entry fields by default.
- Add MAE/MFE and captured-move only as a clearly labelled roadmap item; they require trustworthy capture. Until then, use the existing planned R:R and realized R without pretending to reconstruct an intratrade price path.
- A two-column desktop layout (analysis left, notes/media right) should collapse to a single reading order on smaller screens: summary → action → chart/media → review → details.

### Do not copy

- Do not imply live TradingView replay or broker execution history without a real integration and licensing decision.
- Do not conflate execution score, setup quality, confidence, and rule-following into redundant ratings.
- Do not make rich text mandatory. Plain review notes must remain fast and robust.
- Do not permit editing historical trade facts merely because the user is reviewing the result.

---

## i4 — Notes library (`i4-notesAndJournaling.png`)

### What makes it visually rich

- The screen adopts a notebook mental model: a local navigation column for All Notes, Pinned, Templates, Collections, Tags, and Folders; a global filter row; and a broad content field.
- Note previews are text-first and nearly borderless. Date, linked-record icon, title, excerpt, and low-chroma tags form a quiet editorial grid. The whitespace makes the product feel more like a research notebook than an admin dashboard.
- Three columns achieve density without sacrificing legibility because excerpts share line lengths and metadata aligns predictably.
- Collections (Setups, Risk Rules, Mistakes) and folders (Pre-Trade, Post-Trade, Daily Journal) expose two different organizational concepts instead of forcing everything into one tag list.

### TradeVault adaptation

- Evolve existing review notes, exit notes, playbook notes, and trade attachments into a unified **Journal/Notes workspace** only after the core detail/review flow is fixed. Existing notes stay attached to their source records; the library is an additional index, not a migration that drops context.
- Support search, pinned items, linked trade/playbook, note type (pre-trade, post-trade, daily), and existing mistake/strategy/playbook tags. Templates can later reuse playbook checklists and review prompts.
- Use an editorial list or responsive 2–3-column preview grid with Newsreader note titles and Arial metadata. This is a strong place for TradeVault's identity to differ from the all-sans reference.
- Provide a clear empty state and quick-create action; notes should not appear as a mandatory field in Add Trade.

### Do not copy

- Do not invent folders/collections before defining ownership, linking, export/import, and deletion semantics.
- Do not detach review notes from their trades to make the grid prettier.
- Do not use tag colors as the only taxonomy cue or assign arbitrary colors that compete with P&L semantics.
- Do not prioritize this new workspace ahead of correctness, close/review flow, and core table scalability.

---

## i5 — Add New Trade workspace (`i5-notesAndJournaling.png`)

### What makes it visually rich

- The form is a full-page, three-zone workspace. Left holds classification and trader state, center holds instrument mechanics and outcome values, right holds linked context and rule compliance. The zones mirror the user's mental sequence.
- Asset class is a top segmented control; options-specific structure adds Single Leg/Spreads beneath it. This is progressive disclosure with clear spatial persistence.
- Emotion is a row of labeled icon chips, confidence is direct star input, and setup/tags are tokenized selects. These are faster and more expressive than long dropdowns.
- The setup checklist distinguishes entry and exit conditions and visually strikes completed rules. A separate global Risk Rules module shows completion count, so setup-specific and universal discipline are not conflated.
- Price fields expose derived totals; stop loss offers 1R–5R target shortcuts; estimated P&L updates before save. The form feels intelligent because every consequential input returns immediate feedback.
- Linked Note creates continuity between planning, execution, and later review. The bottom-right Save action is persistent and unambiguous.

### TradeVault adaptation

- Preserve all current asset classes, subcategories, styles, instrument types, lot sizing, platform, currency, strategies, playbooks, long/short validation, autocomplete defaults, and Risk Preview. Recompose them into progressive zones rather than deleting "less important" fields.
- On desktop, use a two-column form plus a sticky contextual rail: primary trade facts and risk math in the main area; selected playbook, checklist, live Risk Preview, and attachments/context in the rail. Three fixed columns may be too narrow for TradeVault's broader data model.
- Use category tabs/segmented controls to reveal only relevant fields while retaining all five categories. Instrument defaults should backfill currency as well as category/style/lot/platform.
- Convert execution score/setup quality/emotion choices to accessible chip or radio groups where the option set is small. Preserve custom psychology detail and mistake tags.
- Keep live 1R/planned R:R/effective units/position value and add target presets only when they do not overwrite a manually entered target without confirmation.
- Add a sticky action footer on long forms with Save, Save & Add Another (optional), and clear validation summary. On mobile, keep the main Save reachable without hiding errors behind the footer.

### Do not copy

- Do not make option-specific controls (strike, expiration, spreads) the main information architecture for all TradeVault assets.
- Do not allow a visually attractive checklist to silently change the semantics of existing playbook and rule-follow fields.
- Do not pre-populate fake rule completion or infer discipline from unchecked data.
- Do not remove Forex manual P&L, directional stop/target validation, or attachments to achieve a cleaner screenshot.

---

## i6 — Performance dashboard (`i6-performanceAnalysis.png`)

### What makes it visually rich

- Eight KPI tiles form a disciplined 4×2 block: Net P&L, Win Rate, Avg R, Expectancy, Average Win/Loss, Win/Loss Ratio, and Hold Time. Each has a primary value and one explanatory comparison, preventing "mystery metrics."
- The equity curve receives the largest area. Supporting visuals are deliberately varied: filled line, monthly bars, drawdown line, donut, threshold meter, compact ratios, and symbol leaderboard.
- The Risk Metrics region is a nested composition. Max drawdown becomes a full-width warning band with amount, percentage, risk label, and threshold scale; Sharpe/Sortino/ROC/Recovery sit below as quieter secondary measures.
- Asset Analysis uses tabs to reuse one card for multiple asset classes. Symbol Performance ranks entities with result, count, win rate, and proportional bars rather than requiring another full chart.
- The screen is light and low-chroma despite its density. Chart grids are faint, borders are consistent, green/red remain semantic, and blue is reserved for neutral cumulative series.

### TradeVault adaptation

- Recompose existing analytics into a 12-column bento: primary KPI block, large per-currency equity view, monthly P&L, drawdown/underwater curve, category/strategy/playbook analysis, return/R distribution, and symbol leaderboard.
- Every KPI needs a definition or sublabel. Distinguish **payoff ratio** (avg win ÷ avg loss) from count W:L; explain infinity and insufficient samples.
- Add risk threshold treatments only when thresholds are defined and user-visible. Max drawdown can show both amount and percentage per currency; ratios such as Sharpe/Sortino require a documented calculation and enough observations.
- Use tabs or segmented controls for category/strategy/playbook breakdowns to reduce repeated cards without removing any current chart.
- Keep INR and USD series separate. R-normalized analytics may combine trades only when clearly labelled as R, not money.

### Do not copy

- Do not show both "Equity Curve" and "Cumulative P&L" if they encode the same series without a distinct question.
- Do not add finance ratios merely because they look professional; formula, period, risk-free-rate assumption, and sample threshold must be documented.
- Avoid donut/pie charts when a ranked list or bar communicates comparison more accurately.
- Avoid green for every positive-looking metric; teal should identify interaction/brand while green remains outcome/success.

---

## i7 — Behavioral analysis and insights (`i7-performanceAnalysis.png`)

### What makes it visually rich

- The dashboard shifts from "what happened" to "why." Rule Compliance, Trading Insights, Journaling Impact, Setup Analysis, Mistake Analysis, Emotion Analysis, Day of Week, and Period Comparison each answer a behavioral question.
- Rule Compliance pairs scores with **impact analysis**: compliant versus violated P&L and win-rate deltas. It connects discipline to consequences instead of presenting a vanity percentage.
- Trading Insights uses concise cards with severity border, evidence sentence, measured consequence, confidence badge, and drill-in affordance. The writing is specific ("61% of trades exit before target") rather than motivational filler.
- Setup/Mistake/Emotion cards use compact ranked rows and best/worst labels. Period Comparison provides deltas beside the current number, so change direction is immediate.
- The repeated purple icon tile gives sections a shared rhythm while status colors remain inside evidence and outcome values.

### TradeVault adaptation

- The existing Review Center is the natural home. Preserve discipline score, rule-follow rate, mistake cost, 42-day map, queue, and adjustment prompt; add evidence-led cards around them.
- Add setup/playbook, mistake, psychology, close-reason, and weekday analyses with trade count, win rate, expectancy, average R, and P&L **per currency**. Use minimum-sample labels and avoid ranking a category from one trade as a reliable best/worst.
- Add period comparison (current vs prior equal period) and explain the date windows. This is higher value and lower risk than pseudo-AI recommendations.
- Derive insight sentences from transparent rules and expose the supporting trades. Phrase association honestly: "In this sample…" rather than claiming causation.
- A "journaled vs not journaled" comparison is valid only after defining what counts as journaled (review completed, note present, attachment present, or all three). Make that definition visible.

### Do not copy

- Do not display confidence percentages unless a real statistical method produces them.
- Do not call correlation "impact" or "improvement" without causal evidence.
- Do not punish honest negative notes by turning the Review Center into a gamified score chase.
- Do not add a second mistake taxonomy; reuse existing mistake tags and custom tags.

---

## i8 — Monte Carlo simulation (`i8-riskSimulation.png`)

### What makes it visually rich

- The page is organized around one dominant simulation chart. A compact control strip specifies simulations, horizon, ruin threshold, growth mode, and stress test; a plain-language warning interprets the settings before the user reads the graph.
- Many pale scenario paths establish variance, a thick median path anchors expectation, and a percentile band communicates uncertainty. Side cards summarize probability of profit, risk of ruin, expected return, max drawdown, median final equity, and distribution percentiles.
- Tabs cleanly separate Monte Carlo from What-If. The simulation is not squeezed into the general Analytics dashboard; it earns a dedicated studio.
- The negative-expectancy warning is visually strong but restrained: tinted panel, explicit consequence, and a recommended pause rather than an unexplained red metric.

### TradeVault adaptation

- Treat Simulation Studio as later-phase, opt-in functionality. Base it on realized R multiples or one selected currency/account scope; never run a mixed INR/USD equity simulation.
- Require a minimum closed-trade sample, show the sample size and resampling method, and label results as historical scenarios—not forecasts.
- Controls should use TradeVault terms and sensible presets: number of paths, trade horizon, ruin/drawdown threshold, fixed vs compounding risk, and optional outlier stress.
- Preserve all existing analytics; Simulation becomes an additional route reached from Analytics.
- Keep the large chart + metric rail pattern for desktop, then stack interpretation before details on mobile.

### Do not copy

- Do not ship false precision such as "8.4% probability" without methodology, sample warning, and reproducibility.
- Do not use a starting account balance unless TradeVault has an explicit account-equity model. R-multiple simulation is safer with current data.
- Do not frame a simulation as financial advice or a guarantee.
- Do not prioritize this over trust/correctness P0s and the core review workflow.

---

## i9 — What-if simulation (`i9-riskSimulation.png`)

### What makes it visually rich

- Six plain-language scenario presets (Tighter Stops, Hold Winners, Better Entries, A+ Setups Only, Conservative Size, Captured Setups) give non-technical users an entry point before exposing sliders.
- Adjustable assumptions are paired with signed deltas and helper copy. The user always knows both the direction and intended meaning of each change.
- The simulated equity line and shaded area are compared directly with a dashed baseline. A single green delta badge communicates the terminal outcome without hiding the path.
- The comparison band below translates the scenario into Net P&L, Win Rate, Profit Factor, Expectancy, trade count, average win/loss, and payoff ratio. The insight sentence names the most meaningful change.

### TradeVault adaptation

- If implemented after Monte Carlo foundations, use transparent transformations on the user's realized R series: cap losses, extend winners, filter by setup quality/playbook/rule-follow, adjust frequency, or apply fees. Show exactly which trades/values change.
- Use quick scenarios as saved parameter presets, not magic AI actions. Every scenario needs a one-sentence formula and Reset.
- Compare baseline and scenario in R by default; show money only within one currency scope.
- Link scenario findings back to the Review Center's "one concrete adjustment" without automatically editing playbooks, trades, or rules.

### Do not copy

- Do not claim the user "would have" earned a precise amount from counterfactual execution.
- Do not turn "A+ setups only" into hidden survivorship bias; define the quality field and show removed sample size.
- Do not let sliders mutate source trade records.
- Do not treat better entries/win rate as independent variables without explaining that the scenario is synthetic.

---

## i10 — Monthly trading calendar (`i10-tradingCalendar.png`)

### What makes it visually rich

- A compact month summary (trading days, Net P&L, wins/losses) sits directly above a large, calm calendar. The summary and grid clearly share the same time scope.
- Profitable and losing days use pale full-cell fills with amount and trade count. Empty days remain legible, and out-of-month days fade without disappearing.
- Selecting a day creates a strong outlined state and opens a right-side Day Activity drawer with date, daily result, W/L, and individual trade cards. Context remains visible while details appear.
- Trade cards are concise: direction icon, symbol/contract, P&L, side chip, quantity, and entry price. There is enough data to identify the record without replicating the whole table.

### TradeVault adaptation

- Add a Month mode to the existing outcome-map concept. Show per-day P&L only for a single selected currency or show separate currency lines; otherwise use R/outcome counts to avoid raw currency blending.
- Clicking or keyboard-activating a day should open an inline panel/drawer listing the day's trades with links to Trade Detail/Review.
- Preserve the 42-day Review Center view as a compact recent-habit mode. Month and Year are additional modes, not replacements.
- Use a teal focus/selection outline, semantic green/red fills, text labels, and tooltips. Ensure selected, focused, profitable, and losing are distinguishable states.
- On mobile, place day details below the calendar rather than forcing a narrow side drawer.

### Do not copy

- Do not assume one currency because the reference does.
- Do not encode amount intensity only with red/green; include signed text, counts, and accessible labels.
- Do not put open trades into realized daily P&L.
- Do not make calendar navigation reset the user's active analytics filters without warning.

---

## i11 — Year intensity heatmap (`i11-tradingCalendar.png`)

### What makes it visually rich

- The year is compressed into a GitHub-like intensity grid with month and weekday landmarks. A diverging loss-to-profit legend makes magnitude, sign, and inactivity legible.
- Annual summary stays spare: total P&L, active days, wins, and losses. The visualization gets the majority of the space.
- Selecting one cell uses a strong outline and reveals Day Activity below with daily totals and compact trade cards. The heatmap is therefore navigation, not a dead chart.
- The lower detail panel repeats the selected date and daily metrics before the cards, preserving orientation after the user's gaze moves down.

### TradeVault adaptation

- Extend the existing 42-day heatmap into Recent / Month / Year modes backed by the same day-detail component.
- For mixed-currency selections, use realized R or result count intensity and expose per-currency money in the selected-day detail. If displaying P&L intensity, require one currency filter.
- Add an explicit no-trade state distinct from zero P&L, and surface reviewed/unreviewed state via a secondary marker or filter rather than a second competing color scale.
- Use tooltips and screen-reader labels with date, trade count, P&L/R, wins/losses, and review completion.

### Do not copy

- Do not render hundreds of tiny inaccessible click targets without keyboard navigation and a list alternative.
- Do not imply grey cells all mean the same thing; distinguish outside range, no trade, and zero result.
- Do not overload the heatmap with strategy, emotion, mistakes, and review status simultaneously. Filters should change the question; the cell should stay simple.

---

## i12 — Report and export preview (`i12-reportAndExport.png`)

### What makes it visually rich

- The screen separates configuration/action from artifact: a narrow left column shows account, period, included-trade count, and export buttons; the broad right canvas shows a near-print-size live report preview.
- "Print / Download PDF" and "Export JSON Data" are visibly different outcomes. The interface distinguishes a human-readable report from machine-readable backup.
- The report itself has print-specific hierarchy: branded title block, KPI summary, win-rate ring, equity curve, monthly performance, risk metrics, top symbols, and weekday analysis. It does not merely screenshot the web dashboard.
- The preview's muted outer canvas makes the white report page feel tangible. Included-trade count in the preview header reinforces scope.

### TradeVault adaptation

- Keep JSON Export **and Import** exactly as they are. Add a separate print/PDF report flow later, with live preview and a clear statement that attachments are not embedded unless that capability is deliberately built.
- Report scope should reuse filters/date/category/playbook and require a currency choice for money charts; alternatively generate separate INR and USD sections plus an R-normalized combined review.
- Include TradeVault identity, generated timestamp, filter scope, KPI definitions, review/discipline metrics, and methodology notes. Do not place unsupported ratios into a polished PDF.
- Design a semantic print stylesheet/server-generated report rather than rasterizing the dashboard.
- Provide accessible HTML preview and browser print as a reliable baseline before adding a PDF dependency.

### Do not copy

- Do not turn backup JSON into a presentation export or remove Import from the page.
- Do not imply attached images are safely backed up by JSON; preserve the current explicit note that binaries live separately.
- Do not blend currencies in headline totals or charts for visual convenience.
- Do not include secrets, TOTP recovery material, or internal identifiers in reports.

---

## i13 — Global command search (`i13-reportAndExport.png`)

### What makes it visually rich

- The modal uses a soft blurred/scrimmed backdrop, strong central elevation, a single large query field, and generously spaced results. Attention is focused without feeling like navigation to a separate page.
- Results from different object types share one list but retain type chips (TRADES, NOTES), object-specific icons, primary title, metadata, and directional affordance.
- Keyboard behavior is visible in a fixed footer: arrows navigate, Enter selects, Escape closes, and a shortcut opens the palette. The feature advertises its speed.
- Selection is a pale accent wash with a colored icon tile and arrow, not a heavy border. The rest of the list remains extremely neutral.

### TradeVault adaptation

- Add `Ctrl/Cmd+K` global search across trades/instruments, strategies, playbooks, review/exit notes, and later journal entries. Search results should deep-link to the correct existing view and selected record.
- Result metadata should include date, status, direction/category, currency-aware P&L, and result type. Never show a bare amount without symbol/currency.
- Keep the existing instrument autocomplete inside Add Trade; command search is global navigation, not a replacement.
- Preserve page filters. Search should accelerate retrieval, while filters remain the tool for analytical cohorts.
- Implement full focus trapping, initial focus, Escape, arrow navigation, Enter activation, screen-reader status, and reduced-motion behavior.

### Do not copy

- Do not use `Alt+K` as the only shortcut; browser/OS conflicts are common. Display and support a clickable search trigger.
- Do not blur the entire application for users who request reduced transparency/motion if it harms legibility or performance.
- Do not index sensitive authentication material or attachment filesystem paths.
- Do not add a search façade before the underlying result permissions and deep links are reliable.

---

## i14 — Dense dark dashboard (`i14-dashboard.png`)

### What makes it visually rich

- This reference takes the opposite visual route from i1–i13: a compact, dark, telemetry-heavy workstation. It demonstrates how much information can fit when headers, gutters, and chart ink are tightly controlled.
- A single top control row owns account, strategy/timeframe, date range, and filtering. The page below is almost entirely data; there are no oversized greetings or decorative hero zones.
- Panel sizes communicate priority: trade-count sparkline and balance dominate left; win rate, payoff, streak, radar, and symbol mix occupy compact center tiles; detailed performance and calendar dominate right.
- Blue is the structural/data accent, green/red indicate outcomes, and the navy surface family creates depth through small luminance steps rather than shadows.
- Sparklines, rolling metrics, gauges, radar, pie, performance facts, and calendar provide multiple analytical lenses without page navigation.

### TradeVault adaptation

- Use this as a density reference for TradeVault dark mode, not as its identity. Keep the cosmic ink background and teal brand tokens, readable text, hairline borders, and semantic chart palette.
- Offer compact density through card sizing, collapsible sidebar, small summary strips, and optional table density—not by shrinking base text below accessible sizes.
- A top analytics scope bar (date/category/currency/playbook) can reduce repeated controls across panels. Active scope must be visible and persist predictably.
- Sparklines are useful in KPI cards when they answer trend, but every chart needs a label, unit, time scope, and accessible summary.
- The calendar and rolling metrics can inform existing Analytics/Review Center layouts; do not duplicate the whole dashboard as a second mode unless user testing proves value.

### Do not copy

- Do not import the blue accent, tiny typography, or high panel count wholesale.
- Radar charts and pie charts are visually rich but often analytically weak; use them only when the dimensions/parts are stable and comparisons remain legible.
- Do not place unrelated scopes in adjacent cards without a common filter indicator.
- Do not optimize a 1200×558 desktop screenshot at the expense of laptop, mobile, focus, contrast, and touch targets.

---

## Cross-reference synthesis — the UI/UX system to borrow

### 1. Composition and hierarchy

- Use a responsive 12-column grid with **three card roles**: hero/anchor (8–12 columns), diagnostic (4–6), and compact fact/attention (2–4). Avoid the current tendency for every card to have equal visual weight.
- Put task context and primary actions in a page header; put global account/search/theme in app chrome; put dataset scope in a sticky local toolbar. These layers should not compete.
- Each route should answer one primary question:
  - Overview: "How am I doing, and what needs attention?"
  - My Trades: "Find and compare records."
  - Trade Detail: "What happened and what should change?"
  - Review Center: "Which behaviors help or hurt?"
  - Analytics: "Where is the edge and risk?"
  - Calendar: "When did results and reviews happen?"
  - Export: "Create a backup or shareable report."

### 2. TradeVault visual language

- Preserve `graphic-identity.md` as the authority: TradeVault teal, white editorial surfaces, ink greys, Newsreader headings, Arial UI, hairline borders, 10–16px radii, rare soft shadows, and a bounded dark/cosmic layer.
- The reference purple/blue maps to teal for active tabs, selection outlines, buttons, keyboard focus, and neutral chart emphasis. Green/red remain reserved for profit/loss and success/danger.
- Use tinted icon tiles sparingly for section identification; icons should be consistent in size/stroke and never replace labels for important actions.
- Use uppercase tracked eyebrows for categories, Newsreader for page/section titles, Arial for controls and tables, and `font-variant-numeric: tabular-nums` for every metric, price, date-aligned count, and P&L value.
- Use surface and border changes before shadows. Reserve the strongest shadow for command palette, modal/drawer, and print-preview page—not every dashboard card.

### 3. Data visualization rules

- Every chart must state metric, unit/currency, scope, and time range. Tooltips repeat these facts; axes use compact but unambiguous formatting.
- Mixed-currency money is never added raw. Split series/totals by currency or use explicitly labelled R-normalized analysis.
- Green/red are outcome semantics; teal/blue-neutral is baseline or interaction. Do not make all upward trends green if they are not profit.
- Use a visible zero line, sufficient contrast, accessible textual summaries, and non-color encodings for selected/negative/positive states.
- Prefer ranked bars/rows over pie and radar when exact comparison matters. Avoid duplicate charts that answer the same question.

### 4. Interaction quality

- Derived feedback should sit beside the input that causes it: Risk Preview in Add, Realized P&L/R in Close, scenario delta in Simulation, filtered summary above My Trades.
- Selection should reveal detail without losing context: table row → detail canvas; calendar day → drawer/panel; heatmap cell → daily trades; command result → exact record.
- Small enumerations use accessible chips/radios; large taxonomies use searchable selects. All controls retain keyboard, touch, and visible-focus behavior.
- Long workspaces use sticky local actions, but errors remain visible and the sticky region never obscures content.
- Empty, loading, error, insufficient-sample, mixed-currency, and no-permission states are designed states—not generic toasts or blank cards.

### 5. Responsive strategy

- Do not merely stack every desktop card. Preserve reading priority: primary KPI/attention → key chart → current work → diagnostics.
- KPI cards can be 2-up on mobile; dense tables become prioritized columns plus row details; drawers become inline panels; sticky filters collapse to a summary button with active-filter count.
- Maintain at least 44px touch targets for primary actions, readable 16px form inputs on mobile, visible focus, reduced motion, and no horizontal page overflow.
- Charts need purposeful mobile heights and simplified ticks, not desktop charts scaled until labels disappear.

---

## Adaptation backlog from the references

### P0 — prerequisite trust and structure

1. Resolve metric naming and all mixed-currency aggregation errors.
2. Split Close / Review / Edit intents and add live Close Preview.
3. Add focus-visible, reduced-motion, contrast, inline validation, and responsive foundations.
4. Establish shared page header, scope toolbar, card roles, numeric typography, and chart-formatting primitives before restyling individual pages.

### P1 — largest visible transformation

1. Recompose Overview into primary KPIs + risk/review attention + anchor charts + calendar preview.
2. Rebuild My Trades around summary ribbon, scalable filter toolbar, sorting, pagination, column controls, sticky header, and trade-detail navigation.
3. Add the dedicated Trade Detail/Review canvas using all current trade, review, playbook, note, and attachment data.
4. Recompose Analytics and Review Center into task-led bento layouts with transparent behavioral evidence and per-currency/R-safe calculations.
5. Upgrade Add Trade through progressive disclosure, chip/radio controls, sticky actions, intelligent defaults, and retained full feature coverage.

### P2 — depth after the core is stable

1. Recent / Month / Year calendar modes with selected-day trade details.
2. Global command search across existing records and libraries.
3. Print/PDF performance report with live HTML preview; retain JSON import/export.
4. Unified Notes/Journal index built on existing notes and links.
5. R histogram, weekday/time-of-day, underwater curve, playbook/setup expectancy, and sample-aware period comparisons.

### P3 — research and schema-dependent

1. MAE/MFE and captured-move analysis after a credible data-capture design.
2. R-normalized Monte Carlo studio with methodology and minimum-sample safeguards.
3. Transparent What-If scenarios that never mutate source records.
4. Any live chart/replay or broker integration only after data-source, privacy, reliability, and licensing decisions.

---

## Non-negotiable implementation acceptance criteria

- Every existing feature in the HARD RULE inventory remains reachable and works in light and dark themes.
- No TradeVault feature is removed merely because it is absent from i1–i14; reference gaps never redefine our product scope.
- The visual result is recognizably TradeVault—not a purple clone. Teal/editorial identity, approved typography, logo system, and restrained elevation remain intact.
- INR and USD are never summed without conversion; combined R views are explicitly labelled.
- All new analytics disclose definition, scope, sample size, and insufficient-data behavior.
- Keyboard navigation, focus visibility, reduced motion, contrast, responsive behavior, loading/error/empty states, and touch targets are part of each feature—not a cleanup phase.
- JSON export/import remains available and honest about external attachment files.
- Implementation begins only after explicit owner approval of this completed review.
