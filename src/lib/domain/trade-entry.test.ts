import { describe, expect, it } from "vitest";

import { evaluateTradeEntry, type TradeEntryDraft } from "./trade-entry";

const base: TradeEntryDraft = {
  symbol: "NIFTY",
  assetClass: "Index",
  instrumentType: "Futures",
  direction: "Long",
  status: "open",
  currency: "INR",
  entryAt: "2026-06-20T09:15",
  entryPrice: 25000,
  exitAt: null,
  exitPrice: null,
  quantity: 2,
  multiplier: 50,
  stopLoss: 24900,
  plannedTarget: 25300,
  manualPnl: null,
  fees: 40,
  fxToAccount: 1,
};

describe("trade-entry validation and live preview", () => {
  it("uses the domain math oracle for effective units, risk, position value, and R:R", () => {
    const result = evaluateTradeEntry(base);
    expect(result.errors).toEqual({});
    expect(result.preview).toEqual({
      effectiveUnits: 100,
      positionValue: 2_500_000,
      plannedRisk: 10_000,
      plannedRewardRisk: 3,
      realizedPnl: null,
      realizedR: null,
    });
  });

  it("rejects directionally invalid stops and targets for Long and Short", () => {
    expect(evaluateTradeEntry({ ...base, stopLoss: 25100, plannedTarget: 24900 }).errors).toMatchObject({
      stopLoss: expect.stringMatching(/below entry/i),
      plannedTarget: expect.stringMatching(/above entry/i),
    });
    expect(evaluateTradeEntry({ ...base, direction: "Short", stopLoss: 24900, plannedTarget: 25100 }).errors).toMatchObject({
      stopLoss: expect.stringMatching(/above entry/i),
      plannedTarget: expect.stringMatching(/below entry/i),
    });
  });

  it("requires a dated result for a closed trade and accepts Forex manual P&L", () => {
    expect(evaluateTradeEntry({ ...base, status: "closed" }).errors).toMatchObject({
      exitAt: expect.any(String),
      exitPrice: expect.any(String),
    });

    const result = evaluateTradeEntry({
      ...base,
      assetClass: "Forex",
      symbol: "EURUSD",
      currency: "USD",
      status: "closed",
      entryPrice: 1.1,
      stopLoss: 1.09,
      plannedTarget: 1.12,
      quantity: 10_000,
      multiplier: 1,
      exitAt: "2026-06-20T10:15",
      manualPnl: 240,
    });
    expect(result.errors).toEqual({});
    expect(result.preview.realizedPnl).toBe(240);
    expect(result.preview.realizedR).toBeCloseTo(2.4, 6);
  });

  it("rejects an exit before entry, invalid confidence, and non-positive sizing", () => {
    expect(evaluateTradeEntry({
      ...base,
      status: "closed",
      exitAt: "2026-06-19T10:15",
      exitPrice: 25100,
      quantity: 0,
      confidence: 6,
    }).errors).toMatchObject({
      exitAt: expect.stringMatching(/after entry/i),
      quantity: expect.any(String),
      confidence: expect.any(String),
    });
  });
});
