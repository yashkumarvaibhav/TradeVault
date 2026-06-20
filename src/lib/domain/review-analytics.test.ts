import { describe, expect, it } from "vitest";

import { buildReviewAnalytics, type ReviewTrade } from "./review-analytics";

function trade(overrides: Partial<ReviewTrade> = {}): ReviewTrade {
  return {
    id: "trade-1",
    status: "closed",
    direction: "Long",
    currency: "INR",
    entryPrice: 100,
    stopLoss: 90,
    plannedTarget: 120,
    exitPrice: 120,
    quantity: 1,
    instrument: "TEST",
    assetClass: "Equity",
    entryAt: "2026-06-10T09:00:00Z",
    exitAt: "2026-06-10T10:00:00Z",
    strategy: "Momentum",
    playbook: "Breakout",
    closeReason: "Target hit",
    reviewedAt: "2026-06-11T10:00:00Z",
    confidence: 4,
    emotion: "Calm",
    mistakeTags: [],
    checklistCompleted: 4,
    checklistTotal: 5,
    hasJournal: true,
    ...overrides,
  };
}

describe("review analytics — v1 behavioral oracle parity", () => {
  const current = [
    trade({ id: "win-compliant", manualPnl: 20 }),
    trade({
      id: "loss-violated",
      manualPnl: -10,
      exitAt: "2026-06-11T10:00:00Z",
      confidence: 2,
      emotion: "Anxious",
      mistakeTags: ["FOMO", "Early entry"],
      checklistCompleted: 2,
      hasJournal: false,
      closeReason: "Stop loss",
    }),
    trade({
      id: "pending-win",
      manualPnl: 10,
      exitAt: "2026-06-12T10:00:00Z",
      reviewedAt: null,
      confidence: null,
      checklistCompleted: 0,
      hasJournal: false,
    }),
    trade({
      id: "win-compliant-2",
      manualPnl: 10,
      exitAt: "2026-06-13T10:00:00Z",
      confidence: 5,
      emotion: "Calm",
      checklistCompleted: 5,
    }),
  ];
  const previous = [trade({ id: "prior-loss", manualPnl: -5, exitAt: "2026-05-10T10:00:00Z", mistakeTags: ["FOMO"] })];
  const analytics = buildReviewAnalytics(current, previous, "INR");

  it("keeps the v1 discipline, queue, and mistake-cost semantics", () => {
    expect(analytics).toMatchObject({
      currency: "INR",
      totalClosed: 4,
      reviewedCount: 3,
      pendingReviewCount: 1,
      avgExecutionScore: 3.67,
      ruleFollowRate: 66.67,
      disciplineScore: 70,
      stopCoverage: 100,
      targetCoverage: 100,
    });
    expect(analytics.reviewQueue.map(({ id }) => id)).toEqual(["pending-win"]);
    expect(analytics.mistakeCostByTag).toEqual([
      { tag: "Early entry", cost: 10, count: 1, tradeIds: ["loss-violated"] },
      { tag: "FOMO", cost: 10, count: 1, tradeIds: ["loss-violated"] },
    ]);
  });

  it("compares compliant and violated reviewed trades without causal language", () => {
    expect(analytics.compliance.compliant).toMatchObject({ count: 2, pnl: 30, winPct: 100, expectancy: 15 });
    expect(analytics.compliance.violated).toMatchObject({ count: 1, pnl: -10, winPct: 0, expectancy: -10 });
    expect(analytics.compliance.expectancyDelta).toBe(25);
    expect(analytics.compliance.winRateDelta).toBe(100);
  });

  it("exposes journaling, setup, emotion, close-reason, weekday, and comparison evidence", () => {
    expect(analytics.journaling.withJournal).toMatchObject({ count: 2, pnl: 30, winPct: 100 });
    expect(analytics.journaling.withoutJournal).toMatchObject({ count: 2, pnl: 0, winPct: 50 });
    expect(analytics.setupStats[0]).toMatchObject({ name: "Breakout", count: 4, pnl: 30 });
    expect(analytics.emotionStats.find(({ name }) => name === "Calm")).toMatchObject({ count: 3, pnl: 40 });
    expect(analytics.closeReasonStats.find(({ name }) => name === "Stop loss")).toMatchObject({ count: 1, pnl: -10 });
    expect(analytics.weekdayStats.find(({ name }) => name === "Wed")).toMatchObject({ count: 1, pnl: 20 });
    expect(analytics.periodComparison).toMatchObject({
      current: { count: 4, pnl: 30, winPct: 75 },
      previous: { count: 1, pnl: -5, winPct: 0 },
      pnlDelta: 35,
      winRateDelta: 75,
    });
    expect(analytics.dailyOutcomes).toHaveLength(4);
    expect(analytics.adjustment).toMatch(/Review 1 closed trade/);
  });
});

describe("review analytics — currency and sample boundaries", () => {
  it("never includes another currency in a currency-scoped result", () => {
    const rows = [
      trade({ id: "inr", manualPnl: 100 }),
      trade({ id: "usd", currency: "USD", manualPnl: 50 }),
    ];

    expect(buildReviewAnalytics(rows, [], "INR").totalPnl).toBe(100);
    expect(buildReviewAnalytics(rows, [], "USD").totalPnl).toBe(50);
  });

  it("excludes open and non-computable rows from behavioral outcome samples", () => {
    const analytics = buildReviewAnalytics([
      trade({ id: "open", status: "open" }),
      trade({ id: "missing-result", exitPrice: null, manualPnl: null }),
    ], [], "INR");

    expect(analytics.totalClosed).toBe(0);
    expect(analytics.reviewQueue).toEqual([]);
    expect(analytics.disciplineScore).toBeNull();
  });
});
