import { describe, expect, it } from "vitest";

import { buildOverviewData } from "./overview-data";

function row(overrides: Record<string, unknown>) {
  return {
    status: "closed", direction: "Long", currency: "INR", entryPrice: "100", stopLoss: "90", plannedTarget: "120",
    exitPrice: "110", quantity: "1", multiplier: "1", manualPnl: null, fxToAccount: "1", symbol: "TEST",
    assetClass: "Equity", entryAt: new Date("2026-06-10T09:00:00Z"), exitAt: new Date("2026-06-10T10:00:00Z"),
    tradingStyle: "Swing", ruleViolations: null, realizedPnl: "10", realizedR: "1", plannedRisk: "10", reviewedAt: null,
    ...overrides,
  };
}

describe("overview journal projection", () => {
  it("derives each currency independently from the same persisted trade rows", () => {
    const rows = [
      row({ symbol: "INRWIN", realizedPnl: "10", exitPrice: "110" }),
      row({ symbol: "INRLOSS", realizedPnl: "-5", realizedR: "-0.5", exitPrice: "95" }),
      row({ symbol: "USDWIN", currency: "USD", realizedPnl: "25", realizedR: "2.5", exitPrice: "125" }),
      row({ symbol: "OPEN", status: "open", realizedPnl: null, realizedR: null, exitPrice: null, exitAt: null, plannedRisk: "8" }),
    ] as unknown as Parameters<typeof buildOverviewData>[0];
    const data = buildOverviewData(rows, new Date("2026-06-20T00:00:00Z"));
    expect(data.INR.netPnl).toBe(5);
    expect(data.INR.totalTrades).toBe(2);
    expect(data.INR.openPositions).toBe(1);
    expect(data.INR.openRisk).toBe(8);
    expect(data.USD.netPnl).toBe(25);
    expect(data.USD.totalTrades).toBe(1);
    expect(data.INR.calendar[10]).toBe(5);
  });
});
