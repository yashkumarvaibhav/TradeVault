import type { InferSelectModel } from "drizzle-orm";

import type { trades } from "@/db/schema";
import { addDateKeyDays, dateKeyInTimeZone, inclusiveDateWindow, isDateKey } from "@/lib/date-time";

type TradeRow = InferSelectModel<typeof trades>;

export type ScopePeriod = "all" | "30d" | "90d" | "ytd" | "custom";
export type ScopeAsset = "Overall" | "Equity" | "Index" | "Forex" | "Commodity" | "US Index" | "Crypto";

export interface DashboardScope {
  period: ScopePeriod;
  asset: ScopeAsset;
  from?: string;
  to?: string;
  rangeError?: string;
}

export const PERIOD_OPTIONS: { value: Exclude<ScopePeriod, "custom">; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "ytd", label: "Year to date" },
];
export const ASSET_OPTIONS: ScopeAsset[] = ["Overall", "Equity", "Index", "Forex", "Commodity", "US Index", "Crypto"];

/** Build a scoped dashboard URL with a patch; default values are omitted to keep URLs clean. */
export function scopeHref(basePath: string, scope: DashboardScope, patch: Partial<DashboardScope>) {
  const period = patch.period ?? scope.period;
  const asset = patch.asset ?? scope.asset;
  const params = new URLSearchParams();
  if (period !== "all") params.set("period", period);
  if (period === "custom") {
    const from = patch.from ?? scope.from;
    const to = patch.to ?? scope.to;
    if (from) params.set("from", from);
    if (to) params.set("to", to);
  }
  if (asset !== "Overall") params.set("asset", asset);
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function periodLabel(period: ScopePeriod): string {
  if (period === "custom") return "Custom range";
  return PERIOD_OPTIONS.find((option) => option.value === period)?.label ?? "All time";
}

export function scopePeriodLabel(scope: DashboardScope): string {
  return scope.period === "custom" && scope.from && scope.to ? `${scope.from} – ${scope.to}` : periodLabel(scope.period);
}

export function parseTradeScope(searchParams: { period?: string; asset?: string; from?: string; to?: string }): DashboardScope {
  const supported = [...PERIOD_OPTIONS.map(({ value }) => value), "custom"];
  const period = (supported.includes(searchParams.period as ScopePeriod) ? searchParams.period : "all") as ScopePeriod;
  const asset = (ASSET_OPTIONS.includes(searchParams.asset as ScopeAsset) ? searchParams.asset : "Overall") as ScopeAsset;
  if (period !== "custom") return { period, asset };
  const from = isDateKey(searchParams.from) ? searchParams.from : undefined;
  const to = isDateKey(searchParams.to) ? searchParams.to : undefined;
  const rangeError = !from || !to ? "Choose both From and To dates." : from > to ? "From must be on or before To." : undefined;
  return { period, asset, from, to, rangeError };
}

export function scopeMonth(now: Date, timeZone: string): string {
  return dateKeyInTimeZone(now, timeZone).slice(0, 7);
}

export function scopeDateKeys(scope: DashboardScope, now: Date, timeZone: string): { from: string; to: string } | null {
  const today = dateKeyInTimeZone(now, timeZone);
  if (scope.period === "all") return null;
  if (scope.period === "custom") return scope.from && scope.to && !scope.rangeError ? { from: scope.from, to: scope.to } : null;
  if (scope.period === "30d") return { from: addDateKeyDays(today, -29), to: today };
  if (scope.period === "90d") return { from: addDateKeyDays(today, -89), to: today };
  return { from: `${today.slice(0, 4)}-01-01`, to: today };
}

export function scopeDateWindow(scope: DashboardScope, now: Date, timeZone: string): { start: Date; endExclusive: Date } | null {
  const keys = scopeDateKeys(scope, now, timeZone);
  return keys ? inclusiveDateWindow(keys.from, keys.to, timeZone) : null;
}

/** Filter trade rows to the active date + asset-class scope (by entry date). */
export function scopeTradeRows(rows: TradeRow[], scope: DashboardScope, now: Date, timeZone: string): TradeRow[] {
  if (scope.period === "custom" && scope.rangeError) return [];
  const window = scopeDateWindow(scope, now, timeZone);
  return rows.filter((row) =>
    (scope.asset === "Overall" || row.assetClass === scope.asset) &&
    (window == null || (row.entryAt >= window.start && row.entryAt < window.endExclusive)),
  );
}
