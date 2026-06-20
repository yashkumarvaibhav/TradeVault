import { describe, expect, it } from "vitest";

import { buildCalendarAnalytics, type CalendarTradeInput } from "./calendar";

function trade(overrides: Partial<CalendarTradeInput> = {}): CalendarTradeInput {
  return {
    id: "trade-1",
    status: "closed",
    currency: "INR",
    symbol: "TEST",
    direction: "Long",
    entryAt: "2026-06-09T09:00:00Z",
    exitAt: "2026-06-10T10:00:00Z",
    entryPrice: 100,
    quantity: 2,
    realizedPnl: 20,
    realizedR: 2,
    reviewedAt: null,
    ...overrides,
  };
}

describe("calendar analytics — daily outcome oracle", () => {
  it("aggregates exit-day P&L, R, W/L, and activity cards", () => {
    const analytics = buildCalendarAnalytics([
      trade({ id: "win", symbol: "WIN", realizedPnl: 20, realizedR: 2 }),
      trade({ id: "loss", symbol: "LOSS", direction: "Short", realizedPnl: -5, realizedR: -0.5 }),
      trade({ id: "flat", symbol: "FLAT", realizedPnl: 0, realizedR: 0 }),
    ], "INR");

    expect(analytics).toMatchObject({ currency: "INR", totalClosed: 3, totalReviews: 0 });
    expect(analytics.days).toHaveLength(1);
    expect(analytics.days[0]).toMatchObject({
      date: "2026-06-10",
      pnl: 15,
      realizedR: 1.5,
      count: 3,
      wins: 2,
      losses: 1,
      reviewCount: 0,
    });
    expect(analytics.days[0].trades.map(({ id }) => id)).toEqual(["win", "loss", "flat"]);
  });

  it("records review activity on its actual day without inventing outcome P&L", () => {
    const analytics = buildCalendarAnalytics([
      trade({ reviewedAt: "2026-06-12T08:00:00Z" }),
    ], "INR");

    expect(analytics.totalReviews).toBe(1);
    expect(analytics.days).toEqual([
      expect.objectContaining({ date: "2026-06-10", pnl: 20, count: 1, reviewCount: 0 }),
      expect.objectContaining({ date: "2026-06-12", pnl: null, count: 0, reviewCount: 1, reviewedTradeIds: ["trade-1"] }),
    ]);
  });

  it("keeps a zero-result trading day distinct from an absent no-trade day", () => {
    const analytics = buildCalendarAnalytics([trade({ realizedPnl: 0, realizedR: 0 })], "INR");

    expect(analytics.days[0].pnl).toBe(0);
    expect(analytics.days.find(({ date }) => date === "2026-06-11")).toBeUndefined();
  });
});

describe("calendar analytics — currency and sample boundaries", () => {
  it("never mixes INR and USD and ignores open or non-computable rows", () => {
    const rows = [
      trade({ id: "inr", realizedPnl: 100 }),
      trade({ id: "usd", currency: "USD", realizedPnl: 50 }),
      trade({ id: "open", status: "open", realizedPnl: null }),
      trade({ id: "missing", realizedPnl: null }),
    ];

    expect(buildCalendarAnalytics(rows, "INR").days[0].pnl).toBe(100);
    expect(buildCalendarAnalytics(rows, "USD").days[0].pnl).toBe(50);
    expect(buildCalendarAnalytics(rows, "INR").totalClosed).toBe(1);
  });
});
