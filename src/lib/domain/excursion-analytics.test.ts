import { describe, expect, it } from "vitest";

import { buildExcursionAnalyticsByCurrency, type ExcursionAnalyticsSample } from "./excursion-analytics";

const samples: ExcursionAnalyticsSample[] = [
  { symbol: "NIFTY", currency: "INR", realizedR: 1, mfeR: 2, maeR: 0.5, capturedMovePct: 50 },
  { symbol: "BANKNIFTY", currency: "INR", realizedR: 2, mfeR: 2.5, maeR: null, capturedMovePct: 80 },
  { symbol: "AAPL", currency: "USD", realizedR: -1, mfeR: 0.5, maeR: 1, capturedMovePct: -200 },
];

describe("excursion analytics", () => {
  it("keeps currencies isolated and computes manual-evidence summaries", () => {
    const result = buildExcursionAnalyticsByCurrency(samples);
    expect(result.INR).toMatchObject({ sampleSize: 2, maeSampleSize: 1, avgMfeR: 2.25, avgMaeR: 0.5, medianCapturedMovePct: 65 });
    expect(result.USD).toMatchObject({ sampleSize: 1, maeSampleSize: 1, avgMfeR: 0.5, avgMaeR: 1, medianCapturedMovePct: -200 });
    expect(result.INR?.points.map((point) => point.symbol)).toEqual(["NIFTY", "BANKNIFTY"]);
  });

  it("excludes incomplete and non-finite rows instead of inventing zeroes", () => {
    const result = buildExcursionAnalyticsByCurrency([
      { symbol: "OPEN", currency: "INR", realizedR: null, mfeR: null, maeR: null, capturedMovePct: null },
      { symbol: "PARTIAL", currency: "INR", realizedR: 1, mfeR: null, maeR: 0.2, capturedMovePct: null },
      { symbol: "BAD", currency: "USD", realizedR: Number.NaN, mfeR: 1, maeR: 1, capturedMovePct: 20 },
    ]);
    expect(result).toEqual({});
  });

  it("does not mutate its samples while calculating medians", () => {
    const input = structuredClone(samples);
    buildExcursionAnalyticsByCurrency(samples);
    expect(samples).toEqual(input);
  });
});
