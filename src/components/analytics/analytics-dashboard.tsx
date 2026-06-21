"use client";

import * as React from "react";
import { Plus, RotateCcw } from "lucide-react";
import Link from "next/link";

import { BarChart } from "@/components/charts/bar-chart";
import { DonutChart } from "@/components/charts/donut-chart";
import { EquityChart } from "@/components/charts/equity-chart";
import { ExcursionChart } from "@/components/charts/excursion-chart";
import { HistogramChart } from "@/components/charts/histogram-chart";
import { ScopeControls } from "@/components/dashboard/scope-controls";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CurrencyAnalytics, CurrencyAnalyticsMap, GroupStat } from "@/lib/domain/analytics";
import type { CurrencyExcursionAnalytics, CurrencyExcursionAnalyticsMap } from "@/lib/domain/excursion-analytics";
import type { Currency } from "@/lib/domain/types";
import type { DashboardScope } from "@/lib/trade-scope";
import { cn } from "@/lib/utils";

function moneyFormatter(currency: Currency) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: currency === "INR" ? 0 : 2 });
}

function Kpi({ label, value, sub, tone = "neutral" }: { label: string; value: string; sub: string; tone?: "neutral" | "profit" | "loss" }) {
  return (
    <Card className="min-w-0">
      <CardContent className="p-4 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">{label}</p>
        <p className={cn("tnum mt-2 truncate font-serif text-2xl font-medium tracking-[-0.03em] text-ink sm:text-3xl", tone === "profit" && "text-profit", tone === "loss" && "text-loss")}>{value}</p>
        <p className="mt-2 text-xs leading-relaxed text-muted">{sub}</p>
      </CardContent>
    </Card>
  );
}

function GroupStatTable({ rows, currency, emptyLabel, label }: { rows: GroupStat[]; currency: Currency; emptyLabel: string; label: string }) {
  const money = moneyFormatter(currency);
  if (rows.length === 0) return <p className="text-sm text-faint">{emptyLabel}</p>;
  return (
    <Table className="table-fixed" regionLabel={label}>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[34%] px-2">Name</TableHead>
          <TableHead className="w-[14%] px-2 text-right">Trades</TableHead>
          <TableHead className="w-[18%] px-2 text-right">Win %</TableHead>
          <TableHead className="w-[34%] px-2 text-right">Expectancy</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.slice(0, 8).map((row) => (
          <TableRow key={row.name}>
            <TableCell className="truncate px-2 font-semibold text-ink">{row.name}</TableCell>
            <TableCell className="tnum px-2 text-right text-xs">{row.count}</TableCell>
            <TableCell className="tnum px-2 text-right text-xs">{row.winPct.toFixed(0)}%</TableCell>
            <TableCell className={cn("tnum px-2 text-right text-xs font-semibold", row.expectancy >= 0 ? "text-profit" : "text-loss")}>{money.format(row.expectancy)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableCaption>{currency} · expectancy is net P&amp;L per closed trade in this group.</TableCaption>
    </Table>
  );
}

function AnalyticsBody({ data, excursion, currency }: { data: CurrencyAnalytics; excursion?: CurrencyExcursionAnalytics; currency: Currency }) {
  const [equityMode, setEquityMode] = React.useState<"equity" | "drawdown">("equity");
  const money = moneyFormatter(currency);
  const sample = data.totalTrades;
  const equityPoints = data.equityCurve.map((point) => ({
    label: new Date(point.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "UTC" }),
    value: equityMode === "equity" ? point.cumulative : point.drawdown,
  }));
  const monthly = data.monthlyPnl.map((point) => ({ label: new Date(`${point.month}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" }), value: point.pnl }));
  const weekday = data.weekdayPnl.map((point) => ({ label: point.weekday, value: point.pnl }));
  const category = Object.entries(data.categoryPnl).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  const directions = data.directionSplit.map((split) => ({ label: split.direction, value: split.count }));
  const maxSymbolAbs = Math.max(1, ...data.symbolLeaderboard.map((row) => Math.abs(row.pnl)));
  const peak = data.equityCurve.reduce((max, point) => Math.max(max, point.cumulative), 0);
  const drawdownPct = peak > 0 ? (Math.abs(data.maxDrawdown) / peak) * 100 : null;

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* KPI bento (4x2) */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4" aria-label={`${currency} key performance indicators`}>
        <Kpi label="Net P&L" value={money.format(data.netPnl)} sub={`${currency} · ${sample} closed trades`} tone={data.netPnl >= 0 ? "profit" : "loss"} />
        <Kpi label="Win rate" value={`${data.winPct.toFixed(1)}%`} sub={`${data.winningTrades} W · ${data.losingTrades} L`} />
        <Kpi label="Profit factor" value={data.profitFactor == null ? "—" : data.profitFactor.toFixed(2)} sub="Gross profit ÷ gross loss" />
        <Kpi label="Expectancy" value={money.format(data.expectancy)} sub={`${currency} per closed trade`} tone={data.expectancy >= 0 ? "profit" : "loss"} />
        <Kpi label="Payoff ratio" value={data.payoffRatio == null ? "—" : data.payoffRatio.toFixed(2)} sub="Avg win ÷ avg loss" />
        <Kpi label="Avg realized R" value={`${data.avgRealizedR >= 0 ? "+" : ""}${data.avgRealizedR.toFixed(2)}R`} sub={`Planned ${data.avgPlannedRR.toFixed(2)}R avg`} tone={data.avgRealizedR >= 0 ? "profit" : "loss"} />
        <Kpi label="Max drawdown" value={money.format(data.maxDrawdown)} sub={drawdownPct == null ? `${currency} · trough to peak` : `${drawdownPct.toFixed(1)}% from peak`} tone={data.maxDrawdown < 0 ? "loss" : "neutral"} />
        <Kpi label="Current streak" value={data.currentStreak || "—"} sub={`Largest win ${money.format(data.largestWin)}`} tone={data.currentStreak.endsWith("W") ? "profit" : data.currentStreak.endsWith("L") ? "loss" : "neutral"} />
      </section>

      {/* Equity / drawdown */}
      <Card>
        <CardHeader className="flex-col sm:flex-row sm:items-center">
          <div>
            <CardTitle>Performance curve</CardTitle>
            <CardDescription>{equityMode === "equity" ? "Cumulative net P&L" : "Distance below the running peak"} · {currency} · {sample} closed trades</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl type="single" value={equityMode} onValueChange={(value) => value && setEquityMode(value as "equity" | "drawdown")} aria-label="Performance curve mode">
              <SegmentedControlItem value="equity">Equity</SegmentedControlItem>
              <SegmentedControlItem value="drawdown">Drawdown</SegmentedControlItem>
            </SegmentedControl>
            <Chip tone="accent">{currency}</Chip>
          </div>
        </CardHeader>
        <CardContent><EquityChart points={equityPoints} currency={currency} mode={equityMode} /></CardContent>
      </Card>

      {/* Manual MAE / MFE evidence */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Excursion efficiency</CardTitle>
            <CardDescription>How much favorable movement became realized R · {currency} · manual evidence only</CardDescription>
          </div>
          <Chip tone="accent">{excursion?.sampleSize ?? 0} captured</Chip>
        </CardHeader>
        <CardContent>
          <div className="grid gap-5 xl:grid-cols-12 xl:items-center">
            <div className="xl:col-span-8"><ExcursionChart points={excursion?.points ?? []} currency={currency} /></div>
            <dl className="grid grid-cols-2 gap-3 xl:col-span-4 xl:grid-cols-1">
              {[
                { label: "Avg MFE", value: excursion ? `${excursion.avgMfeR.toFixed(2)}R` : "—", detail: `${excursion?.sampleSize ?? 0} favorable samples` },
                { label: "Avg MAE", value: excursion?.avgMaeR == null ? "—" : `${excursion.avgMaeR.toFixed(2)}R`, detail: `${excursion?.maeSampleSize ?? 0} adverse samples` },
                { label: "Median captured", value: excursion ? `${excursion.medianCapturedMovePct.toFixed(1)}%` : "—", detail: "Signed realized P&L ÷ MFE" },
              ].map((metric) => (
                <div key={metric.label} className="rounded-md border border-line bg-page p-4">
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{metric.label}</dt>
                  <dd className="tnum mt-1 font-serif text-2xl font-medium text-ink">{metric.value}</dd>
                  <dd className="mt-1 text-xs text-muted">{metric.detail}</dd>
                </div>
              ))}
            </dl>
          </div>
          <p className="mt-4 border-t border-line pt-4 text-xs leading-relaxed text-muted">Only manually entered maximum favorable and adverse prices are included. Missing evidence stays missing; TradeVault does not infer candles or market data.</p>
        </CardContent>
      </Card>

      {/* Diagnostics: monthly / return distribution / R histogram */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Distribution diagnostics</CardTitle>
            <CardDescription>One diagnostic at a time · {currency} · closed trades</CardDescription>
          </div>
          <Chip tone="accent">{sample} trades</Chip>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="monthly">
            <TabsList aria-label="Distribution diagnostic" className="w-full sm:w-auto">
              <TabsTrigger value="monthly" className="flex-1 sm:flex-none">Monthly P&amp;L</TabsTrigger>
              <TabsTrigger value="returns" className="flex-1 sm:flex-none">Return %</TabsTrigger>
              <TabsTrigger value="rmultiple" className="flex-1 sm:flex-none">R-multiple</TabsTrigger>
            </TabsList>
            <TabsContent value="monthly"><BarChart data={monthly} metric="Monthly net P&L" unit={currency} scope={`${currency} closed trades · selected scope`} sampleSize={sample} formatValue={money.format} /></TabsContent>
            <TabsContent value="returns"><HistogramChart data={data.returnDistribution} metric="Return distribution" scope={`${currency} closed trades · % return per trade`} sampleSize={sample} /></TabsContent>
            <TabsContent value="rmultiple"><HistogramChart data={data.rMultipleDistribution} metric="R-multiple distribution" scope={`${currency} closed trades · realized R per trade`} sampleSize={sample} /></TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Asset analysis + direction donut */}
      <section className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <CardHeader><div><CardTitle>Asset-class P&amp;L</CardTitle><CardDescription>Net P&amp;L by asset class · {currency}</CardDescription></div></CardHeader>
          <CardContent>
            {category.length === 0 ? <p className="text-sm text-faint">No closed trades in this scope.</p> : (
              <BarChart data={category} metric="Net P&L by asset class" unit={currency} scope={`${currency} closed trades`} sampleSize={sample} formatValue={money.format} />
            )}
          </CardContent>
        </Card>
        <Card className="xl:col-span-5">
          <CardHeader><div><CardTitle>Long vs short</CardTitle><CardDescription>Closed-trade mix and win rate · {currency}</CardDescription></div></CardHeader>
          <CardContent>
            <DonutChart data={directions} metric="Long vs Short" unit="closed trades" scope={`${currency} · selected scope`} sampleSize={sample} />
            <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4">
              {data.directionSplit.map((split) => (
                <div key={split.direction} className="rounded-md border border-line bg-page p-3">
                  <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{split.direction}</dt>
                  <dd className={cn("tnum mt-1 text-lg font-semibold", split.pnl >= 0 ? "text-profit" : "text-loss")}>{money.format(split.pnl)}</dd>
                  <dd className="text-xs text-muted">{split.count} trades · {split.winPct.toFixed(0)}% win</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </section>

      {/* Symbol leaderboard + weekday */}
      <section className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <CardHeader><div><CardTitle>Symbol leaderboard</CardTitle><CardDescription>Ranked by net P&amp;L · {currency}</CardDescription></div></CardHeader>
          <CardContent className="space-y-2">
            {data.symbolLeaderboard.length === 0 ? <p className="text-sm text-faint">No closed trades in this scope.</p> : data.symbolLeaderboard.slice(0, 8).map((row) => (
              <div key={row.symbol} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <div className="min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-ink">{row.symbol}</span>
                    <span className="shrink-0 text-xs text-muted">{row.count} · {row.winPct.toFixed(0)}%</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sidebar" aria-hidden="true">
                    <div className={cn("h-full rounded-full", row.pnl >= 0 ? "bg-profit" : "bg-loss")} style={{ width: `${(Math.abs(row.pnl) / maxSymbolAbs) * 100}%` }} />
                  </div>
                </div>
                <span className={cn("tnum w-24 text-right text-sm font-semibold", row.pnl >= 0 ? "text-profit" : "text-loss")}>{money.format(row.pnl)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="xl:col-span-5">
          <CardHeader><div><CardTitle>Weekday performance</CardTitle><CardDescription>Net P&amp;L by day of week · {currency}</CardDescription></div></CardHeader>
          <CardContent><BarChart data={weekday} metric="Net P&L by weekday" unit={currency} scope={`${currency} closed trades`} sampleSize={sample} formatValue={money.format} /></CardContent>
        </Card>
      </section>

      {/* Strategy / playbook expectancy */}
      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><div><CardTitle>Strategy expectancy</CardTitle><CardDescription>Win rate &amp; expectancy by strategy · {currency}</CardDescription></div></CardHeader>
          <CardContent><GroupStatTable rows={data.strategyStats} currency={currency} emptyLabel="No closed trades in this scope." label={`Per-strategy expectancy (${currency})`} /></CardContent>
        </Card>
        <Card>
          <CardHeader><div><CardTitle>Playbook expectancy</CardTitle><CardDescription>Win rate &amp; expectancy by playbook · {currency}</CardDescription></div></CardHeader>
          <CardContent><GroupStatTable rows={data.playbookStats} currency={currency} emptyLabel="No closed trades in this scope." label={`Per-playbook expectancy (${currency})`} /></CardContent>
        </Card>
      </section>

      {/* Risk metrics band */}
      <Card>
        <CardHeader><div><CardTitle>Risk &amp; consistency</CardTitle><CardDescription>{currency} · closed trades in scope</CardDescription></div></CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: "Avg win", value: money.format(data.avgWin), tone: "profit" as const },
              { label: "Avg loss", value: money.format(data.avgLoss), tone: "loss" as const },
              { label: "Largest win", value: money.format(data.largestWin), tone: "profit" as const },
              { label: "Largest loss", value: money.format(data.largestLoss), tone: "loss" as const },
              { label: "Avg win hold", value: `${data.avgWinDurationHours.toFixed(1)}h`, tone: "neutral" as const },
              { label: "Avg loss hold", value: `${data.avgLossDurationHours.toFixed(1)}h`, tone: "neutral" as const },
            ].map((metric) => (
              <div key={metric.label} className="rounded-md border border-line bg-page p-3">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{metric.label}</dt>
                <dd className={cn("tnum mt-1 text-sm font-semibold text-ink", metric.tone === "profit" && "text-profit", metric.tone === "loss" && "text-loss")}>{metric.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

export function AnalyticsDashboard({ analyticsByCurrency, excursionByCurrency, currency, scope, timeZone }: { analyticsByCurrency: CurrencyAnalyticsMap; excursionByCurrency: CurrencyExcursionAnalyticsMap; currency: Currency; scope: DashboardScope; timeZone?: string }) {
  const scopeActive = scope.period !== "all" || scope.asset !== "Overall";
  const data = analyticsByCurrency[currency];

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        eyebrow={<><Chip tone="accent">Performance</Chip><Chip>{data?.totalTrades ?? 0} {currency} closed trades</Chip></>}
        title="Analytics"
        description="Where is the edge and risk? Every metric stays inside a single currency and counts only closed trades."
        actions={
          <>
            {scopeActive ? <Button asChild variant="outline" size="compact"><Link href="/analytics"><RotateCcw aria-hidden="true" /> Reset scope</Link></Button> : null}
            <Button asChild size="compact"><Link href="/trades/new"><Plus aria-hidden="true" />Add trade</Link></Button>
          </>
        }
      />

      <ScopeControls basePath="/analytics" scope={scope} currency={currency} timeZone={timeZone} />

      {data ? (
        <AnalyticsBody key={currency} data={data} excursion={excursionByCurrency[currency]} currency={currency} />
      ) : (
        <Card>
          <CardContent className="px-6 py-16 text-center">
            <h2 className="font-serif text-2xl text-ink">No closed {currency} trades in this scope.</h2>
            <p className="mt-2 text-sm text-muted">Use the global market switch or widen the date/asset scope above. Analytics only count closed trades with a computable result.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
