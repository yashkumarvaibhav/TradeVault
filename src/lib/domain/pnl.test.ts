import { describe, it, expect } from "vitest";
import type { TradeMath } from "./types";
import {
  effectiveUnits,
  realizedPnl,
  realizedPnlPct,
  plannedRisk,
  plannedReward,
  plannedRR,
  realizedR,
  sumMoney,
} from "./pnl";

/**
 * Oracle: the v1 Flask smoke test (tests/test_app_smoke.py @ edbce1f).
 * These exact numbers must survive the TypeScript port.
 */
describe("P&L engine — v1 oracle parity", () => {
  it("Long Index lot trade: pnl 1000, plannedRR 3, realizedR 1 (v1 smoke test)", () => {
    // Index, lot_size 50, qty 2 → effective units 100. entry 100, stop 90, target 130, exit 110.
    const t: TradeMath = {
      status: "closed",
      direction: "Long",
      currency: "INR",
      entryPrice: 100,
      stopLoss: 90,
      plannedTarget: 130,
      exitPrice: 110,
      quantity: 2,
      multiplier: 50,
    };
    expect(effectiveUnits(t)).toBe(100);
    expect(realizedPnl(t)).toBe(1000);
    expect(plannedRisk(t)).toBe(1000);
    expect(plannedReward(t)).toBe(3000);
    expect(plannedRR(t)).toBe(3);
    expect(realizedR(t)).toBe(1);
    expect(realizedPnlPct(t)).toBe(10); // 1000 / (100*100) * 100
  });

  it("Losing Long Equity (qty 1): pnl -20, realizedR -2", () => {
    const t: TradeMath = {
      status: "closed",
      direction: "Long",
      currency: "INR",
      entryPrice: 100,
      stopLoss: 90,
      exitPrice: 80,
      quantity: 1,
    };
    expect(effectiveUnits(t)).toBe(1);
    expect(realizedPnl(t)).toBe(-20);
    expect(plannedRisk(t)).toBe(10);
    expect(realizedR(t)).toBe(-2);
    expect(plannedRR(t)).toBeNull(); // no target
    expect(realizedPnlPct(t)).toBe(-20);
  });

  it("USD US Index trade: pnl 50, realizedR 5", () => {
    const t: TradeMath = {
      status: "closed",
      direction: "Long",
      currency: "USD",
      entryPrice: 100,
      stopLoss: 90,
      exitPrice: 150,
      quantity: 1,
      multiplier: 1,
    };
    expect(realizedPnl(t)).toBe(50);
    expect(realizedR(t)).toBe(5);
  });
});

describe("P&L engine — direction & Forex", () => {
  it("Short Equity: direction-aware pnl 100, plannedRR 2, realizedR 1", () => {
    // entry 100, stop 110 (above), target 80 (below), qty 10, exit 90.
    const t: TradeMath = {
      status: "closed",
      direction: "Short",
      currency: "INR",
      entryPrice: 100,
      stopLoss: 110,
      plannedTarget: 80,
      exitPrice: 90,
      quantity: 10,
    };
    expect(plannedRisk(t)).toBe(100); // |100-110|*10
    expect(plannedReward(t)).toBe(200); // (100-80)*10
    expect(plannedRR(t)).toBe(2);
    expect(realizedPnl(t)).toBe(100); // (100-90)*10
    expect(realizedR(t)).toBe(1);
  });

  it("Forex manual P&L overrides price-based; realizedR from manual ÷ 1R", () => {
    // EUR/USD-style, USD account: entry 1.25, stop 1.24, qty 10000 → 1R = 100.
    const t: TradeMath = {
      status: "closed",
      direction: "Long",
      currency: "USD",
      entryPrice: 1.25,
      stopLoss: 1.24,
      quantity: 10000,
      manualPnl: 250,
    };
    expect(plannedRisk(t)!).toBeCloseTo(100, 6);
    expect(realizedPnl(t)).toBe(250);
    expect(realizedR(t)!).toBeCloseTo(2.5, 6);
  });
});

describe("P&L engine — null semantics (render as —, not 0)", () => {
  const base: TradeMath = {
    status: "closed",
    direction: "Long",
    currency: "INR",
    entryPrice: 100,
    stopLoss: 90,
    quantity: 1,
  };

  it("open trade has no realized P&L / R", () => {
    const t: TradeMath = { ...base, status: "open" };
    expect(realizedPnl(t)).toBeNull();
    expect(realizedR(t)).toBeNull();
    expect(effectiveUnits(t)).toBe(1); // units still computable
  });

  it("closed with no exit price and no manual P&L → null", () => {
    expect(realizedPnl({ ...base, exitPrice: null })).toBeNull();
  });

  it("missing stop → no planned risk, RR, or realized R", () => {
    const t: TradeMath = { ...base, stopLoss: null, exitPrice: 110 };
    expect(plannedRisk(t)).toBeNull();
    expect(plannedRR(t)).toBeNull();
    expect(realizedR(t)).toBeNull();
    expect(realizedPnl(t)).toBe(10); // P&L still computable without a stop
  });

  it("zero quantity → no computable values", () => {
    const t: TradeMath = { ...base, quantity: 0, exitPrice: 110 };
    expect(realizedPnl(t)).toBeNull();
    expect(plannedRisk(t)).toBeNull();
  });
});

describe("Money invariant — never sum mixed currencies", () => {
  it("sums same-currency amounts", () => {
    expect(
      sumMoney([
        { currency: "INR", amount: 1000 },
        { currency: "INR", amount: -20 },
      ]),
    ).toEqual({ currency: "INR", amount: 980 });
  });

  it("throws when currencies are mixed", () => {
    expect(() =>
      sumMoney([
        { currency: "INR", amount: 1000 },
        { currency: "USD", amount: 50 },
      ]),
    ).toThrow(/mixed currencies/i);
  });
});
