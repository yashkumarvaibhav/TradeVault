"use client";

import * as React from "react";
import { AlertTriangle, Dices, Info, RotateCcw } from "lucide-react";
import Link from "next/link";

import { FanChart } from "@/components/charts/fan-chart";
import { KellyGrowthChart } from "@/components/charts/kelly-growth-chart";
import { ScopeControls } from "@/components/dashboard/scope-controls";
import { PageHeader } from "@/components/layout/page-header";
import { WhatIfWorkspace } from "@/components/risk/what-if-workspace";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { computeKelly, stressPositionSizes } from "@/lib/domain/risk-kelly";
import type { RiskWhatIfSample } from "@/lib/domain/risk-what-if";
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
  whatIfSamplesByCurrency,
  defaultCurrency,
  scope,
  timeZone,
}: {
  whatIfSamplesByCurrency: Partial<Record<Currency, RiskWhatIfSample[]>>;
  defaultCurrency: Currency;
  scope: DashboardScope;
  timeZone: string;
}) {
  const firstWithData = (["INR", "USD"] as Currency[]).find((c) => (whatIfSamplesByCurrency[c]?.length ?? 0) >= RISK_SIM_MIN_SAMPLE);
  const initialCurrency = (whatIfSamplesByCurrency[defaultCurrency]?.length ?? 0) >= RISK_SIM_MIN_SAMPLE ? defaultCurrency : firstWithData ?? defaultCurrency;

  const [currency, setCurrency] = React.useState<Currency>(initialCurrency);
  const [paths, setPaths] = React.useState(2000);
  const [horizon, setHorizon] = React.useState(50);
  const [riskPct, setRiskPct] = React.useState(1);
  const [ruinPct, setRuinPct] = React.useState(50);
  const [mode, setMode] = React.useState<RiskSimMode>("fixed");
  const [outlierCap, setOutlierCap] = React.useState(0);
  const [seed, setSeed] = React.useState(1);

  const whatIfSamples = React.useMemo(() => whatIfSamplesByCurrency[currency] ?? [], [whatIfSamplesByCurrency, currency]);
  const rSamples = React.useMemo(() => whatIfSamples.map((sample) => sample.r), [whatIfSamples]);
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

  // Kelly + position-size stress are cheap and pure → computed synchronously.
  const kelly = React.useMemo(() => (hasSample ? computeKelly({ rSamples, currency }) : null), [hasSample, rSamples, currency]);
  const stress = React.useMemo(() => {
    if (!kelly || !kelly.ok) return null;
    const cap = kelly.maxSafeFraction * 0.98;
    const fractions = Array.from(
      new Set([0.01, kelly.quarterKelly, kelly.halfKelly, kelly.kellyFraction, Math.min(kelly.kellyFraction * 1.5, cap), Math.min(kelly.kellyFraction * 2, cap)].filter((f) => f > 0 && f <= cap)),
    ).sort((a, b) => a - b);
    return stressPositionSizes({ rSamples, currency, fractions, paths: 1500, horizon, ruinThreshold: ruinPct / 100, outlierStressR: outlierCap || null, seed });
  }, [kelly, rSamples, currency, horizon, ruinPct, outlierCap, seed]);
  const overBetting = kelly?.ok ? riskPct / 100 > kelly.kellyFraction : false;

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
        title="Risk Studio"
        description="Stress your realized-R edge, then explore transparent changes without altering a source trade. Historical scenarios, not forecasts."
      />

      <ScopeControls basePath="/risk" scope={scope} currency={currency} onCurrencyChange={setCurrency} timeZone={timeZone} />

      <Tabs defaultValue="monte-carlo">
        <TabsList aria-label="Risk Studio mode" className="w-full sm:w-auto">
          <TabsTrigger value="monte-carlo" className="flex-1 sm:min-w-36">Monte Carlo</TabsTrigger>
          <TabsTrigger value="what-if" className="flex-1 sm:min-w-36">What-If</TabsTrigger>
        </TabsList>
        <TabsContent value="monte-carlo" className="mt-5 space-y-5">
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

              {kelly && kelly.ok ? (
                <Card>
                  <CardHeader className="flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div><CardTitle>Kelly &amp; position sizing</CardTitle><CardDescription>Growth-optimal sizing from your {currency} edge · {kelly.sampleSize} closed trades</CardDescription></div>
                    <Chip tone="accent">{currency}</Chip>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {overBetting ? (
                      <div className="flex items-start gap-2 rounded-md border border-loss/40 bg-loss/[0.06] p-3 text-sm text-ink">
                        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-loss" aria-hidden="true" />
                        <span>Your <strong>{riskPct}%</strong> risk per trade is above full Kelly (<strong>{pct(kelly.kellyFraction)}</strong>). Betting beyond Kelly deepens drawdowns and raises ruin without improving long-run growth — most traders use half or quarter Kelly.</span>
                      </div>
                    ) : null}

                    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                      <Metric label="Win rate" value={pct(kelly.winRate)} sub={`${kelly.sampleSize} closed trades`} />
                      <Metric label="Payoff" value={kelly.payoffRatio == null ? "—" : `${kelly.payoffRatio.toFixed(2)}×`} sub="Avg win ÷ avg loss (R)" />
                      <Metric label="Full Kelly" value={pct(kelly.kellyFraction)} sub="f* = W − (1−W)/R" />
                      <Metric label="Half Kelly" value={pct(kelly.halfKelly)} sub="Safer · ~3/4 growth" tone="profit" />
                      <Metric label="Quarter Kelly" value={pct(kelly.quarterKelly)} sub="Conservative" tone="profit" />
                      <Metric label="Growth-optimal" value={pct(kelly.growthOptimalFraction)} sub="From your R curve" />
                    </section>

                    <KellyGrowthChart growthCurve={kelly.growthCurve} quarterKelly={kelly.quarterKelly} halfKelly={kelly.halfKelly} kellyFraction={kelly.kellyFraction} growthOptimalFraction={kelly.growthOptimalFraction} />

                    {stress && stress.ok && stress.points.length > 0 ? (
                      <div>
                        <h3 className="font-serif text-lg text-ink">Position-size stress</h3>
                        <p className="mb-2 text-xs text-muted">Same edge, different risk per trade — re-simulated over {result.horizon} trades to show the sizing trade-off.</p>
                        <Table className="table-fixed">
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[28%] px-2">Risk / trade</TableHead>
                              <TableHead className="w-[24%] px-2 text-right">Risk of ruin</TableHead>
                              <TableHead className="w-[24%] px-2 text-right">Median final</TableHead>
                              <TableHead className="w-[24%] px-2 text-right">Max DD (95th)</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {stress.points.map((point) => {
                              const over = point.fraction > kelly.kellyFraction + 1e-9;
                              return (
                                <TableRow key={point.fraction} className={cn(over && "bg-loss/[0.05]")}>
                                  <TableCell className="px-2 font-semibold text-ink">
                                    {pct(point.fraction)}
                                    {Math.abs(point.fraction - kelly.kellyFraction) < 1e-9 ? <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-accent">Full Kelly</span> : over ? <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-loss">Over-bet</span> : null}
                                  </TableCell>
                                  <TableCell className={cn("tnum px-2 text-right", point.riskOfRuin >= 0.2 ? "text-loss" : point.riskOfRuin <= 0.05 ? "text-profit" : "text-ink")}>{pct(point.riskOfRuin)}</TableCell>
                                  <TableCell className={cn("tnum px-2 text-right", point.medianFinalEquity >= 1 ? "text-profit" : "text-loss")}>{mult(point.medianFinalEquity)}</TableCell>
                                  <TableCell className="tnum px-2 text-right text-ink">{pct(point.maxDrawdown95)}</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                          <TableCaption>{currency} · {kelly.label}. Higher risk per trade compounds faster but ruins more often.</TableCaption>
                        </Table>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ) : kelly && !kelly.ok && kelly.reason === "no-edge" ? (
                <div className="flex items-start gap-2 rounded-lg border border-line bg-sidebar p-4 text-sm text-muted">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                  <span>{kelly.message}</span>
                </div>
              ) : null}
            </>
          ) : (
            <Card><CardContent className="px-6 py-16 text-center text-sm text-muted">{busy ? "Simulating…" : "Adjust the controls to run a simulation."}</CardContent></Card>
          )}
        </>
      )}
        </TabsContent>
        <TabsContent value="what-if" className="mt-5">
          <WhatIfWorkspace samples={whatIfSamples} currency={currency} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
