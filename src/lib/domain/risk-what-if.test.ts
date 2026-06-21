import { describe, expect, it } from "vitest";

import { buildRiskWhatIf, type RiskWhatIfSample, type RiskWhatIfSettings } from "./risk-what-if";

const baseSettings: RiskWhatIfSettings = {
  lossCapR: null,
  winnerExtensionPct: 0,
  minQuality: null,
  playbook: null,
  ruleFilter: "all",
  frequencyPct: 100,
  feesR: 0,
};

function samples(count = 36): RiskWhatIfSample[] {
  return Array.from({ length: count }, (_, index) => ({
    r: index % 3 === 0 ? -2 : index % 3 === 1 ? 1 : 2,
    currency: "USD",
    quality: index % 2 === 0 ? 5 : 3,
    playbook: index % 2 === 0 ? "Breakout" : "Reversal",
    ruleFollowed: index % 4 === 0 ? false : true,
  }));
}

describe("buildRiskWhatIf", () => {
  it("returns an unchanged baseline scenario at neutral settings", () => {
    const output = buildRiskWhatIf({ samples: samples(), currency: "USD", settings: baseSettings });
    expect(output.ok).toBe(true);
    if (!output.ok) return;
    expect(output.transformedR).toEqual(samples().map((sample) => sample.r));
    expect(output.scenario).toEqual(output.baseline);
    expect(output.delta.netR).toBe(0);
    expect(output.baselineEquity.at(-1)?.valueR).toBe(output.baseline.netR);
  });

  it("caps losses, extends winners, and subtracts fees in a transparent order", () => {
    const output = buildRiskWhatIf({
      samples: samples(),
      currency: "USD",
      settings: { ...baseSettings, lossCapR: 1, winnerExtensionPct: 50, feesR: 0.1 },
    });
    expect(output.ok).toBe(true);
    if (!output.ok) return;
    expect(output.transformedR.slice(0, 3)).toEqual([-1.1, 1.4, 2.9]);
    expect(output.scenario.expectancyR).toBeGreaterThan(output.baseline.expectancyR);
  });

  it("filters by recorded quality, playbook, and rule adherence", () => {
    const input = samples(128);
    const output = buildRiskWhatIf({
      samples: input,
      currency: "USD",
      settings: { ...baseSettings, minQuality: 5, playbook: "Breakout", ruleFilter: "followed" },
    });
    expect(output.ok).toBe(true);
    if (!output.ok) return;
    expect(output.scenario.sampleSize).toBe(32);
    expect(output.transformedR.slice(0, 6)).toEqual([2, -2, 1, 2, -2, 1]);
  });

  it("adjusts trade frequency deterministically without reordering the source", () => {
    const input = samples();
    const lower = buildRiskWhatIf({ samples: input, currency: "USD", settings: { ...baseSettings, frequencyPct: 75 } });
    const higher = buildRiskWhatIf({ samples: input, currency: "USD", settings: { ...baseSettings, frequencyPct: 125 } });
    expect(lower.ok).toBe(true);
    if (!lower.ok) return;
    expect(lower.scenario.sampleSize).toBe(27);
    expect(lower.transformedR.slice(0, 4)).toEqual([-2, 1, 2, 1]);
    expect(higher.ok).toBe(true);
    if (!higher.ok) return;
    expect(higher.scenario.sampleSize).toBe(45);
    expect(higher.transformedR.slice(0, 4)).toEqual([-2, -2, 1, 2]);
  });

  it("refuses an under-sized filtered scenario", () => {
    const output = buildRiskWhatIf({ samples: samples(), currency: "USD", settings: { ...baseSettings, playbook: "Breakout" } });
    expect(output).toMatchObject({ ok: false, reason: "scenario-insufficient-sample", sampleSize: 18, minSample: 30 });
  });

  it("rejects mixed currencies and an under-sized baseline", () => {
    expect(buildRiskWhatIf({ samples: samples(12), currency: "USD", settings: baseSettings })).toMatchObject({ ok: false, reason: "insufficient-sample" });
    const mixed = samples();
    mixed[0] = { ...mixed[0], currency: "INR" };
    expect(buildRiskWhatIf({ samples: mixed, currency: "USD", settings: baseSettings })).toMatchObject({ ok: false, reason: "invalid-input" });
  });

  it("does not mutate frozen source samples or settings", () => {
    const input = samples().map((sample) => Object.freeze({ ...sample }));
    const settings = Object.freeze({ ...baseSettings, lossCapR: 1, winnerExtensionPct: 20 });
    const before = JSON.stringify(input);
    const output = buildRiskWhatIf({ samples: Object.freeze(input), currency: "USD", settings });
    expect(output.ok).toBe(true);
    expect(JSON.stringify(input)).toBe(before);
    expect(settings).toEqual({ ...baseSettings, lossCapR: 1, winnerExtensionPct: 20 });
  });
});
