import type { InferSelectModel } from "drizzle-orm";

import type { PreviewData } from "@/components/overview/overview-dashboard";
import type { trades } from "@/db/schema";
import { buildCurrencyAnalytics, type AnalyticsTrade } from "@/lib/domain/analytics";
import type { Currency } from "@/lib/domain/types";
import { dateKeyInTimeZone, formatDateInTimeZone } from "@/lib/date-time";
import { DEFAULT_TIME_ZONE } from "@/lib/date-time";

type TradeRow = InferSelectModel<typeof trades>;

const round2 = (value: number) => Number(value.toFixed(2));

function emptyData(): PreviewData {
  return { netPnl: 0, winRate: 0, totalTrades: 0, expectancy: 0, openRisk: 0, openPositions: 0, unreviewed: 0, reviewedCount: 0, ruleFollowRate: null, oldestPendingDays: null, equity: [], monthlyPnl: [], returnDistribution: [], directions: [], strategies: [], trades: [], openTrades: [], calendar: {}, profitFactor: 0, avgR: 0, topSymbol: "—" };
}

export function buildOverviewData(rows: TradeRow[], now = new Date(), timeZone = DEFAULT_TIME_ZONE): Record<Currency, PreviewData> {
  const mapped: AnalyticsTrade[] = rows.map((row) => ({
    status: row.status, direction: row.direction, currency: row.currency, entryPrice: Number(row.entryPrice),
    stopLoss: row.stopLoss == null ? null : Number(row.stopLoss), plannedTarget: row.plannedTarget == null ? null : Number(row.plannedTarget),
    exitPrice: row.exitPrice == null ? null : Number(row.exitPrice), quantity: Number(row.quantity), multiplier: Number(row.multiplier),
    manualPnl: row.manualPnl == null ? null : Number(row.manualPnl), fxToAccount: Number(row.fxToAccount), instrument: row.symbol,
    assetClass: row.assetClass, entryAt: row.entryAt.toISOString(), exitAt: row.exitAt?.toISOString() ?? null,
    outcomeDate: dateKeyInTimeZone(row.exitAt ?? row.entryAt, timeZone),
    strategy: row.tradingStyle, mistakeTags: row.ruleViolations ? [row.ruleViolations] : [],
  }));
  const analytics = buildCurrencyAnalytics(mapped);
  const output = { INR: emptyData(), USD: emptyData() } satisfies Record<Currency, PreviewData>;

  for (const currency of ["INR", "USD"] as Currency[]) {
    const metric = analytics[currency];
    const currencyRows = rows.filter((row) => row.currency === currency);
    const closed = currencyRows.filter((row) => row.status === "closed" && row.realizedPnl != null);
    const open = currencyRows.filter((row) => row.status === "open");
    const strategies = new Map<string, { pnl: number; wins: number; count: number }>();
    const symbols = new Map<string, number>();
    const calendar: Record<number, number> = {};
    const currentMonth = dateKeyInTimeZone(now, timeZone).slice(0, 7);
    for (const row of closed) {
      const pnl = Number(row.realizedPnl);
      const strategy = row.tradingStyle || "No strategy";
      const current = strategies.get(strategy) ?? { pnl: 0, wins: 0, count: 0 };
      strategies.set(strategy, { pnl: current.pnl + pnl, wins: current.wins + (pnl > 0 ? 1 : 0), count: current.count + 1 });
      symbols.set(row.symbol, (symbols.get(row.symbol) ?? 0) + pnl);
      const date = row.exitAt ?? row.entryAt;
      const key = dateKeyInTimeZone(date, timeZone);
      if (key.startsWith(currentMonth)) {
        const day = Number(key.slice(8, 10));
        calendar[day] = round2((calendar[day] ?? 0) + pnl);
      }
    }
    const recent = [...closed].sort((a, b) => (b.exitAt ?? b.entryAt).getTime() - (a.exitAt ?? a.entryAt).getTime()).slice(0, 3);
    const reviewed = closed.filter((row) => row.reviewedAt != null);
    const unreviewed = closed.filter((row) => row.reviewedAt == null);
    const oldestUnreviewed = unreviewed.reduce<Date | null>((oldest, row) => {
      const date = row.exitAt ?? row.entryAt;
      return !oldest || date < oldest ? date : oldest;
    }, null);
    const topSymbol = [...symbols.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? "—";
    output[currency] = {
      netPnl: metric?.netPnl ?? 0, winRate: metric?.winPct ?? 0, totalTrades: metric?.totalTrades ?? 0,
      expectancy: metric?.expectancy ?? 0, openRisk: round2(open.reduce((sum, row) => sum + Number(row.plannedRisk ?? 0), 0)),
      openPositions: open.length, unreviewed: unreviewed.length, reviewedCount: reviewed.length,
      ruleFollowRate: reviewed.length ? reviewed.filter((row) => !row.ruleViolations).length / reviewed.length * 100 : null,
      oldestPendingDays: oldestUnreviewed ? Math.max(0, Math.floor((now.getTime() - oldestUnreviewed.getTime()) / 86_400_000)) : null,
      equity: (metric?.equityCurve ?? []).map((point) => ({ label: new Date(point.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "UTC" }), value: point.cumulative })),
      monthlyPnl: (metric?.monthlyPnl ?? []).map((point) => ({ label: new Date(`${point.month}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" }), value: point.pnl })),
      returnDistribution: metric?.returnDistribution ?? [],
      directions: (["Long", "Short"] as const).map((label) => ({ label, value: closed.filter((row) => row.direction === label).length })),
      strategies: [...strategies.entries()].map(([name, value]) => ({ name, trades: value.count, winRate: value.count ? value.wins / value.count * 100 : 0, expectancy: value.count ? value.pnl / value.count : 0 })).sort((a, b) => b.expectancy - a.expectancy).slice(0, 3),
      trades: recent.map((row) => ({ id: row.id, symbol: row.symbol, side: row.direction, result: Number(row.realizedPnl), r: Number(row.realizedR ?? 0), when: formatDateInTimeZone(row.exitAt ?? row.entryAt, timeZone, { day: "2-digit", month: "short" }) })),
      openTrades: [...open]
        .sort((a, b) => b.entryAt.getTime() - a.entryAt.getTime())
        .slice(0, 5)
        .map((row) => ({ id: row.id, symbol: row.symbol, side: row.direction, risk: round2(Number(row.plannedRisk ?? 0)), when: formatDateInTimeZone(row.entryAt, timeZone, { day: "2-digit", month: "short" }) })),
      calendar, profitFactor: metric?.profitFactor ?? 0, avgR: metric?.avgRealizedR ?? 0, topSymbol,
    };
  }
  return output;
}
