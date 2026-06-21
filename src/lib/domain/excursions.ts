import { effectiveUnits, plannedRisk, realizedPnl } from "./pnl";
import type { TradeMath } from "./types";

/**
 * Manual excursion evidence for one trade. These are observed price extrema,
 * never inferred candles or broker data.
 */
export interface ExcursionInput extends TradeMath {
  mfePrice?: number | null;
  maePrice?: number | null;
}

export interface ExcursionMetrics {
  mfeAmount: number | null;
  maeAmount: number | null;
  mfePct: number | null;
  maePct: number | null;
  mfeR: number | null;
  maeR: number | null;
  capturedMovePct: number | null;
}

export type ExcursionErrors = Partial<Record<"mfePrice" | "maePrice", string>>;

const finitePositive = (value: number | null | undefined) => value == null || Number.isFinite(value) && value > 0;

/**
 * Compute maximum favorable/adverse excursion from manually captured extrema.
 * MAE is returned as a positive magnitude. Captured move is signed realized
 * P&L divided by MFE; a losing exit after favorable movement is therefore
 * honestly negative. Missing evidence stays null rather than becoming zero.
 */
export function evaluateExcursions(input: ExcursionInput): { errors: ExcursionErrors; metrics: ExcursionMetrics } {
  const errors: ExcursionErrors = {};
  const entry = input.entryPrice ?? 0;
  const exit = input.exitPrice ?? null;

  if (!finitePositive(input.mfePrice)) errors.mfePrice = "Enter a positive maximum favorable price.";
  if (!finitePositive(input.maePrice)) errors.maePrice = "Enter a positive maximum adverse price.";

  if (entry > 0 && input.mfePrice != null && Number.isFinite(input.mfePrice) && input.mfePrice > 0) {
    const favorableBoundary = exit == null
      ? entry
      : input.direction === "Long" ? Math.max(entry, exit) : Math.min(entry, exit);
    if (input.direction === "Long" && input.mfePrice < favorableBoundary) {
      errors.mfePrice = `For a Long trade, maximum favorable price must be at least ${favorableBoundary}.`;
    }
    if (input.direction === "Short" && input.mfePrice > favorableBoundary) {
      errors.mfePrice = `For a Short trade, maximum favorable price must be at most ${favorableBoundary}.`;
    }
  }

  if (entry > 0 && input.maePrice != null && Number.isFinite(input.maePrice) && input.maePrice > 0) {
    const adverseBoundary = exit == null
      ? entry
      : input.direction === "Long" ? Math.min(entry, exit) : Math.max(entry, exit);
    if (input.direction === "Long" && input.maePrice > adverseBoundary) {
      errors.maePrice = `For a Long trade, maximum adverse price must be at most ${adverseBoundary}.`;
    }
    if (input.direction === "Short" && input.maePrice < adverseBoundary) {
      errors.maePrice = `For a Short trade, maximum adverse price must be at least ${adverseBoundary}.`;
    }
  }

  const units = effectiveUnits(input);
  const fx = input.fxToAccount ?? 1;
  const canCompute = entry > 0 && units > 0 && Number.isFinite(fx) && fx > 0;
  const favorableMove = canCompute && input.mfePrice != null && !errors.mfePrice
    ? input.direction === "Long" ? input.mfePrice - entry : entry - input.mfePrice
    : null;
  const adverseMove = canCompute && input.maePrice != null && !errors.maePrice
    ? input.direction === "Long" ? entry - input.maePrice : input.maePrice - entry
    : null;
  const mfeAmount = favorableMove == null ? null : favorableMove * units * fx;
  const maeAmount = adverseMove == null ? null : adverseMove * units * fx;
  const risk = plannedRisk(input);
  const pnl = realizedPnl(input);

  return {
    errors,
    metrics: {
      mfeAmount,
      maeAmount,
      mfePct: favorableMove == null ? null : favorableMove / entry * 100,
      maePct: adverseMove == null ? null : adverseMove / entry * 100,
      mfeR: mfeAmount == null || !risk ? null : mfeAmount / risk,
      maeR: maeAmount == null || !risk ? null : maeAmount / risk,
      capturedMovePct: mfeAmount == null || mfeAmount <= 0 || pnl == null ? null : pnl / mfeAmount * 100,
    },
  };
}
