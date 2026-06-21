import type { InferSelectModel } from "drizzle-orm";

import type { trades } from "@/db/schema";
import { buildCurrencyAnalytics, type AnalyticsTrade, type CurrencyAnalyticsMap } from "@/lib/domain/analytics";
import { realizedR } from "@/lib/domain/pnl";
import type { Currency } from "@/lib/domain/types";
import { dateKeyInTimeZone } from "@/lib/date-time";

type TradeRow = InferSelectModel<typeof trades>;

/** Map one persisted trade row to the analytics oracle's input. */
function toAnalyticsTrade(
  row: TradeRow,
  strategyNames: Map<string, string>,
  playbookNames: Map<string, string>,
  timeZone: string,
): AnalyticsTrade {
  return {
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
    outcomeDate: dateKeyInTimeZone(row.exitAt ?? row.entryAt, timeZone),
    strategy: (row.strategyId ? strategyNames.get(row.strategyId) : null) ?? row.tradingStyle ?? null,
    playbook: (row.playbookId ? playbookNames.get(row.playbookId) : null) ?? null,
    mistakeTags: row.ruleViolations ? [row.ruleViolations] : [],
  };
}

/**
 * Map persisted trade rows to the analytics oracle's input, resolving linked
 * strategy/playbook ids to their library names, then aggregate per currency.
 */
export function buildAnalyticsByCurrency(
  rows: TradeRow[],
  strategyNames: Map<string, string>,
  playbookNames: Map<string, string>,
  timeZone: string,
): CurrencyAnalyticsMap {
  const mapped = rows.map((row) => toAnalyticsTrade(row, strategyNames, playbookNames, timeZone));
  return buildCurrencyAnalytics(mapped);
}

/**
 * Realized R-multiple per closed trade, grouped by currency, for Risk Studio's
 * Monte-Carlo sample. Open trades and rows without a computable R are skipped;
 * INR and USD are kept in separate arrays (never combined).
 */
export function buildRealizedRByCurrency(rows: TradeRow[], timeZone: string): Partial<Record<Currency, number[]>> {
  const empty = new Map<string, string>();
  const samples: Partial<Record<Currency, number[]>> = {};
  for (const row of rows) {
    if (row.status !== "closed") continue;
    const r = realizedR(toAnalyticsTrade(row, empty, empty, timeZone));
    if (r == null || !Number.isFinite(r)) continue;
    (samples[row.currency] ??= []).push(r);
  }
  return samples;
}
