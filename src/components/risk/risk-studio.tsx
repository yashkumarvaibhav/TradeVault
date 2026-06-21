"use client";

import * as React from "react";
import { Dices, Info, RotateCcw } from "lucide-react";
import Link from "next/link";

import { FanChart } from "@/components/charts/fan-chart";
import { ScopeControls } from "@/components/dashboard/scope-controls";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control";
import {
  RISK_SIM_MIN_SAMPLE,
  type RiskSimInput,
  type RiskSimMode,
  type RiskSimResult,
} from "@/lib/domain/risk-sim";
import type { Currency } from "@/lib/domain/types";
import type { DashboardScope } from "@/lib/trade-scope";
import { useRiskSim } from "@/components/risk/use-risk-sim";
import { cn } from "@/lib/utils";

const PATHS_OPTIONS = [1000, 2000, 5000, 10000];
const HORIZON_OPTIONS = [20, 50, 100, 250];
const RISK_PCT_OPTIONS = [0.5, 1, 2, 5];
const RUIN_PCT_OPTIONS = [10, 25, 50];
const OUTLIER_OPTIONS = [
  { label: "Off", value: 0 },
  { label: "Cap ±3R", value: 3 },
  { label: "Cap ±5R", value: 5 },
];

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
function mult(value: number): string {
  return `${value.toFixed(2)}×`;
}

function Metric({ label, value, sub, tone = "neutral" }: { label: string; value: string; sub: string; tone?: "neutral" | "profit" | "loss" }) {
  return (
    <Card className="min-w-0">
      <CardContent className="p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">{label}</p>
        <p className={cn("tnum mt-2 truncate font-serif text-2xl font-medium tracking-[-0.02em] text-ink", tone === "profit" && "text-profit", tone === "loss" && "text-loss")}>{value}</p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted">{sub}</p>
      </CardContent>
    </Card>
  );
}

function LabeledSelect<T extends string | number>({ label, value, options, format, onChange }: { label: string; value: T; options: readonly T[]; format: (value: T) => string; onChange: (value: T) => void }) {
  const isNumeric = typeof value === "number";
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{label}</span>
      <Select value={String(value)} onValueChange={(next) => onChange((isNumeric ? Number(next) : next) as T)}>
        <SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={String(option)} value={String(option)}>{format(option)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function interpretation(result: RiskSimResult): string {
  const profit = pct(result.probabilityOfProfit);
  const ruin = pct(result.riskOfRuin);
  const median = mult(result.medianFinalEquity);
  const ruinPct = `${(result.ruinThreshold * 100).toFixed(0)}%`;
  const edge = result.expectancyR >= 0 ? "positive" : "negative";
  return (
    `Across ${result.paths.toLocaleString("en-IN")} resampled ${result.horizon}-trade futures of your ${result.sampleSize} closed ${result.currency} trades ` +
    `(a ${edge} ${result.expectancyR >= 0 ? "+" : ""}${result.expectancyR.toFixed(2)}R average edge), the median ending capital is ${median} with a ${profit} chance of finishing profitable ` +
    `and a ${ruin} risk of a ${ruinPct} drawdown. Hold roughly ${result.capitalRequirementR.toFixed(1)}R of capital to weather the modeled drawdowns at a ${(result.ruinTolerance * 100).toFixed(0)}% ruin tolerance. ` +
    `This is a historical scenario, not a forecast.`
  );
}

export function RiskStudio({
  rSamplesByCurrency,
  defaultCurrency,
  scope,
  timeZone,
}: {
  rSamplesByCurrency: Partial<Record<Currency, number[]>>;
  defaultCurrency: Currency;
  scope: DashboardScope;
  timeZone: string;
}) {
  const firstWithData = (["INR", "USD"] as Currency[]).find((c) => (rSamplesByCurrency[c]?.length ?? 0) >= RISK_SIM_MIN_SAMPLE);
  const initialCurrency = (rSamplesByCurrency[defaultCurrency]?.length ?? 0) >= RISK_SIM_MIN_SAMPLE ? defaultCurrency : firstWithData ?? defaultCurrency;

  const [currency, setCurrency] = React.useState<Currency>(initialCurrency);
  const [paths, setPaths] = React.useState(2000);
  const [horizon, setHorizon] = React.useState(50);
  const [riskPct, setRiskPct] = React.useState(1);
  const [ruinPct, setRuinPct] = React.useState(50);
  const [mode, setMode] = React.useState<RiskSimMode>("fixed");
  const [outlierCap, setOutlierCap] = React.useState(0);
  const [seed, setSeed] = React.useState(1);

  const rSamples = React.useMemo(() => rSamplesByCurrency[currency] ?? [], [rSamplesByCurrency, currency]);
  const sampleSize = rSamples.length;
  const hasSample = sampleSize >= RISK_SIM_MIN_SAMPLE;

  const input = React.useMemo<RiskSimInput | null>(() => {
    if (!hasSample) return null;
    return {
      rSamples,
      currency,
      paths,
      horizon,
      mode,
      riskFraction: riskPct / 100,
      ruinThreshold: ruinPct / 100,
      outlierStressR: outlierCap || null,
      seed,
      fanPercentiles: [5, 25, 50, 75, 95],
    };
  }, [hasSample, rSamples, currency, paths, horizon, mode, riskPct, ruinPct, outlierCap, seed]);

  const { output, busy } = useRiskSim(input);
  const result = output && output.ok ? output : null;

  function reset() {
    setPaths(2000);
    setHorizon(50);
    setRiskPct(1);
    setRuinPct(50);
    setMode("fixed");
    setOutlierCap(0);
    setSeed(1);
  }

  return (
    <div className="space-y-5 lg:space-y-6">
      <PageHeader
        eyebrow={<><Chip tone="accent">Risk Studio</Chip><Chip>{sampleSize} closed {currency} trades</Chip></>}
        title="Monte Carlo"
        description="Resample your realized-R edge into thousands of possible futures. Historical scenario, not a forecast."
      />

      <ScopeControls basePath="/risk" scope={scope} currency={currency} onCurrencyChange={setCurrency} timeZone={timeZone} />

      {!hasSample ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <Dices className="size-8 text-muted" aria-hidden="true" />
            <h2 className="font-serif text-2xl text-ink">Not enough closed {currency} trades yet</h2>
            <p className="max-w-md text-sm text-muted">
              Monte Carlo needs at least <strong className="text-ink">{RISK_SIM_MIN_SAMPLE}</strong> closed {currency} trades with a computable R to model a meaningful edge. You have <strong className="text-ink">{sampleSize}</strong>. Log more closed trades or widen the period.
            </p>
            <Button asChild variant="outline" size="compact"><Link href="/trades">Go to My trades</Link></Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div><CardTitle>Simulation controls</CardTitle><CardDescription>Each path resamples your closed-trade R with replacement.</CardDescription></div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="compact" onClick={() => setSeed(Math.floor(Math.random() * 1_000_000))}><Dices aria-hidden="true" />Re-roll</Button>
                <Button type="button" variant="ghost" size="compact" onClick={reset}><RotateCcw aria-hidden="true" />Reset</Button>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
              <LabeledSelect label="Paths" value={paths} options={PATHS_OPTIONS} format={(v) => v.toLocaleString("en-IN")} onChange={setPaths} />
              <LabeledSelect label="Horizon" value={horizon} options={HORIZON_OPTIONS} format={(v) => `${v} trades`} onChange={setHorizon} />
              <LabeledSelect label="Risk / trade" value={riskPct} options={RISK_PCT_OPTIONS} format={(v) => `${v}%`} onChange={setRiskPct} />
              <LabeledSelect label="Ruin at" value={ruinPct} options={RUIN_PCT_OPTIONS} format={(v) => `−${v}%`} onChange={setRuinPct} />
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Sizing</span>
                <SegmentedControl type="single" value={mode} onValueChange={(value) => value && setMode(value as RiskSimMode)} aria-label="Position sizing" className="h-10">
                  <SegmentedControlItem value="fixed" className="flex-1">Fixed</SegmentedControlItem>
                  <SegmentedControlItem value="compound" className="flex-1">Compound</SegmentedControlItem>
                </SegmentedControl>
              </div>
              <LabeledSelect label="Outlier stress" value={outlierCap} options={OUTLIER_OPTIONS.map((o) => o.value)} format={(v) => OUTLIER_OPTIONS.find((o) => o.value === v)?.label ?? String(v)} onChange={setOutlierCap} />
            </CardContent>
          </Card>

          {result ? (
            <>
              <div className="flex items-start gap-3 rounded-lg border border-line bg-accent-soft/40 p-4">
                <Info className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
                <p className="text-sm leading-relaxed text-ink">{interpretation(result)}</p>
              </div>

              <Card>
                <CardHeader className="flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div><CardTitle>Equity fan</CardTitle><CardDescription>{result.mode === "compound" ? "Compounded" : "Fixed-fraction"} capital over {result.horizon} trades · {currency} · seed {result.seed}</CardDescription></div>
                  <div className="flex items-center gap-2">{busy ? <span className="text-xs text-muted">Simulating…</span> : null}<Chip tone="accent">{currency}</Chip></div>
                </CardHeader>
                <CardContent>
                  <FanChart fan={result.fan} ruinThreshold={result.ruinThreshold} currency={currency} horizon={result.horizon} />
                </CardContent>
              </Card>

              <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                <Metric label="Prob. of profit" value={pct(result.probabilityOfProfit)} sub="Paths ending above start" tone={result.probabilityOfProfit >= 0.5 ? "profit" : "loss"} />
                <Metric label="Risk of ruin" value={pct(result.riskOfRuin)} sub={`Hit −${(result.ruinThreshold * 100).toFixed(0)}% capital`} tone={result.riskOfRuin <= 0.05 ? "profit" : result.riskOfRuin >= 0.2 ? "loss" : "neutral"} />
                <Metric label="Median final" value={mult(result.medianFinalEquity)} sub="Of starting capital" tone={result.medianFinalEquity >= 1 ? "profit" : "loss"} />
                <Metric label="Median max DD" value={pct(result.maxDrawdownPercentiles[50] ?? 0)} sub={`95th pct: ${pct(result.maxDrawdownPercentiles[95] ?? 0)}`} tone="neutral" />
                <Metric label="Capital needed" value={`${result.capitalRequirementR.toFixed(1)}R`} sub={`To survive at ${(result.ruinTolerance * 100).toFixed(0)}% tolerance`} tone="neutral" />
                <Metric label="Avg edge" value={`${result.expectancyR >= 0 ? "+" : ""}${result.expectancyR.toFixed(2)}R`} sub="Per trade (sampled)" tone={result.expectancyR >= 0 ? "profit" : "loss"} />
              </section>

              <p className="text-xs text-muted">{result.label}. Each path draws {result.horizon} trades with replacement from your {result.sampleSize}-trade {currency} R distribution. Source trades are never modified.</p>
            </>
          ) : (
            <Card><CardContent className="px-6 py-16 text-center text-sm text-muted">{busy ? "Simulating…" : "Adjust the controls to run a simulation."}</CardContent></Card>
          )}
        </>
      )}
    </div>
  );
}
