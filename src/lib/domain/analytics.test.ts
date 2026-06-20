import { describe, expect, it } from "vitest";
import {
  buildCurrencyAnalytics,
  buildReturnDistribution,
  buildRMultipleDistribution,
  type AnalyticsTrade,
} from "./analytics";

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

describe("per-currency analytics — v1 oracle parity", () => {
  it("reproduces the v1 INR payoff and expectancy oracle", () => {
    const analytics = buildCurrencyAnalytics([
      trade({
        instrument: "NIFTY FUT",
        assetClass: "Index",
        quantity: 2,
        multiplier: 50,
        plannedTarget: 130,
        strategy: "ORB",
        playbook: "Opening Range Breakout",
      }),
      trade({
        instrument: "LOSS TEST",
        exitPrice: 80,
        exitAt: "2026-06-18T13:00:00Z",
        mistakeTags: ["Early exit"],
      }),
    ]).INR;

    expect(analytics).toBeDefined();
    expect(analytics).toMatchObject({
      currency: "INR",
      totalTrades: 2,
      winningTrades: 1,
      losingTrades: 1,
      winPct: 50,
      netPnl: 980,
      avgWin: 1000,
      avgLoss: -20,
      payoffRatio: 50,
      adjustedPayoffRatio: 50,
      profitFactor: 50,
      expectancy: 490,
      maxDrawdown: -20,
      largestWin: 1000,
      largestLoss: -20,
      avgPlannedRR: 3,
      avgRealizedR: -0.5,
      currentStreak: "1L",
    });
    expect(analytics?.monthlyPnl).toEqual([{ month: "2026-06", pnl: 980 }]);
    expect(analytics?.equityCurve).toEqual([
      {
        date: "2026-06-18T11:00:00Z",
        pnl: 1000,
        cumulative: 1000,
        drawdown: 0,
        instrument: "NIFTY FUT",
        currency: "INR",
      },
      {
        date: "2026-06-18T13:00:00Z",
        pnl: -20,
        cumulative: 980,
        drawdown: -20,
        instrument: "LOSS TEST",
        currency: "INR",
      },
    ]);
  });

  it("keeps INR and USD in separate aggregates", () => {
    const analytics = buildCurrencyAnalytics([
      trade({ quantity: 2, multiplier: 50, exitPrice: 110 }),
      trade({ exitPrice: 80, exitAt: "2026-06-18T13:00:00Z" }),
      trade({ currency: "USD", assetClass: "US Index", exitPrice: 150 }),
    ]);

    expect(Object.keys(analytics)).toEqual(["INR", "USD"]);
    expect(analytics.INR?.netPnl).toBe(980);
    expect(analytics.USD?.netPnl).toBe(50);
    expect(analytics.USD?.expectancy).toBe(50);
    expect(analytics.USD?.equityCurve[0]?.currency).toBe("USD");
  });
});

describe("per-currency analytics — chronological risk series", () => {
  it("sorts outcomes before calculating cumulative P&L, drawdown, and streak", () => {
    const analytics = buildCurrencyAnalytics([
      trade({ exitPrice: 80, exitAt: "2026-04-04T10:00:00Z" }),
      trade({ exitPrice: 20, exitAt: "2026-04-03T10:00:00Z" }),
      trade({ exitPrice: 70, exitAt: "2026-04-02T10:00:00Z" }),
      trade({ exitPrice: 200, exitAt: "2026-04-01T10:00:00Z" }),
    ]).INR;

    expect(analytics?.equityCurve.map(({ cumulative }) => cumulative)).toEqual([100, 70, -10, -30]);
    expect(analytics?.equityCurve.map(({ drawdown }) => drawdown)).toEqual([0, -30, -110, -130]);
    expect(analytics?.maxDrawdown).toBe(-130);
    expect(analytics?.currentStreak).toBe("3L");
  });

  it("tracks grouped P&L, sorted months, mistake cost, and hold durations", () => {
    const analytics = buildCurrencyAnalytics([
      trade({
        exitPrice: 120,
        entryAt: "2026-02-01T10:00:00Z",
        exitAt: "2026-02-02T13:00:00Z",
        strategy: "Momentum",
        playbook: "Breakout",
      }),
      trade({
        exitPrice: 90,
        entryAt: "2026-01-01T10:00:00Z",
        exitAt: "2026-01-02T12:00:00Z",
        strategy: null,
        playbook: null,
        assetClass: undefined,
        mistakeTags: "Early exit, FOMO, Early exit",
      }),
    ]).INR;

    expect(analytics?.monthlyPnl).toEqual([
      { month: "2026-01", pnl: -10 },
      { month: "2026-02", pnl: 20 },
    ]);
    expect(analytics?.categoryPnl).toEqual({ Equity: 20, Other: -10 });
    expect(analytics?.strategyPnl).toEqual({ Momentum: 20, "No Strategy": -10 });
    expect(analytics?.playbookPnl).toEqual({ Breakout: 20, "No Playbook": -10 });
    expect(analytics?.mistakeCostByTag).toEqual([
      { tag: "Early exit", cost: 20 },
      { tag: "FOMO", cost: 10 },
    ]);
    expect(analytics?.avgWinDurationHours).toBe(27);
    expect(analytics?.avgLossDurationHours).toBe(26);
  });
});

describe("per-currency analytics — edge semantics", () => {
  it("ignores open or non-computable trades rather than diluting the sample", () => {
    const analytics = buildCurrencyAnalytics([
      trade({ status: "open" }),
      trade({ exitPrice: null }),
      trade({ quantity: 0 }),
    ]);

    expect(analytics).toEqual({});
  });

  it("represents undefined all-win ratios as null and all-loss ratios as zero", () => {
    const winners = buildCurrencyAnalytics([trade({ exitPrice: 120 })]).INR;
    const losers = buildCurrencyAnalytics([trade({ exitPrice: 80 })]).INR;

    expect(winners?.profitFactor).toBeNull();
    expect(winners?.payoffRatio).toBeNull();
    expect(losers?.profitFactor).toBe(0);
    expect(losers?.payoffRatio).toBe(0);
  });

  it("ports the clamped two-percentage-point return buckets", () => {
    expect(buildReturnDistribution([-101, -3.9, -2, -0.1, 0, 1.99, 2, 601])).toEqual([
      { range: "-100% to -98%", count: 1 },
      { range: "-4% to -2%", count: 1 },
      { range: "-2% to 0%", count: 2 },
      { range: "0% to 2%", count: 2 },
      { range: "2% to 4%", count: 1 },
      { range: "600% to 602%", count: 1 },
    ]);
    expect(buildReturnDistribution([])).toEqual([]);
  });

  it("buckets realized R-multiples in 1R bins clamped to [-5R, 10R]", () => {
    expect(buildRMultipleDistribution([-6, -1.5, -0.1, 0, 0.9, 1, 11])).toEqual([
      { range: "-5R to -4R", count: 1 },
      { range: "-2R to -1R", count: 1 },
      { range: "-1R to 0R", count: 1 },
      { range: "0R to 1R", count: 2 },
      { range: "1R to 2R", count: 1 },
      { range: "10R to 11R", count: 1 },
    ]);
    expect(buildRMultipleDistribution([])).toEqual([]);
  });
});

describe("per-currency analytics — leaderboards, weekday, direction, R histogram", () => {
  const analytics = buildCurrencyAnalytics([
    trade({ instrument: "AAA", strategy: "Momentum", exitPrice: 110, exitAt: "2026-06-18T11:00:00Z" }), // +10, 1R, Thu
    trade({ instrument: "AAA", strategy: "Momentum", exitPrice: 80, exitAt: "2026-06-19T11:00:00Z" }), //  -20, -2R, Fri
    trade({ instrument: "BBB", strategy: "Scalp", direction: "Short", entryPrice: 100, stopLoss: 110, exitPrice: 90, exitAt: "2026-06-15T11:00:00Z" }), // +10, 1R, Mon
  ]).INR;

  it("ranks the symbol leaderboard by P&L with per-symbol win rate", () => {
    expect(analytics?.symbolLeaderboard).toEqual([
      { symbol: "BBB", pnl: 10, count: 1, winPct: 100 },
      { symbol: "AAA", pnl: -10, count: 2, winPct: 50 },
    ]);
  });

  it("splits longs vs shorts with currency-correct P&L", () => {
    expect(analytics?.directionSplit).toEqual([
      { direction: "Long", count: 2, pnl: -10, winPct: 50 },
      { direction: "Short", count: 1, pnl: 10, winPct: 100 },
    ]);
  });

  it("derives per-strategy win rate and expectancy", () => {
    expect(analytics?.strategyStats).toEqual([
      { name: "Scalp", pnl: 10, count: 1, winPct: 100, expectancy: 10 },
      { name: "Momentum", pnl: -10, count: 2, winPct: 50, expectancy: -5 },
    ]);
  });

  it("buckets P&L by weekday (Mon-first) and realized R", () => {
    expect(analytics?.weekdayPnl).toEqual([
      { weekday: "Mon", pnl: 10, count: 1 },
      { weekday: "Tue", pnl: 0, count: 0 },
      { weekday: "Wed", pnl: 0, count: 0 },
      { weekday: "Thu", pnl: 10, count: 1 },
      { weekday: "Fri", pnl: -20, count: 1 },
      { weekday: "Sat", pnl: 0, count: 0 },
      { weekday: "Sun", pnl: 0, count: 0 },
    ]);
    expect(analytics?.rMultipleDistribution).toEqual([
      { range: "-2R to -1R", count: 1 },
      { range: "1R to 2R", count: 2 },
    ]);
  });
});
