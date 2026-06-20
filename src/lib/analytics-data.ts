import type { InferSelectModel } from "drizzle-orm";

import type { trades } from "@/db/schema";
import { buildCurrencyAnalytics, type AnalyticsTrade, type CurrencyAnalyticsMap } from "@/lib/domain/analytics";

type TradeRow = InferSelectModel<typeof trades>;

/**
 * Map persisted trade rows to the analytics oracle's input, resolving linked
 * strategy/playbook ids to their library names, then aggregate per currency.
 */
export function buildAnalyticsByCurrency(
  rows: TradeRow[],
  strategyNames: Map<string, string>,
  playbookNames: Map<string, string>,
): CurrencyAnalyticsMap {
  const mapped: AnalyticsTrade[] = rows.map((row) => ({
    status: row.status,
    direction: row.direction,
    currency: row.currency,
    entryPrice: Number(row.entryPrice),
    stopLoss: row.stopLoss == null ? null : Number(row.stopLoss),
    plannedTarget: row.plannedTarget == null ? null : Number(row.plannedTarget),
    exitPrice: row.exitPrice == null ? null : Number(row.exitPrice),
    quantity: Number(row.quantity),
    multiplier: Number(row.multiplier),
    manualPnl: row.manualPnl == null ? null : Number(row.manualPnl),
    fxToAccount: Number(row.fxToAccount),
    instrument: row.symbol,
    assetClass: row.assetClass,
    entryAt: row.entryAt.toISOString(),
    exitAt: row.exitAt?.toISOString() ?? null,
    strategy: (row.strategyId ? strategyNames.get(row.strategyId) : null) ?? row.tradingStyle ?? null,
    playbook: (row.playbookId ? playbookNames.get(row.playbookId) : null) ?? null,
    mistakeTags: row.ruleViolations ? [row.ruleViolations] : [],
  }));
  return buildCurrencyAnalytics(mapped);
}
