/**
 * TradeVault P&L / R-multiple engine.
 *
 * Ported 1:1 from v1 (Flask `app.py` at commit edbce1f, lines 571-649). The
 * Python tests (`tests/test_app_smoke.py` at edbce1f) are the oracle — see
 * `pnl.test.ts`. Behavior preserved exactly:
 *   - effective units = quantity × multiplier   (v1: position_size × lot_size for lot-sized categories)
 *   - realized P&L is direction-aware           Long: (exit-entry)·u   Short: (entry-exit)·u
 *   - a manual-P&L override (Forex path) wins over price-based P&L
 *   - functions return `null` when a value is not computable (open trade,
 *     missing exit, missing/zero entry/stop/units) — never a misleading 0
 *
 * `null` semantics matter: callers render null as "—", not as zero.
 */

import type { Money, TradeMath } from "./types";

const num = (v: number | null | undefined): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** quantity × multiplier (multiplier defaults to 1). */
export function effectiveUnits(t: TradeMath): number {
  return num(t.quantity) * (t.multiplier == null ? 1 : num(t.multiplier));
}

const fx = (t: TradeMath): number => (t.fxToAccount == null ? 1 : num(t.fxToAccount));

/** Realized P&L in account currency, or null if not computable. */
export function realizedPnl(t: TradeMath): number | null {
  if (t.status !== "closed") return null;
  // Manual-P&L override (Forex path) takes precedence.
  if (t.manualPnl != null) return num(t.manualPnl);
  if (t.exitPrice == null) return null;

  const entry = num(t.entryPrice);
  const exit = num(t.exitPrice);
  const units = effectiveUnits(t);
  if (entry <= 0 || units <= 0) return null;

  const move = t.direction === "Short" ? entry - exit : exit - entry;
  return move * units * fx(t);
}

/** Realized P&L as a percentage of position value, or null. */
export function realizedPnlPct(t: TradeMath, pnl?: number | null): number | null {
  const entry = num(t.entryPrice);
  const units = effectiveUnits(t);
  if (entry <= 0 || units <= 0) return null;
  const p = pnl === undefined ? realizedPnl(t) : pnl;
  if (p == null) return null;
  return (p / (entry * units * fx(t))) * 100;
}

/** Planned 1R risk = |entry - stop| × units × fx, or null. */
export function plannedRisk(t: TradeMath): number | null {
  const entry = num(t.entryPrice);
  const stop = num(t.stopLoss);
  const units = effectiveUnits(t);
  if (entry <= 0 || stop <= 0 || units <= 0) return null;
  return Math.abs(entry - stop) * units * fx(t);
}

/** Planned reward to target (direction-aware), or null. */
export function plannedReward(t: TradeMath): number | null {
  if (t.plannedTarget == null) return null;
  const entry = num(t.entryPrice);
  const target = num(t.plannedTarget);
  const units = effectiveUnits(t);
  if (entry <= 0 || target <= 0 || units <= 0) return null;
  const reward = t.direction === "Short" ? entry - target : target - entry;
  return reward * units * fx(t);
}

/** Planned reward-to-risk ratio, or null (also null for non-positive reward). */
export function plannedRR(t: TradeMath): number | null {
  const risk = plannedRisk(t);
  const reward = plannedReward(t);
  if (!risk || reward == null || reward <= 0) return null;
  return reward / risk;
}

/** Realized R-multiple = realized P&L ÷ 1R risk, or null. */
export function realizedR(t: TradeMath, pnl?: number | null): number | null {
  const risk = plannedRisk(t);
  if (!risk) return null;
  const p = pnl === undefined ? realizedPnl(t) : pnl;
  if (p == null) return null;
  return p / risk;
}

/**
 * Sum a list of Money values. Throws if the list mixes currencies — this is the
 * runtime guard behind the "never sum INR and USD raw" invariant. Aggregate
 * analytics must group by currency and call this per group.
 */
export function sumMoney(items: Money[]): Money {
  if (items.length === 0) throw new Error("sumMoney: cannot sum an empty list");
  const { currency } = items[0];
  let amount = 0;
  for (const m of items) {
    if (m.currency !== currency) {
      throw new Error(`Cannot sum mixed currencies (${currency} + ${m.currency}); group by currency first.`);
    }
    amount += m.amount;
  }
  return { currency, amount };
}
