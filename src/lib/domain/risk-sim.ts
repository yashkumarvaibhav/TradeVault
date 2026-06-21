import type { Currency } from "./types";

/**
 * Risk Studio — deterministic Monte-Carlo simulation over realized R-multiples.
 *
 * This is the pure simulation **contract** (P12 slice 1). It bootstraps future
 * equity paths by resampling, with replacement, from a single account's realized
 * R sample (one closed trade = one R-multiple). It is intentionally free of UI,
 * Kelly sizing, and What-If transforms — those build on these green semantics.
 *
 * Invariants:
 * - **Single currency.** The sample is one currency's realized R; R is unitless,
 *   but the result is labelled with its currency and never mixes INR and USD.
 * - **Reproducible.** A given `seed` + input always yields byte-identical output
 *   (a seeded PRNG; no `Math.random`, no `Date`).
 * - **Honest.** Every result carries `label: "historical scenario, not a forecast"`
 *   and enforces a minimum closed-trade sample.
 * - **Pure.** The input arrays are never mutated.
 */

export const RISK_SIM_MIN_SAMPLE = 30;
export const RISK_SIM_LABEL = "historical scenario, not a forecast" as const;
export const DEFAULT_FAN_PERCENTILES = [5, 25, 50, 75, 95] as const;
/** Cap on stored fan checkpoints so output stays small regardless of horizon. */
const MAX_FAN_CHECKPOINTS = 60;
const DRAWDOWN_HISTOGRAM_BINS = 12;

export type RiskSimMode = "fixed" | "compound";

export interface RiskSimInput {
  /** Realized R per closed trade for one currency (non-finite values are dropped). */
  rSamples: readonly number[];
  currency: Currency;
  /** Number of simulated equity paths (e.g. 1000–10000). */
  paths: number;
  /** Trades simulated forward per path. */
  horizon: number;
  /**
   * `fixed`: every trade risks a constant fraction of the *starting* capital
   * (equity += riskFraction · R). `compound`: every trade risks a fraction of
   * *current* equity (equity ·= 1 + riskFraction · R).
   */
  mode: RiskSimMode;
  /** Fraction of capital risked per trade, 0 < r ≤ 1 (e.g. 0.01 = risk 1%). */
  riskFraction: number;
  /** Equity drawdown from the starting capital that counts as ruin, 0 < t < 1. */
  ruinThreshold: number;
  /** Optional winsorization: clamp |R| to this cap to stress reliance on outliers. */
  outlierStressR?: number | null;
  /** Reproducible PRNG seed. */
  seed: number;
  /** Override the minimum closed-trade sample. */
  minSample?: number;
  /** Percentiles (0–100) for the fan + final + drawdown bands. */
  fanPercentiles?: readonly number[];
  /** Target ruin tolerance for the capital requirement (0 < x < 1, e.g. 0.05). */
  ruinTolerance?: number;
}

export interface RiskSimBandPoint {
  step: number;
  /** percentile (e.g. 50) → equity at this step (start = 1.0). */
  percentiles: Record<number, number>;
}

export interface DrawdownBin {
  from: number;
  to: number;
  count: number;
}

export interface RiskSimResult {
  ok: true;
  label: typeof RISK_SIM_LABEL;
  currency: Currency;
  mode: RiskSimMode;
  paths: number;
  horizon: number;
  sampleSize: number;
  seed: number;
  riskFraction: number;
  ruinThreshold: number;
  startEquity: 1;
  expectancyR: number;
  /** Equity bands across the horizon (normalized, start = 1.0). */
  fan: RiskSimBandPoint[];
  /** percentile → final equity (normalized). */
  finalPercentiles: Record<number, number>;
  medianFinalEquity: number;
  /** Fraction of paths whose final equity exceeds the starting capital. */
  probabilityOfProfit: number;
  /** Fraction of paths that breached the ruin floor at any step. */
  riskOfRuin: number;
  /** percentile → peak-to-trough drawdown fraction (0–1). */
  maxDrawdownPercentiles: Record<number, number>;
  maxDrawdownHistogram: DrawdownBin[];
  /**
   * R cushion needed so that only `ruinTolerance` of paths suffer a deeper
   * peak-to-trough loss, measured in R at constant 1R sizing (sizing-independent).
   */
  capitalRequirementR: number;
  ruinTolerance: number;
}

export interface RiskSimError {
  ok: false;
  reason: "insufficient-sample" | "invalid-input";
  message: string;
  sampleSize: number;
  minSample: number;
}

export type RiskSimOutput = RiskSimResult | RiskSimError;

// --- Web Worker message protocol (the worker entry calls `simulateRisk`) ---

export interface RiskSimRequest {
  type: "risk-sim/run";
  id: string;
  input: RiskSimInput;
}

export interface RiskSimResponse {
  type: "risk-sim/result";
  id: string;
  output: RiskSimOutput;
}

/** Deterministic 32-bit PRNG (mulberry32). Same seed → same stream, every run. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Linear-interpolated percentile of an already-ascending-sorted array. */
function percentileOfSorted(sorted: ArrayLike<number>, p: number): number {
  const n = sorted.length;
  if (n === 0) return 0;
  if (n === 1) return sorted[0];
  const rank = (Math.min(100, Math.max(0, p)) / 100) * (n - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo);
}

function percentileRecord(sorted: ArrayLike<number>, percentiles: readonly number[]): Record<number, number> {
  const out: Record<number, number> = {};
  for (const p of percentiles) out[p] = round4(percentileOfSorted(sorted, p));
  return out;
}

function round4(value: number): number {
  return Math.round(value * 1e4) / 1e4;
}

function clampR(r: number, cap: number | null | undefined): number {
  if (cap == null || !(cap > 0)) return r;
  if (r > cap) return cap;
  if (r < -cap) return -cap;
  return r;
}

/** Evenly spaced step checkpoints from 1..horizon, capped for output size. */
function fanCheckpoints(horizon: number): number[] {
  const count = Math.min(horizon, MAX_FAN_CHECKPOINTS);
  const steps: number[] = [];
  for (let i = 1; i <= count; i++) {
    steps.push(Math.max(1, Math.round((i / count) * horizon)));
  }
  // De-dup (small horizons) while preserving order.
  return steps.filter((s, i) => i === 0 || s !== steps[i - 1]);
}

export function simulateRisk(input: RiskSimInput): RiskSimOutput {
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

  const paths = Math.floor(input.paths);
  const horizon = Math.floor(input.horizon);
  const { riskFraction, ruinThreshold } = input;
  const ruinTolerance = input.ruinTolerance ?? 0.05;
  const invalid =
    !(paths >= 1) ||
    !(horizon >= 1) ||
    !(riskFraction > 0 && riskFraction <= 1) ||
    !(ruinThreshold > 0 && ruinThreshold < 1) ||
    !(ruinTolerance > 0 && ruinTolerance < 1) ||
    !Number.isFinite(input.seed);
  if (invalid) {
    return {
      ok: false,
      reason: "invalid-input",
      message: "paths≥1, horizon≥1, 0<riskFraction≤1, 0<ruinThreshold<1, 0<ruinTolerance<1, and a finite seed are required.",
      sampleSize,
      minSample,
    };
  }

  const percentiles = (input.fanPercentiles ?? DEFAULT_FAN_PERCENTILES).slice().sort((a, b) => a - b);
  const stressed = samples.map((r) => clampR(r, input.outlierStressR));
  const n = stressed.length;
  const expectancyR = stressed.reduce((sum, r) => sum + r, 0) / n;

  const checkpoints = fanCheckpoints(horizon);
  const checkpointSet = new Map(checkpoints.map((step, idx) => [step, idx]));
  const fanColumns = checkpoints.map(() => new Float64Array(paths));

  const finalEquity = new Float64Array(paths);
  const maxDrawdownFraction = new Float64Array(paths);
  const maxDrawdownR = new Float64Array(paths); // peak-to-trough loss in R (1R sizing)
  let ruinCount = 0;
  let profitCount = 0;

  const ruinFloor = 1 - ruinThreshold;
  const rand = mulberry32(input.seed);

  for (let p = 0; p < paths; p++) {
    let equity = 1; // normalized capital
    let peakEquity = 1;
    let maxDDFrac = 0;
    let rCum = 0; // cumulative R at constant 1R sizing
    let peakR = 0;
    let maxDDr = 0;
    let ruined = false;

    for (let step = 1; step <= horizon; step++) {
      const r = stressed[(rand() * n) | 0];

      if (input.mode === "compound") {
        equity *= 1 + riskFraction * r;
        if (equity < 0) equity = 0;
      } else {
        equity += riskFraction * r;
        if (equity < 0) equity = 0;
      }
      if (equity > peakEquity) peakEquity = equity;
      const ddFrac = peakEquity > 0 ? (peakEquity - equity) / peakEquity : 0;
      if (ddFrac > maxDDFrac) maxDDFrac = ddFrac;
      if (equity <= ruinFloor) ruined = true;

      rCum += r;
      if (rCum > peakR) peakR = rCum;
      const ddR = peakR - rCum;
      if (ddR > maxDDr) maxDDr = ddR;

      const col = checkpointSet.get(step);
      if (col !== undefined) fanColumns[col][p] = equity;
    }

    finalEquity[p] = equity;
    maxDrawdownFraction[p] = maxDDFrac;
    maxDrawdownR[p] = maxDDr;
    if (ruined) ruinCount++;
    if (equity > 1) profitCount++;
  }

  const fan: RiskSimBandPoint[] = checkpoints.map((step, idx) => {
    const sorted = Float64Array.prototype.slice.call(fanColumns[idx]).sort(ascending);
    return { step, percentiles: percentileRecord(sorted, percentiles) };
  });

  const sortedFinal = Float64Array.prototype.slice.call(finalEquity).sort(ascending);
  const sortedDDFrac = Float64Array.prototype.slice.call(maxDrawdownFraction).sort(ascending);
  const sortedDDr = Float64Array.prototype.slice.call(maxDrawdownR).sort(ascending);

  return {
    ok: true,
    label: RISK_SIM_LABEL,
    currency: input.currency,
    mode: input.mode,
    paths,
    horizon,
    sampleSize,
    seed: input.seed,
    riskFraction,
    ruinThreshold,
    startEquity: 1,
    expectancyR: round4(expectancyR),
    fan,
    finalPercentiles: percentileRecord(sortedFinal, percentiles),
    medianFinalEquity: round4(percentileOfSorted(sortedFinal, 50)),
    probabilityOfProfit: round4(profitCount / paths),
    riskOfRuin: round4(ruinCount / paths),
    maxDrawdownPercentiles: percentileRecord(sortedDDFrac, percentiles),
    maxDrawdownHistogram: buildDrawdownHistogram(sortedDDFrac),
    capitalRequirementR: round4(percentileOfSorted(sortedDDr, (1 - ruinTolerance) * 100)),
    ruinTolerance,
  };
}

function ascending(a: number, b: number): number {
  return a - b;
}

function buildDrawdownHistogram(sortedDDFrac: ArrayLike<number>): DrawdownBin[] {
  const n = sortedDDFrac.length;
  const max = n > 0 ? sortedDDFrac[n - 1] : 0;
  const top = max > 0 ? max : 1;
  const width = top / DRAWDOWN_HISTOGRAM_BINS;
  const bins: DrawdownBin[] = [];
  for (let i = 0; i < DRAWDOWN_HISTOGRAM_BINS; i++) {
    bins.push({ from: round4(i * width), to: round4((i + 1) * width), count: 0 });
  }
  for (let i = 0; i < n; i++) {
    const value = sortedDDFrac[i];
    let idx = width > 0 ? Math.floor(value / width) : 0;
    if (idx >= DRAWDOWN_HISTOGRAM_BINS) idx = DRAWDOWN_HISTOGRAM_BINS - 1;
    if (idx < 0) idx = 0;
    bins[idx].count++;
  }
  return bins;
}
