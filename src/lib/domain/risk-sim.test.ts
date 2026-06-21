import { describe, expect, it } from "vitest";

import {
  RISK_SIM_LABEL,
  RISK_SIM_MIN_SAMPLE,
  simulateRisk,
  type RiskSimInput,
  type RiskSimResult,
} from "./risk-sim";

function baseInput(overrides: Partial<RiskSimInput> = {}): RiskSimInput {
  return {
    rSamples: mixedSample(60),
    currency: "INR",
    paths: 2000,
    horizon: 40,
    mode: "fixed",
    riskFraction: 0.1,
    ruinThreshold: 0.5,
    seed: 12345,
    ...overrides,
  };
}

/** Deterministic mixed sample with slightly positive expectancy (+0.55R mean). */
function mixedSample(n: number): number[] {
  const base = [2, 1.5, 1, 1, -1, -1, -0.5, 3, -1, 0.5];
  return Array.from({ length: n }, (_, i) => base[i % base.length]);
}

function expectOk(input: RiskSimInput): RiskSimResult {
  const out = simulateRisk(input);
  if (!out.ok) throw new Error(`expected ok result, got ${out.reason}: ${out.message}`);
  return out;
}

describe("risk-sim — Monte Carlo contract", () => {
  it("enforces the minimum closed-trade sample and stays honest about it", () => {
    const out = simulateRisk(baseInput({ rSamples: mixedSample(RISK_SIM_MIN_SAMPLE - 1) }));
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.reason).toBe("insufficient-sample");
    expect(out.minSample).toBe(RISK_SIM_MIN_SAMPLE);
    expect(out.sampleSize).toBe(RISK_SIM_MIN_SAMPLE - 1);
  });

  it("rejects invalid simulation parameters", () => {
    for (const bad of [
      { riskFraction: 0 },
      { riskFraction: 1.5 },
      { ruinThreshold: 0 },
      { ruinThreshold: 1 },
      { paths: 0 },
      { horizon: 0 },
      { seed: Number.NaN },
    ] satisfies Partial<RiskSimInput>[]) {
      const out = simulateRisk(baseInput(bad));
      expect(out.ok, JSON.stringify(bad)).toBe(false);
      if (!out.ok) expect(out.reason).toBe("invalid-input");
    }
  });

  it("labels every result a historical scenario and preserves currency", () => {
    const out = expectOk(baseInput({ currency: "USD" }));
    expect(out.label).toBe(RISK_SIM_LABEL);
    expect(out.currency).toBe("USD");
    expect(out.startEquity).toBe(1);
  });

  it("is reproducible: same seed → identical output, different seed → different", () => {
    const a = simulateRisk(baseInput({ seed: 7 }));
    const b = simulateRisk(baseInput({ seed: 7 }));
    const c = simulateRisk(baseInput({ seed: 8 }));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(c));
  });

  it("never mutates the input sample", () => {
    const rSamples = Object.freeze(mixedSample(60));
    const snapshot = [...rSamples];
    // Object.freeze would throw on mutation; deep-equality double-checks order.
    expect(() => simulateRisk(baseInput({ rSamples }))).not.toThrow();
    expect([...rSamples]).toEqual(snapshot);
  });

  it("orders fan and final percentile bands and keeps the horizon honest", () => {
    const out = expectOk(baseInput());
    expect(out.fan.length).toBeGreaterThan(0);
    expect(out.fan.length).toBeLessThanOrEqual(60);
    expect(out.fan[out.fan.length - 1].step).toBe(out.horizon);
    for (const point of out.fan) {
      expect(point.percentiles[5]).toBeLessThanOrEqual(point.percentiles[25]);
      expect(point.percentiles[25]).toBeLessThanOrEqual(point.percentiles[50]);
      expect(point.percentiles[50]).toBeLessThanOrEqual(point.percentiles[75]);
      expect(point.percentiles[75]).toBeLessThanOrEqual(point.percentiles[95]);
    }
    expect(out.finalPercentiles[5]).toBeLessThanOrEqual(out.finalPercentiles[95]);
    expect(out.medianFinalEquity).toBeCloseTo(out.finalPercentiles[50], 4);
  });

  it("reports an all-winning edge as profitable with no ruin", () => {
    const out = expectOk(baseInput({ rSamples: Array(40).fill(1) }));
    expect(out.expectancyR).toBe(1);
    expect(out.probabilityOfProfit).toBe(1);
    expect(out.riskOfRuin).toBe(0);
    expect(out.medianFinalEquity).toBeGreaterThan(1);
    expect(out.maxDrawdownPercentiles[95]).toBe(0); // monotonic up → no drawdown
    expect(out.capitalRequirementR).toBe(0);
  });

  it("reports an all-losing edge as ruinous", () => {
    const out = expectOk(baseInput({ rSamples: Array(40).fill(-1), riskFraction: 0.5, ruinThreshold: 0.5 }));
    expect(out.expectancyR).toBe(-1);
    expect(out.probabilityOfProfit).toBe(0);
    expect(out.riskOfRuin).toBe(1);
    expect(out.medianFinalEquity).toBeLessThan(1);
    expect(out.capitalRequirementR).toBeGreaterThan(0);
  });

  it("makes ruin more likely as the ruin threshold tightens", () => {
    const sample = mixedSample(60).map((r) => r - 0.6); // tilt negative
    const shallow = expectOk(baseInput({ rSamples: sample, ruinThreshold: 0.1, riskFraction: 0.3 }));
    const deep = expectOk(baseInput({ rSamples: sample, ruinThreshold: 0.6, riskFraction: 0.3 }));
    expect(shallow.riskOfRuin).toBeGreaterThanOrEqual(deep.riskOfRuin);
  });

  it("computes capital requirement that falls as ruin tolerance rises", () => {
    const strict = expectOk(baseInput({ ruinTolerance: 0.01 }));
    const lax = expectOk(baseInput({ ruinTolerance: 0.2 }));
    expect(strict.capitalRequirementR).toBeGreaterThanOrEqual(lax.capitalRequirementR);
  });

  it("compounds differently from fixed sizing on a positive edge", () => {
    const fixed = expectOk(baseInput({ mode: "fixed" }));
    const compound = expectOk(baseInput({ mode: "compound" }));
    expect(compound.medianFinalEquity).not.toBe(fixed.medianFinalEquity);
  });

  it("winsorizes outliers when stress is applied", () => {
    const sample = [...mixedSample(40), 20, 18]; // fat upside tail
    const raw = expectOk(baseInput({ rSamples: sample }));
    const stressed = expectOk(baseInput({ rSamples: sample, outlierStressR: 3 }));
    expect(stressed.expectancyR).toBeLessThan(raw.expectancyR);
    expect(stressed.finalPercentiles[95]).toBeLessThan(raw.finalPercentiles[95]);
  });

  it("produces a drawdown histogram whose counts cover every path", () => {
    const out = expectOk(baseInput());
    const total = out.maxDrawdownHistogram.reduce((sum, bin) => sum + bin.count, 0);
    expect(total).toBe(out.paths);
    expect(out.maxDrawdownPercentiles[50]).toBeGreaterThanOrEqual(0);
    expect(out.maxDrawdownPercentiles[50]).toBeLessThanOrEqual(1);
  });
});
