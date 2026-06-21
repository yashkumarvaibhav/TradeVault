import {
  RISK_SIM_LABEL,
  RISK_SIM_MIN_SAMPLE,
  simulateRisk,
  type RiskSimMode,
} from "./risk-sim";
import type { Currency } from "./types";

/**
 * Risk Studio — Kelly optimal sizing + position-size stress (P12 slice 3).
 *
 * Pure, single-currency, built on the same realized-R sample as the Monte Carlo.
 * Kelly is reported two ways: the classic binary formula `f* = W − (1−W)/R` and an
 * empirical log-growth scan over the *actual* R distribution (more honest about fat
 * tails). Both are labelled historical scenarios; nothing here mutates source data.
 */

export interface KellyResult {
  ok: true;
  label: typeof RISK_SIM_LABEL;
  currency: Currency;
  sampleSize: number;
  winRate: number;
  avgWinR: number;
  avgLossR: number; // positive magnitude of the average losing R
  payoffRatio: number | null;
  /** Classic Kelly fraction f* = W − (1−W)/R, clamped to [0, maxSafeFraction]. */
  kellyFraction: number;
  halfKelly: number;
  quarterKelly: number;
  /** Fraction that empirically maximizes mean ln(1 + f·R) over the sample. */
  growthOptimalFraction: number;
  /** Largest fraction where a single worst-case R cannot wipe the account. */
  maxSafeFraction: number;
  growthCurve: { fraction: number; growth: number }[];
}

export interface KellyError {
  ok: false;
  reason: "insufficient-sample" | "no-edge";
  message: string;
  sampleSize: number;
  minSample: number;
}

export type KellyOutput = KellyResult | KellyError;

const GROWTH_CURVE_POINTS = 41;

function round4(value: number): number {
  return Math.round(value * 1e4) / 1e4;
}

function meanLogGrowth(samples: readonly number[], fraction: number): number {
  let sum = 0;
  for (const r of samples) {
    const factor = 1 + fraction * r;
    // A non-positive factor means this fraction can be wiped out by this trade.
    if (factor <= 0) return Number.NEGATIVE_INFINITY;
    sum += Math.log(factor);
  }
  return sum / samples.length;
}

export function computeKelly(input: { rSamples: readonly number[]; currency: Currency; minSample?: number }): KellyOutput {
  const minSample = input.minSample ?? RISK_SIM_MIN_SAMPLE;
  const samples = input.rSamples.filter((r) => Number.isFinite(r));
  const sampleSize = samples.length;
  if (sampleSize < minSample) {
    return {
      ok: false,
      reason: "insufficient-sample",
      message: `Need at least ${minSample} closed ${input.currency} trades with a computable R; have ${sampleSize}.`,
      sampleSize,
      minSample,
    };
  }

  const wins = samples.filter((r) => r > 0);
  const losses = samples.filter((r) => r < 0);
  const winRate = wins.length / sampleSize;
  const avgWinR = wins.length ? wins.reduce((s, r) => s + r, 0) / wins.length : 0;
  const avgLossR = losses.length ? Math.abs(losses.reduce((s, r) => s + r, 0) / losses.length) : 0;
  const payoffRatio = avgLossR > 0 ? avgWinR / avgLossR : null;

  // Largest fraction that survives the single worst losing R (1 + f·minR > 0).
  const worstLoss = losses.length ? Math.abs(Math.min(...losses)) : 0;
  const maxSafeFraction = worstLoss > 0 ? 1 / worstLoss : 1;

  const formulaKelly = payoffRatio != null && payoffRatio > 0 ? winRate - (1 - winRate) / payoffRatio : winRate > 0 ? 1 : 0;
  const kellyFraction = Math.max(0, Math.min(formulaKelly, maxSafeFraction));

  if (kellyFraction <= 0) {
    // Still return a result so the UI can explain "no edge → don't size up".
    return {
      ok: false,
      reason: "no-edge",
      message: `This ${input.currency} sample has no positive Kelly edge (win rate ${(winRate * 100).toFixed(0)}% at ${payoffRatio == null ? "n/a" : payoffRatio.toFixed(2)}:1 payoff). Optimal size is 0 — do not bet this edge.`,
      sampleSize,
      minSample,
    };
  }

  // Empirical growth-optimal fraction: scan (0, maxSafeFraction) for argmax growth.
  const scanCap = maxSafeFraction * 0.999;
  const growthCurve: { fraction: number; growth: number }[] = [];
  let growthOptimalFraction = 0;
  let bestGrowth = Number.NEGATIVE_INFINITY;
  for (let i = 1; i <= GROWTH_CURVE_POINTS; i++) {
    const fraction = (i / GROWTH_CURVE_POINTS) * scanCap;
    const growth = meanLogGrowth(samples, fraction);
    growthCurve.push({ fraction: round4(fraction), growth: round4(growth) });
    if (growth > bestGrowth) {
      bestGrowth = growth;
      growthOptimalFraction = fraction;
    }
  }

  return {
    ok: true,
    label: RISK_SIM_LABEL,
    currency: input.currency,
    sampleSize,
    winRate: round4(winRate),
    avgWinR: round4(avgWinR),
    avgLossR: round4(avgLossR),
    payoffRatio: payoffRatio == null ? null : round4(payoffRatio),
    kellyFraction: round4(kellyFraction),
    halfKelly: round4(kellyFraction / 2),
    quarterKelly: round4(kellyFraction / 4),
    growthOptimalFraction: round4(growthOptimalFraction),
    maxSafeFraction: round4(maxSafeFraction),
    growthCurve,
  };
}

// --- Position-size stress: re-run the Monte Carlo across risk fractions ---

export interface SizingStressPoint {
  fraction: number;
  riskOfRuin: number;
  medianFinalEquity: number;
  maxDrawdown95: number;
}

export interface SizingStressResult {
  ok: true;
  label: typeof RISK_SIM_LABEL;
  currency: Currency;
  points: SizingStressPoint[];
}

export interface SizingStressInput {
  rSamples: readonly number[];
  currency: Currency;
  fractions: readonly number[];
  paths: number;
  horizon: number;
  ruinThreshold: number;
  outlierStressR?: number | null;
  seed: number;
  mode?: RiskSimMode;
  minSample?: number;
}

export function stressPositionSizes(input: SizingStressInput): SizingStressResult | KellyError {
  const minSample = input.minSample ?? RISK_SIM_MIN_SAMPLE;
  const sampleSize = input.rSamples.filter((r) => Number.isFinite(r)).length;
  if (sampleSize < minSample) {
    return {
      ok: false,
      reason: "insufficient-sample",
      message: `Need at least ${minSample} closed ${input.currency} trades; have ${sampleSize}.`,
      sampleSize,
      minSample,
    };
  }

  const points: SizingStressPoint[] = [];
  for (const fraction of input.fractions) {
    // Every fraction uses the same seed so the comparison isolates sizing, not luck.
    const out = simulateRisk({
      rSamples: input.rSamples,
      currency: input.currency,
      paths: input.paths,
      horizon: input.horizon,
      mode: input.mode ?? "compound",
      riskFraction: fraction,
      ruinThreshold: input.ruinThreshold,
      outlierStressR: input.outlierStressR,
      seed: input.seed,
      fanPercentiles: [50, 95],
    });
    if (!out.ok) continue;
    points.push({
      fraction: round4(fraction),
      riskOfRuin: out.riskOfRuin,
      medianFinalEquity: out.medianFinalEquity,
      maxDrawdown95: out.maxDrawdownPercentiles[95] ?? 0,
    });
  }

  return { ok: true, label: RISK_SIM_LABEL, currency: input.currency, points };
}
