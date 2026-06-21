"use client";

import Link from "next/link";

import { ScopeField, ScopeToolbar } from "@/components/layout/scope-toolbar";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import type { Currency } from "@/lib/domain/types";
import { DEFAULT_TIME_ZONE } from "@/lib/date-time";
import { ASSET_OPTIONS, PERIOD_OPTIONS, scopeHref, scopePeriodLabel, type DashboardScope } from "@/lib/trade-scope";
import { cn } from "@/lib/utils";

/**
 * Shared dashboard scope toolbar. Date + asset scope are URL-driven (so the server recomputes the
 * page); currency comes from the persistent app-wide market workspace.
 */
export function ScopeControls({
  basePath,
  scope,
  currency,
  timeZone = DEFAULT_TIME_ZONE,
}: {
  basePath: string;
  scope: DashboardScope;
  currency: Currency;
  timeZone?: string;
}) {
  const scopeActive = scope.period !== "all" || scope.asset !== "Overall";

  return (
    <ScopeToolbar
      label="Dashboard scope"
      note={
        <>
          Money metrics are isolated to <strong className="text-ink">{currency}</strong>. INR and USD are never combined.
          <span className="mt-1 block">Date boundaries use <strong className="text-ink">{timeZone}</strong>. <Link href="/settings" className="font-semibold text-accent underline-offset-2 hover:underline">Change</Link></span>
          {scopeActive ? (
            <span className="mt-2 flex flex-wrap items-center gap-1.5">
              <Chip tone="accent">{scopePeriodLabel(scope)}</Chip>
              {scope.asset !== "Overall" ? <Chip tone="accent">{scope.asset}</Chip> : null}
              <Link href={basePath} className="text-xs font-semibold text-accent underline-offset-2 hover:underline">Clear</Link>
            </span>
          ) : null}
        </>
      }
    >
      <ScopeField label="Period" className="flex-1">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Period scope">
          {PERIOD_OPTIONS.map((option) => (
            <Link
              key={option.value}
              href={scopeHref(basePath, scope, { period: option.value })}
              aria-current={scope.period === option.value ? "true" : undefined}
              className={cn(
                "inline-flex min-h-9 items-center rounded-md border px-3 text-sm font-semibold transition-colors",
                scope.period === option.value ? "border-line-strong bg-accent-soft text-ink" : "border-line bg-raised text-muted hover:bg-hover",
              )}
            >
              {option.label}
            </Link>
          ))}
          <details className="group relative" open={scope.period === "custom"}>
            <summary className={cn(
              "inline-flex min-h-9 cursor-pointer list-none items-center rounded-md border px-3 text-sm font-semibold transition-colors",
              scope.period === "custom" ? "border-line-strong bg-accent-soft text-ink" : "border-line bg-raised text-muted hover:bg-hover",
            )}>Custom</summary>
            <form action={basePath} method="get" className="mt-2 grid gap-3 rounded-md border border-line bg-page p-3 sm:grid-cols-[minmax(8.5rem,1fr)_minmax(8.5rem,1fr)_auto] sm:items-end">
              <input type="hidden" name="period" value="custom" />
              {scope.asset !== "Overall" ? <input type="hidden" name="asset" value={scope.asset} /> : null}
              <label className="text-xs font-semibold text-muted">From<input name="from" type="date" required defaultValue={scope.from} className="mt-1 h-11 w-full rounded-md border border-line bg-raised px-3 text-sm text-ink" /></label>
              <label className="text-xs font-semibold text-muted">To<input name="to" type="date" required defaultValue={scope.to} className="mt-1 h-11 w-full rounded-md border border-line bg-raised px-3 text-sm text-ink" /></label>
              <Button type="submit" variant="outline">Apply range</Button>
            </form>
            {scope.rangeError ? <p role="alert" className="mt-2 text-xs font-semibold text-danger">{scope.rangeError}</p> : null}
          </details>
        </div>
      </ScopeField>
      <ScopeField label="Asset">
        <form action={basePath} method="get">
          {scope.period !== "all" ? <input type="hidden" name="period" value={scope.period} /> : null}
          {scope.period === "custom" && scope.from ? <input type="hidden" name="from" value={scope.from} /> : null}
          {scope.period === "custom" && scope.to ? <input type="hidden" name="to" value={scope.to} /> : null}
          <select
            name="asset"
            defaultValue={scope.asset}
            aria-label="Asset class scope"
            onChange={(event) => event.currentTarget.form?.requestSubmit()}
            className="h-11 w-full rounded-md border border-line bg-raised px-3 text-sm text-ink sm:w-40"
          >
            {ASSET_OPTIONS.map((asset) => <option key={asset} value={asset}>{asset}</option>)}
          </select>
        </form>
      </ScopeField>
    </ScopeToolbar>
  );
}
