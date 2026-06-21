import { describe, expect, it } from "vitest";

import { computeKelly, stressPositionSizes } from "./risk-kelly";

/** Deterministic positive-edge sample: 60% wins at +2R, 40% losses at −1R. */
function edgeSample(n = 60): number[] {
  return Array.from({ length: n }, (_, i) => (i % 5 < 3 ? 2 : -1));
}

describe("risk-kelly — Kelly optimal sizing", () => {
  it("enforces the minimum sample", () => {
    const out = computeKelly({ rSamples: edgeSample(10), currency: "INR" });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("insufficient-sample");
  });

  it("computes the textbook Kelly fraction f* = W − (1−W)/R", () => {
    const out = computeKelly({ rSamples: edgeSample(60), currency: "INR" });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    // W=0.6, avgWin=2R, avgLoss=1R → payoff 2 → f* = 0.6 − 0.4/2 = 0.4.
    expect(out.winRate).toBeCloseTo(0.6, 4);
    expect(out.payoffRatio).toBeCloseTo(2, 4);
    expect(out.kellyFraction).toBeCloseTo(0.4, 4);
    expect(out.halfKelly).toBeCloseTo(0.2, 4);
    expect(out.quarterKelly).toBeCloseTo(0.1, 4);
    expect(out.label).toBe("historical scenario, not a forecast");
  });

  it("caps sizing at the worst-loss survival bound", () => {
    // A single −4R loss means fractions ≥ 0.25 can be wiped out by one trade.
    const out = computeKelly({ rSamples: [...edgeSample(58), -4, -4], currency: "INR" });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.maxSafeFraction).toBeCloseTo(0.25, 4);
    expect(out.kellyFraction).toBeLessThanOrEqual(out.maxSafeFraction);
    expect(out.growthCurve.every((p) => Number.isFinite(p.growth))).toBe(true);
  });

  it("places the empirical growth optimum inside the survival bound", () => {
    const out = computeKelly({ rSamples: edgeSample(60), currency: "INR" });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.growthOptimalFraction).toBeGreaterThan(0);
    expect(out.growthOptimalFraction).toBeLessThan(out.maxSafeFraction);
    // The reported optimum is the argmax of the scanned growth curve.
    const best = out.growthCurve.reduce((a, b) => (b.growth > a.growth ? b : a));
    expect(out.growthOptimalFraction).toBeCloseTo(best.fraction, 4);
  });

  it("refuses to size a no-edge sample", () => {
    const out = computeKelly({ rSamples: Array.from({ length: 60 }, (_, i) => (i % 2 ? -1 : 0.5)), currency: "USD" });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.reason).toBe("no-edge");
  });

  it("does not mutate the input sample", () => {
    const rSamples = edgeSample(60);
    const snapshot = [...rSamples];
    computeKelly({ rSamples, currency: "INR" });
    expect(rSamples).toEqual(snapshot);
  });
});

describe("risk-kelly — position-size stress", () => {
  it("returns a point per fraction and grows ruin with size", () => {
    const out = stressPositionSizes({
      rSamples: edgeSample(60),
      currency: "INR",
      fractions: [0.01, 0.05, 0.1, 0.25, 0.45],
      paths: 1500,
      horizon: 60,
      ruinThreshold: 0.5,
      seed: 99,
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.points).toHaveLength(5);
    // Over-betting must not reduce ruin: the largest fraction is at least as ruinous
    // as the smallest on this positive-but-volatile edge.
    expect(out.points[out.points.length - 1].riskOfRuin).toBeGreaterThanOrEqual(out.points[0].riskOfRuin);
    expect(out.points[0].medianFinalEquity).toBeGreaterThan(0);
  });

  it("is reproducible across runs with the same seed", () => {
    const params = { rSamples: edgeSample(60), currency: "INR" as const, fractions: [0.02, 0.1], paths: 1000, horizon: 40, ruinThreshold: 0.5, seed: 7 };
    expect(JSON.stringify(stressPositionSizes(params))).toBe(JSON.stringify(stressPositionSizes(params)));
  });

  it("enforces the minimum sample", () => {
    const out = stressPositionSizes({ rSamples: edgeSample(10), currency: "INR", fractions: [0.01], paths: 500, horizon: 20, ruinThreshold: 0.5, seed: 1 });
    expect(out.ok).toBe(false);
  });
});
