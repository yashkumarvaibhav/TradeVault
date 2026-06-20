import type { InferSelectModel } from "drizzle-orm";

import type { trades } from "@/db/schema";
import { buildReviewAnalytics, type ReviewAnalytics, type ReviewTrade } from "@/lib/domain/review-analytics";
import type { Currency } from "@/lib/domain/types";
import { addDateKeyDays, dateKeyInTimeZone, inclusiveDateWindow, inclusiveDayCount } from "@/lib/date-time";
import { scopeDateKeys, scopeTradeRows, type DashboardScope } from "@/lib/trade-scope";

type TradeRow = InferSelectModel<typeof trades>;
export type ReviewAnalyticsMap = Record<Currency, ReviewAnalytics>;

export interface ReviewLibraryNames {
  strategies: Map<string, string>;
  playbooks: Map<string, string>;
  closeReasons: Map<string, string>;
}

function mapRows(rows: TradeRow[], names: ReviewLibraryNames, timeZone: string): ReviewTrade[] {
  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    direction: row.direction,
    currency: row.currency,
    entryPrice: Number(row.entryPrice),
    stopLoss: row.stopLoss == null ? null : Number(row.stopLoss),
    plannedTarget: row.plannedTarget == null ? null : Number(row.plannedTarget),
    exitPrice: row.exitPrice == null ? null : Number(row.exitPrice),
    quantity: Number(row.quantity),
    multiplier: Number(row.multiplier),
    // Persisted realizedPnl is the authoritative net result (including fees).
    manualPnl: row.realizedPnl == null ? (row.manualPnl == null ? null : Number(row.manualPnl)) : Number(row.realizedPnl),
    fxToAccount: Number(row.fxToAccount),
    instrument: row.symbol,
    assetClass: row.assetClass,
    entryAt: row.entryAt.toISOString(),
    exitAt: row.exitAt?.toISOString() ?? null,
    outcomeDate: dateKeyInTimeZone(row.exitAt ?? row.entryAt, timeZone),
    strategy: (row.strategyId ? names.strategies.get(row.strategyId) : null) ?? row.tradingStyle ?? null,
    playbook: (row.playbookId ? names.playbooks.get(row.playbookId) : null) ?? null,
    closeReason: (row.closeReasonId ? names.closeReasons.get(row.closeReasonId) : null) ?? null,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    confidence: row.confidence,
    emotion: row.emotion,
    mistakeTags: row.ruleViolations,
    checklistCompleted: row.setupChecklist.filter((item) => item.completed).length,
    checklistTotal: row.setupChecklist.length,
    hasJournal: Boolean(row.notes?.trim() || row.linkedNote?.trim()),
  }));
}

function scopedWindow(rows: TradeRow[], scope: DashboardScope, start: Date, endExclusive: Date): TradeRow[] {
  return rows.filter((row) =>
    (scope.asset === "Overall" || row.assetClass === scope.asset) && row.entryAt >= start && row.entryAt < endExclusive,
  );
}

export function reviewComparisonLabel(scope: DashboardScope): string {
  if (scope.period === "custom" && scope.from && scope.to) return `Selected ${inclusiveDayCount(scope.from, scope.to)} days vs preceding period`;
  if (scope.period === "90d") return "Latest 90 days vs prior 90 days";
  if (scope.period === "ytd") return "Year to date vs same span last year";
  return "Latest 30 days vs prior 30 days";
}

function comparisonRows(rows: TradeRow[], scope: DashboardScope, now: Date, timeZone: string) {
  const keys = scopeDateKeys(scope.period === "all" ? { ...scope, period: "30d" } : scope, now, timeZone);
  if (!keys) return { current: [], previous: [] };
  const days = inclusiveDayCount(keys.from, keys.to);
  const previousFrom = scope.period === "ytd" ? `${Number(keys.from.slice(0, 4)) - 1}-01-01` : addDateKeyDays(keys.from, -days);
  const previousTo = addDateKeyDays(previousFrom, days - 1);
  const currentWindow = inclusiveDateWindow(keys.from, keys.to, timeZone);
  const previousWindow = inclusiveDateWindow(previousFrom, previousTo, timeZone);
  return {
    current: scopedWindow(rows, scope, currentWindow.start, currentWindow.endExclusive),
    previous: scopedWindow(rows, scope, previousWindow.start, previousWindow.endExclusive),
  };
}

/** Map tenant-scoped persistence rows into the pure behavioral oracle. */
export function buildReviewAnalyticsByCurrency(
  rows: TradeRow[],
  names: ReviewLibraryNames,
  scope: DashboardScope,
  now: Date,
  timeZone: string,
): ReviewAnalyticsMap {
  const currentRows = scopeTradeRows(rows, scope, now, timeZone);
  const comparison = comparisonRows(rows, scope, now, timeZone);
  const current = mapRows(currentRows, names, timeZone);
  const previous = mapRows(comparison.previous, names, timeZone);
  const comparisonCurrent = mapRows(comparison.current, names, timeZone);
  return {
    INR: buildReviewAnalytics(current, previous, "INR", comparisonCurrent),
    USD: buildReviewAnalytics(current, previous, "USD", comparisonCurrent),
  };
}
