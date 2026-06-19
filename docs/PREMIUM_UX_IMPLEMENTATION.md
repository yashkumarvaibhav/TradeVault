# TradeVault Premium UX — Implementation State

**Purpose:** Durable source of truth for implementation across Codex and Claude Code sessions.

**Review source:** `docs/PREMIUM_UX_REVIEW.md`  
**Identity source:** `../graphic-identity.md`  
**Repository:** `/home/siddhartha/TradeVault/app`  
**Starting baseline:** `1602f3657807add3366b534f5b25451ea8280165`  
**Deployment:** Not authorized by this tracker. Implement, test, commit, and push only unless the user explicitly requests deployment.

## Status vocabulary

- `TODO` — unstarted.
- `IN PROGRESS` — exactly one task currently owned by an agent.
- `BLOCKED` — cannot continue; blocker and evidence must be recorded.
- `DONE` — acceptance criteria met, tests recorded, and committed.
- `DEFERRED` — explicitly postponed with a reason; not silently dropped.

## Current checkpoint

**Active task:** `UX-P0-001` — Correct payoff-ratio terminology.  
**State:** `IN PROGRESS`  
**Owner:** Codex  
**Baseline:** `1602f3657807add3366b534f5b25451ea8280165`  
**Working tree at claim:** Clean.  
**Baseline verification:** Python compile, smoke suite, and JavaScript syntax all pass on 2026-06-19 UTC.  
**Next exact action:** Introduce an explicit `payoff_ratio` analytics field while retaining `win_loss_ratio` as a compatibility alias, update Overview/Analytics labels and JavaScript consumers, add smoke assertions, then run standard verification.

## Execution order

Do not begin a later phase merely because it is visually exciting. Finish trust and shared primitives first. Within a phase, dependency order may override numeric order; record any reorder in the worklog.

### Phase P0 — correctness, trust, and foundations

| ID | Status | Scope | Acceptance summary |
|---|---|---|---|
| `UX-P0-001` | IN PROGRESS | Correct payoff-ratio terminology | UI says Payoff Ratio; API exposes `payoff_ratio`; compatibility retained; tests cover formula/label contract. |
| `UX-P0-002` | TODO | Eliminate raw mixed-currency aggregation | Overview and Analytics money totals/series split by currency or require currency scope; warnings appear wherever needed; tests cover INR+USD. |
| `UX-P0-003` | TODO | Split Close / Review / Edit intent | Close and Review lead with relevant fields; historical entry data is read-only by default; Edit retains full form. |
| `UX-P0-004` | TODO | Live Close Preview | Direction-aware realized P&L and realized R update before submit; Forex manual-P&L path retained and tested. |
| `UX-P0-005` | TODO | Accessibility foundation | Visible focus, reduced motion, contrast fixes, keyboard modal behavior, and touch-safe controls. |
| `UX-P0-006` | TODO | Auth brand consistency | Real TradeVault mark on all auth/recovery pages; approved identity retained in light/dark. |
| `UX-P0-007` | TODO | Inline validation foundation | Field-linked errors, readable labels, first-error focus, persistent error summary; server validation remains authoritative. |
| `UX-P0-008` | TODO | Shared visual/data primitives | Page header, scope toolbar, card roles, tabular figures, chart unit/tooltip/zero-line helpers, and state patterns. |

### Phase P1 — primary workflow transformation

| ID | Status | Scope | Acceptance summary |
|---|---|---|---|
| `UX-P1-001` | TODO | Overview composition | Primary per-currency KPIs, risk/review attention, anchor charts, calendar preview, filters retained in a compact disclosure. |
| `UX-P1-002` | TODO | Scalable My Trades | Summary ribbon, all existing filters, sorting, pagination, sticky header, numeric alignment, column controls/row details. |
| `UX-P1-003` | TODO | Dedicated Trade Detail/Review canvas | Existing trade, lifecycle, playbook, notes, review, and attachment data composed without feature loss. |
| `UX-P1-004` | TODO | Add Trade workspace | Intelligent date/currency defaults, progressive disclosure, quick controls, sticky actions, full multi-asset behavior retained. |
| `UX-P1-005` | TODO | Analytics composition | Per-currency/R-safe bento layout with definitions, sample states, improved breakdowns, and no duplicate charts. |
| `UX-P1-006` | TODO | Review Center composition | Evidence-led behavior cards, transparent cohorts, period comparison, queue and adjustment workflow retained. |
| `UX-P1-007` | TODO | Responsive primary workflows | Designed mobile reading order, 2-up KPIs, filter summaries, inline drawers, accessible chart sizing, no page overflow. |

### Phase P2 — additional depth

| ID | Status | Scope | Acceptance summary |
|---|---|---|---|
| `UX-P2-001` | TODO | Calendar modes | Recent/Month/Year modes, accessible day details, mixed-currency-safe encoding. |
| `UX-P2-002` | TODO | Global command search | Keyboard/click access across trades, instruments, libraries, and notes with correct deep links. |
| `UX-P2-003` | TODO | Print/PDF report | Accessible live HTML preview and print output; JSON import/export preserved; currency scope explicit. |
| `UX-P2-004` | TODO | Unified notes index | Index existing linked notes first; ownership/export/deletion semantics defined before new folders/templates. |
| `UX-P2-005` | TODO | Advanced transparent analytics | R histogram, weekday/time, underwater curve, sample-aware setup/playbook expectancy, period comparison. |

### Phase P3 — research/schema dependent

| ID | Status | Scope | Acceptance summary |
|---|---|---|---|
| `UX-P3-001` | TODO | MAE/MFE capture and analysis | Credible capture model, migration, entry/review UI, calculation tests; never inferred from unavailable data. |
| `UX-P3-002` | TODO | R-normalized Monte Carlo | Methodology, minimum sample, reproducible paths, warnings, no mixed-money simulation. |
| `UX-P3-003` | TODO | Transparent What-If | Immutable source trades, documented transformations, baseline comparison, sample impact disclosed. |
| `UX-P3-004` | DEFERRED | Live chart/replay or broker integration | Requires separate data-source, privacy, reliability, and licensing decision. |

## Global acceptance gates

Every task must satisfy all applicable gates:

1. No feature from the review's HARD RULE inventory is removed or made unreachable.
2. Light and dark themes remain complete; mobile behavior is intentional rather than a blind desktop stack.
3. INR and USD are never summed raw; combined R views are explicitly labelled.
4. Loading, empty, error, insufficient-sample, mixed-currency, and permission states are handled.
5. Keyboard focus, reduced motion, contrast, screen-reader labels, and touch targets are included in the slice.
6. API/schema changes retain compatibility or include a documented migration.
7. Focused automated tests and standard verification pass.
8. Tracker and worklog are updated in the same commit as the implementation checkpoint.

## Resume protocol

1. Run `git status --short --branch` and compare `HEAD` with this checkpoint.
2. Read the latest worklog entry. Inspect its referenced diff/commit; do not trust status text alone.
3. If the active task is `IN PROGRESS`, continue only its "Next exact action." If the worktree contains unexplained changes, inspect and record them before editing.
4. If the task is `DONE`, select the next dependency-safe `TODO`, mark it `IN PROGRESS`, set owner/baseline/next action, and commit that claim with or before implementation.
5. Run focused checks during work and the standard verification before committing.
6. Update this checkpoint and append the worklog even when blocked or interrupted.

## Standard verification

```bash
.venv/bin/python -m py_compile app.py
.venv/bin/python -m unittest discover -s tests
node --check static/js/app.js
git diff --check
```

Visual slices additionally require recorded desktop/mobile and light/dark inspection. Deployment verification is separate and only occurs when explicitly authorized.

