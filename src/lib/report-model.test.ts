import { describe, expect, it } from "vitest";

import { buildCurrencyAnalytics, type AnalyticsTrade } from "@/lib/domain/analytics";
import { buildReportModel } from "@/lib/report-model";

function trade(overrides: Partial<AnalyticsTrade> = {}): AnalyticsTrade {
  return {
    status: "closed",
    direction: "Long",
    currency: "INR",
    entryPrice: 100,
    stopLoss: 90,
    exitPrice: 110,
    quantity: 1,
    instrument: "TEST",
    assetClass: "Equity",
    entryAt: "2026-06-18T10:00:00Z",
    exitAt: "2026-06-18T11:00:00Z",
    ...overrides,
  };
}

const META = {
  accountName: "Main",
  periodLabel: "All time",
  assetLabel: "Overall",
  generatedLabel: "20 Jun 2026, 5:30 pm",
};

describe("report model — pure presentation shaping", () => {
  it("formats single-currency headline KPIs with sign-aware tone", () => {
    const analytics = buildCurrencyAnalytics([
      trade({ instrument: "TCS", exitPrice: 120 }),
      trade({ instrument: "INFY", exitPrice: 80, exitAt: "2026-06-18T13:00:00Z" }),
    ]).INR!;

    const model = buildReportModel({ analytics, ...META });

    expect(model.currency).toBe("INR");
    expect(model.totalTrades).toBe(2);

    const net = model.headline.find((k) => k.label === "Net P&L")!;
    // INR is written "Rs" (react-pdf cannot shape the ₹ glyph) without decimals.
    const grouped = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(analytics.netPnl);
    expect(net.value).toBe(`Rs ${grouped}`);
    expect(net.value).not.toContain("₹");
    expect(net.tone).toBe(analytics.netPnl > 0 ? "profit" : analytics.netPnl < 0 ? "loss" : "neutral");

    const win = model.headline.find((k) => k.label === "Win rate")!;
    expect(win.value).toBe("50.0%");
    expect(win.detail).toBe("1 W · 1 L");
  });

  it("derives chart points from analytics series, not raw trades", () => {
    const analytics = buildCurrencyAnalytics([
      trade({ instrument: "TCS", exitPrice: 120 }),
      trade({ instrument: "INFY", exitPrice: 130, entryAt: "2026-06-19T10:00:00Z", exitAt: "2026-06-19T11:00:00Z" }),
    ]).INR!;

    const model = buildReportModel({ analytics, ...META });

    expect(model.equity).toHaveLength(analytics.equityCurve.length);
    expect(model.equity[0]).toMatchObject({ value: analytics.equityCurve[0].cumulative });
    expect(model.monthly.map((p) => p.value)).toEqual(analytics.monthlyPnl.map((p) => p.pnl));
    expect(model.weekday.every((p) => p.label.length <= 3)).toBe(true);
  });

  it("limits the symbol leaderboard so the column cannot overflow A4", () => {
    const trades = Array.from({ length: 14 }, (_, i) =>
      trade({ instrument: `SYM${i}`, exitPrice: 110 + i }),
    );
    const analytics = buildCurrencyAnalytics(trades).INR!;

    const model = buildReportModel({ analytics, ...META });

    expect(model.topSymbols.length).toBeLessThanOrEqual(8);
    expect(model.topSymbols[0].pnlLabel.startsWith("Rs ")).toBe(true);
    expect(model.topSymbols[0].winPctLabel.endsWith("%")).toBe(true);
  });

  it("keeps a USD report strictly to USD data and states the isolation guarantee", () => {
    const byCurrency = buildCurrencyAnalytics([
      trade({ currency: "INR", instrument: "TCS", exitPrice: 200 }),
      trade({ currency: "USD", instrument: "AAPL", exitPrice: 130 }),
    ]);

    const usd = buildReportModel({ analytics: byCurrency.USD!, ...META });

    expect(usd.currency).toBe("USD");
    expect(usd.totalTrades).toBe(1);
    expect(usd.headline[0].value).toContain("$");
    expect(usd.isolationNote).toContain("USD");
    expect(usd.isolationNote).toContain("never summed");
    // No INR symbol bleeds into the USD report.
    expect(usd.topSymbols.every((s) => s.symbol !== "TCS")).toBe(true);
    expect(usd.topSymbols.some((s) => s.symbol === "AAPL")).toBe(true);
  });
});
