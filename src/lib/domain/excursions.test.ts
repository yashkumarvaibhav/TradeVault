import { describe, expect, it } from "vitest";

import { evaluateExcursions, type ExcursionInput } from "./excursions";

const long: ExcursionInput = {
  status: "closed",
  direction: "Long",
  currency: "INR",
  entryPrice: 100,
  stopLoss: 90,
  exitPrice: 115,
  quantity: 10,
  multiplier: 2,
  fxToAccount: 1,
  mfePrice: 130,
  maePrice: 95,
};

describe("manual MAE/MFE excursion oracle", () => {
  it("computes Long MFE, MAE, R, percentages, and captured move", () => {
    const result = evaluateExcursions(long);
    expect(result.errors).toEqual({});
    expect(result.metrics).toEqual({
      mfeAmount: 600,
      maeAmount: 100,
      mfePct: 30,
      maePct: 5,
      mfeR: 3,
      maeR: 0.5,
      capturedMovePct: 50,
    });
  });

  it("is direction-aware for Short trades", () => {
    const result = evaluateExcursions({
      ...long,
      direction: "Short",
      stopLoss: 110,
      exitPrice: 85,
      mfePrice: 70,
      maePrice: 105,
    });
    expect(result.errors).toEqual({});
    expect(result.metrics).toMatchObject({ mfeAmount: 600, maeAmount: 100, mfeR: 3, maeR: 0.5, capturedMovePct: 50 });
  });

  it("requires extrema to include entry and a closed trade's exit", () => {
    expect(evaluateExcursions({ ...long, mfePrice: 110, maePrice: 105 }).errors).toEqual({
      mfePrice: expect.stringMatching(/at least 115/),
      maePrice: expect.stringMatching(/at most 100/),
    });
    expect(evaluateExcursions({ ...long, direction: "Short", stopLoss: 110, exitPrice: 85, mfePrice: 90, maePrice: 95 }).errors).toEqual({
      mfePrice: expect.stringMatching(/at most 85/),
      maePrice: expect.stringMatching(/at least 100/),
    });
  });

  it("keeps missing evidence null rather than fabricating zero", () => {
    expect(evaluateExcursions({ ...long, mfePrice: null, maePrice: null }).metrics).toEqual({
      mfeAmount: null,
      maeAmount: null,
      mfePct: null,
      maePct: null,
      mfeR: null,
      maeR: null,
      capturedMovePct: null,
    });
  });

  it("computes amount and percentage without a stop while leaving R unavailable", () => {
    const result = evaluateExcursions({ ...long, stopLoss: null });
    expect(result.metrics).toMatchObject({ mfeAmount: 600, maeAmount: 100, mfePct: 30, maePct: 5, mfeR: null, maeR: null });
  });

  it("preserves a signed negative captured move after giving back favorable movement", () => {
    const result = evaluateExcursions({ ...long, exitPrice: 95, mfePrice: 120, maePrice: 90 });
    expect(result.errors).toEqual({});
    expect(result.metrics.capturedMovePct).toBe(-25);
  });

  it("rejects non-positive and non-finite manual prices", () => {
    expect(evaluateExcursions({ ...long, mfePrice: 0, maePrice: Number.NaN }).errors).toEqual({
      mfePrice: expect.any(String),
      maePrice: expect.any(String),
    });
  });

  it("does not mutate frozen evidence", () => {
    const input = Object.freeze({ ...long });
    const before = JSON.stringify(input);
    evaluateExcursions(input);
    expect(JSON.stringify(input)).toBe(before);
  });
});
