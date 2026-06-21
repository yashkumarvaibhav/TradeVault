import type { Currency } from "@/lib/domain/types";

export interface ExcursionAnalyticsSample {
  symbol: string;
  currency: Currency;
  realizedR: number | null;
  mfeR: number | null;
  maeR: number | null;
  capturedMovePct: number | null;
}

export interface ExcursionPoint {
  symbol: string;
  realizedR: number;
  mfeR: number;
  maeR: number | null;
  capturedMovePct: number;
}

export interface CurrencyExcursionAnalytics {
  sampleSize: number;
  maeSampleSize: number;
  avgMfeR: number;
  avgMaeR: number | null;
  medianCapturedMovePct: number;
  points: ExcursionPoint[];
}

export type CurrencyExcursionAnalyticsMap = Partial<Record<Currency, CurrencyExcursionAnalytics>>;

function finite(value: number | null): value is number {
  return value != null && Number.isFinite(value);
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]) {
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

/** Build single-currency diagnostics from manually captured excursion evidence. */
export function buildExcursionAnalyticsByCurrency(samples: ExcursionAnalyticsSample[]): CurrencyExcursionAnalyticsMap {
  const grouped: Partial<Record<Currency, ExcursionPoint[]>> = {};
  for (const sample of samples) {
    if (!finite(sample.realizedR) || !finite(sample.mfeR) || !finite(sample.capturedMovePct)) continue;
    (grouped[sample.currency] ??= []).push({
      symbol: sample.symbol,
      realizedR: sample.realizedR,
      mfeR: sample.mfeR,
      maeR: finite(sample.maeR) ? sample.maeR : null,
      capturedMovePct: sample.capturedMovePct,
    });
  }

  const result: CurrencyExcursionAnalyticsMap = {};
  for (const currency of ["INR", "USD"] as const) {
    const points = grouped[currency];
    if (!points?.length) continue;
    const maeValues = points.map((point) => point.maeR).filter(finite);
    result[currency] = {
      sampleSize: points.length,
      maeSampleSize: maeValues.length,
      avgMfeR: average(points.map((point) => point.mfeR)),
      avgMaeR: maeValues.length ? average(maeValues) : null,
      medianCapturedMovePct: median(points.map((point) => point.capturedMovePct)),
      points,
    };
  }
  return result;
}
