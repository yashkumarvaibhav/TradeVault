import type { InferSelectModel } from "drizzle-orm";

import type { trades } from "@/db/schema";
import { buildCalendarAnalytics, type CalendarAnalytics, type CalendarTradeInput } from "@/lib/domain/calendar";
import type { Currency } from "@/lib/domain/types";
import { ASSET_OPTIONS, type ScopeAsset } from "@/lib/trade-scope";

type TradeRow = InferSelectModel<typeof trades>;
export type CalendarDataByCurrency = Record<Currency, CalendarAnalytics>;
export type CalendarDataByAsset = Record<ScopeAsset, CalendarDataByCurrency>;

function mapRows(rows: TradeRow[]): CalendarTradeInput[] {
  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    currency: row.currency,
    symbol: row.symbol,
    direction: row.direction,
    entryAt: row.entryAt.toISOString(),
    exitAt: row.exitAt?.toISOString() ?? null,
    entryPrice: Number(row.entryPrice),
    quantity: Number(row.quantity),
    realizedPnl: row.realizedPnl == null ? null : Number(row.realizedPnl),
    realizedR: row.realizedR == null ? null : Number(row.realizedR),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
  }));
}

/** Precompute the small asset × currency matrix for instant, money-safe switching. */
export function buildCalendarData(rows: TradeRow[]): CalendarDataByAsset {
  return Object.fromEntries(ASSET_OPTIONS.map((asset) => {
    const scopedRows = asset === "Overall" ? rows : rows.filter((row) => row.assetClass === asset);
    const mapped = mapRows(scopedRows);
    return [asset, {
      INR: buildCalendarAnalytics(mapped, "INR"),
      USD: buildCalendarAnalytics(mapped, "USD"),
    } satisfies CalendarDataByCurrency];
  })) as CalendarDataByAsset;
}
