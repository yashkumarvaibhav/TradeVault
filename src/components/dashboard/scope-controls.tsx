"use client";

import Link from "next/link";

import { ScopeField, ScopeToolbar } from "@/components/layout/scope-toolbar";
import { Chip } from "@/components/ui/chip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Currency } from "@/lib/domain/types";
import { ASSET_OPTIONS, PERIOD_OPTIONS, periodLabel, scopeHref, type DashboardScope } from "@/lib/trade-scope";
import { cn } from "@/lib/utils";

/**
 * Shared dashboard scope toolbar. Date + asset scope are URL-driven (so the server recomputes the
 * page); currency is an instant client toggle. Used by the Overview and Analytics screens.
 */
export function ScopeControls({
  basePath,
  scope,
  currency,
  onCurrencyChange,
}: {
  basePath: string;
  scope: DashboardScope;
  currency: Currency;
  onCurrencyChange: (currency: Currency) => void;
}) {
  const scopeActive = scope.period !== "all" || scope.asset !== "Overall";

  return (
    <ScopeToolbar
      label="Dashboard scope"
      note={
        <>
          Money metrics are isolated to <strong className="text-ink">{currency}</strong>. INR and USD are never combined.
          {scopeActive ? (
            <span className="mt-2 flex flex-wrap items-center gap-1.5">
              <Chip tone="accent">{periodLabel(scope.period)}</Chip>
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
        </div>
      </ScopeField>
      <ScopeField label="Asset">
        <form action={basePath} method="get">
          {scope.period !== "all" ? <input type="hidden" name="period" value={scope.period} /> : null}
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
      <ScopeField label="Currency">
        <Select value={currency} onValueChange={(value) => onCurrencyChange(value as Currency)}>
          <SelectTrigger aria-label="Currency scope" className="w-full sm:w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="INR">INR</SelectItem>
            <SelectItem value="USD">USD</SelectItem>
          </SelectContent>
        </Select>
      </ScopeField>
    </ScopeToolbar>
  );
}
