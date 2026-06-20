import type { InferSelectModel } from "drizzle-orm";

import type { trades } from "@/db/schema";

type TradeRow = InferSelectModel<typeof trades>;

export type ScopePeriod = "all" | "30d" | "90d" | "ytd";
export type ScopeAsset = "Overall" | "Equity" | "Index" | "Forex" | "Commodity" | "US Index" | "Crypto";

export interface DashboardScope {
  period: ScopePeriod;
  asset: ScopeAsset;
}

export const PERIOD_OPTIONS: { value: ScopePeriod; label: string }[] = [
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
  if (asset !== "Overall") params.set("asset", asset);
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function periodLabel(period: ScopePeriod): string {
  return PERIOD_OPTIONS.find((option) => option.value === period)?.label ?? "All time";
}

export function parseTradeScope(searchParams: { period?: string; asset?: string }): DashboardScope {
  const period = (PERIOD_OPTIONS.some((option) => option.value === searchParams.period) ? searchParams.period : "all") as ScopePeriod;
  const asset = (ASSET_OPTIONS.includes(searchParams.asset as ScopeAsset) ? searchParams.asset : "Overall") as ScopeAsset;
  return { period, asset };
}

export function scopeMonth(now: Date): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function periodCutoff(period: ScopePeriod, now: Date): Date | null {
  if (period === "30d") return new Date(now.getTime() - 30 * 86_400_000);
  if (period === "90d") return new Date(now.getTime() - 90 * 86_400_000);
  if (period === "ytd") return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  return null;
}

/** Filter trade rows to the active date + asset-class scope (by entry date). */
export function scopeTradeRows(rows: TradeRow[], scope: DashboardScope, now: Date): TradeRow[] {
  const cutoff = periodCutoff(scope.period, now);
  return rows.filter((row) =>
    (scope.asset === "Overall" || row.assetClass === scope.asset) && (cutoff == null || row.entryAt >= cutoff),
  );
}
