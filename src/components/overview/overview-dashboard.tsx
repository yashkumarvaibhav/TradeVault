"use client";

import * as React from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Plus,
  RotateCcw,
  ShieldAlert,
  Target,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";

import { BarChart, type BarDatum } from "@/components/charts/bar-chart";
import { DonutChart, type DonutDatum } from "@/components/charts/donut-chart";
import { EquityChart, type EquityDatum } from "@/components/charts/equity-chart";
import { HeatmapChart, type HeatmapDatum } from "@/components/charts/heatmap-chart";
import { HistogramChart, type HistogramDatum } from "@/components/charts/histogram-chart";
import { ScopeControls } from "@/components/dashboard/scope-controls";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Currency } from "@/lib/domain/types";
import type { DashboardScope } from "@/lib/trade-scope";
import { cn } from "@/lib/utils";

export interface TradePreview {
  id: string;
  symbol: string;
  side: "Long" | "Short";
  result: number;
  r: number;
  when: string;
}

export interface OpenPreview {
  id: string;
  symbol: string;
  side: "Long" | "Short";
  risk: number;
  when: string;
}

export interface OverviewScope extends DashboardScope {
  /** Current calendar month as YYYY-MM, for the calendar label. */
  month: string;
}

export interface PreviewData {
  netPnl: number;
  winRate: number;
  totalTrades: number;
  expectancy: number;
  openRisk: number;
  openPositions: number;
  unreviewed: number;
  reviewedCount: number;
  ruleFollowRate: number | null;
  oldestPendingDays: number | null;
  equity: EquityDatum[];
  monthlyPnl: BarDatum[];
  returnDistribution: HistogramDatum[];
  directions: DonutDatum[];
  strategies: StrategyPreview[];
  trades: TradePreview[];
  openTrades: OpenPreview[];
  calendar: Record<number, number>;
  profitFactor: number;
  avgR: number;
  topSymbol: string;
}

export interface StrategyPreview {
  name: string;
  trades: number;
  winRate: number;
  expectancy: number;
}

const calendarDays = Array.from({ length: 30 }, (_, index) => index + 1);
const heatmapColumns = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const heatmapRows = ["W1", "W2", "W3", "W4", "W5"];
function buildDrawdown(points: EquityDatum[]): EquityDatum[] {
  let peak = 0;
  return points.map((point) => {
    peak = Math.max(peak, point.value);
    return { label: point.label, value: point.value - peak };
  });
}

function buildOutcomeHeatmap(calendar: Record<number, number>): HeatmapDatum[] {
  return heatmapRows.flatMap((row, rowIndex) => heatmapColumns.map((column, columnIndex) => {
    const day = rowIndex * 7 + columnIndex + 1;
    return {
      row,
      column,
      label: day <= 30 ? `Current month, day ${day}` : "Outside current month",
      value: day <= 30 ? calendar[day] ?? null : null,
    };
  }));
}

function moneyFormatter(currency: Currency) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "INR" ? 0 : 2,
  });
}

function MetricCard({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "neutral" | "profit" | "warning";
}) {
  return (
    <Card className="min-w-0">
      <CardContent className="p-4 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">{label}</p>
        <p
          className={cn(
            "tnum mt-2 truncate font-serif text-3xl font-medium tracking-[-0.035em] text-ink",
            tone === "profit" && "text-profit",
            tone === "warning" && "text-warn",
          )}
        >
          {value}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted">{detail}</p>
      </CardContent>
    </Card>
  );
}

export function OverviewDashboard({ dataByCurrency, displayName, asOf, scope }: { dataByCurrency: Record<Currency, PreviewData>; displayName: string; asOf: string; scope: OverviewScope }) {
  const [currency, setCurrency] = React.useState<Currency>("INR");
  const [equityMode, setEquityMode] = React.useState<"equity" | "drawdown">("equity");
  const data = dataByCurrency[currency];
  const formatMoney = moneyFormatter(currency);
  const equityPoints = equityMode === "equity" ? data.equity : buildDrawdown(data.equity);
  const outcomeHeatmap = buildOutcomeHeatmap(data.calendar);
  const scopeActive = scope.period !== "all" || scope.asset !== "Overall";
  const monthName = new Date(`${scope.month}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", timeZone: "UTC" });

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        eyebrow={
          <>
            <Chip tone="accent">Live journal</Chip>
            <Chip>{dataByCurrency.INR.totalTrades + dataByCurrency.USD.totalTrades} closed trades</Chip>
          </>
        }
        title={`Good afternoon, ${displayName}.`}
        description={`${asOf} · Metrics below come from the same scoped records as My Trades.`}
        actions={
          <>
            {scopeActive ? (
              <Button asChild variant="outline" size="compact"><Link href="/"><RotateCcw aria-hidden="true" /> Reset scope</Link></Button>
            ) : null}
            <Button asChild size="compact"><Link href="/trades/new"><Plus aria-hidden="true" />Add trade</Link></Button>
          </>
        }
      />

      <ScopeControls basePath="/" scope={scope} currency={currency} onCurrencyChange={setCurrency} />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5 lg:gap-4" aria-label={`${currency} key performance indicators`}>
        <MetricCard label="Net P&L" value={formatMoney.format(data.netPnl)} detail={`${currency} · all filtered closed trades`} tone={data.netPnl >= 0 ? "profit" : "warning"} />
        <MetricCard label="Win rate" value={`${data.winRate.toFixed(1)}%`} detail={`${Math.round((data.winRate / 100) * data.totalTrades)} of ${data.totalTrades} closed trades`} />
        <MetricCard label="Closed trades" value={String(data.totalTrades)} detail="Completed in selected scope" />
        <MetricCard label="Expectancy" value={formatMoney.format(data.expectancy)} detail={`${currency} per closed trade`} tone="profit" />
        <MetricCard label="Review attention" value={String(data.unreviewed)} detail={`${formatMoney.format(data.openRisk)} open 1R at risk`} tone="warning" />
      </section>

      <section className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardHeader className="flex-col sm:flex-row sm:items-center">
            <div>
              <CardTitle>Performance curve</CardTitle>
              <CardDescription>{equityMode === "equity" ? "Cumulative net P&L" : "Distance below the running peak"} · {currency} · full journal</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SegmentedControl
                type="single"
                value={equityMode}
                onValueChange={(value) => value && setEquityMode(value as "equity" | "drawdown")}
                aria-label="Performance curve mode"
              >
                <SegmentedControlItem value="equity">Equity</SegmentedControlItem>
                <SegmentedControlItem value="drawdown">Drawdown</SegmentedControlItem>
              </SegmentedControl>
              <Chip tone="accent">{currency}</Chip>
            </div>
          </CardHeader>
          <CardContent><EquityChart points={equityPoints} currency={currency} mode={equityMode} /></CardContent>
        </Card>

        <Card className="xl:col-span-4">
          <CardHeader>
            <div>
              <CardTitle>Risk &amp; review</CardTitle>
              <CardDescription>Items that deserve attention now</CardDescription>
            </div>
            <ShieldAlert className="size-5 text-warn" aria-hidden="true" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md border border-warn/25 bg-warn/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-ink">Open 1R at risk</span>
                <span className="tnum font-serif text-xl text-warn">{formatMoney.format(data.openRisk)}</span>
              </div>
              <p className="mt-1 text-xs text-muted">Across {data.openPositions} open positions · {currency}</p>
            </div>
            <div className="flex min-h-14 items-center gap-3 rounded-md border border-line p-3">
              <CircleAlert className="size-5 text-warn" aria-hidden="true" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-ink">{data.unreviewed} trades await review</p>
                <p className="text-xs text-muted">{data.oldestPendingDays == null ? "No pending review age" : `Oldest pending for ${data.oldestPendingDays} days`}</p>
              </div>
            </div>
            <div className="flex min-h-14 items-center gap-3 rounded-md border border-line p-3">
              <CheckCircle2 className="size-5 text-profit" aria-hidden="true" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-ink">{data.ruleFollowRate == null ? "No reviewed sample yet" : `${data.ruleFollowRate.toFixed(1)}% rule-follow rate`}</p>
                <p className="text-xs text-muted">{data.reviewedCount ? `Reviewed sample · ${data.reviewedCount} trades` : "Complete reviews before judging discipline"}</p>
              </div>
            </div>
            <Button asChild variant="outline" className="w-full"><Link href="/review#review-queue">Review closed trades<ArrowUpRight aria-hidden="true" /></Link></Button>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-12" aria-label={`${currency} performance diagnostics`}>
        <Card className="xl:col-span-8">
          <CardHeader>
            <div>
              <CardTitle>Performance diagnostics</CardTitle>
              <CardDescription>One diagnostic at a time · {currency} · closed journal trades</CardDescription>
            </div>
            <Chip tone="accent">{data.totalTrades} trades</Chip>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="monthly">
              <TabsList aria-label="Performance diagnostic" className="w-full sm:w-auto">
                <TabsTrigger value="monthly" className="flex-1 sm:flex-none">Monthly P&amp;L</TabsTrigger>
                <TabsTrigger value="returns" className="flex-1 sm:flex-none">Return distribution</TabsTrigger>
              </TabsList>
              <TabsContent value="monthly">
                <BarChart
                  data={data.monthlyPnl}
                  metric="Monthly net P&L"
                  unit={currency}
                  scope="closed trades · full journal history"
                  sampleSize={data.totalTrades}
                  formatValue={formatMoney.format}
                />
              </TabsContent>
              <TabsContent value="returns">
                <HistogramChart
                  data={data.returnDistribution}
                  metric="Return distribution"
                  scope={`${currency} closed trades · full journal`}
                  sampleSize={data.totalTrades}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card className="xl:col-span-4">
          <CardHeader>
            <div>
              <CardTitle>Strategy snapshot</CardTitle>
              <CardDescription>Expectancy stays inside the {currency} scope</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[44%] px-2">Strategy</TableHead>
                  <TableHead className="w-[23%] px-2 text-right" aria-label="Win rate">Win %</TableHead>
                  <TableHead className="w-[33%] px-2 text-right" aria-label="Expectancy">Expect.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.strategies.map((row) => (
                  <TableRow key={row.name}>
                    <TableCell className="whitespace-normal px-2">
                      <span className="block font-semibold text-ink">{row.name}</span>
                      <span className="text-xs text-muted">{row.trades} trades</span>
                    </TableCell>
                    <TableCell className="tnum px-2 text-right text-xs">{row.winRate.toFixed(1)}%</TableCell>
                    <TableCell className={cn("tnum px-2 text-right text-xs font-semibold", row.expectancy >= 0 ? "text-profit" : "text-loss")}>
                      {formatMoney.format(row.expectancy)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableCaption>{currency} strategy results · grouped by the saved trading-style field.</TableCaption>
            </Table>
            <div className="mt-5 border-t border-line pt-5">
              <DonutChart
                data={data.directions}
                metric="Long vs Short"
                unit="closed trades"
                scope={`${currency} · full journal`}
                sampleSize={data.totalTrades}
              />
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <CardHeader>
            <div>
              <CardTitle>Recent trades</CardTitle>
              <CardDescription>Latest closed positions in the {currency} journal</CardDescription>
            </div>
            <Clock3 className="size-5 text-muted" aria-hidden="true" />
          </CardHeader>
          <CardContent className="space-y-2">
            {data.trades.length === 0 ? (
              <p className="text-sm text-faint">No closed trades in this scope yet.</p>
            ) : data.trades.map((trade) => (
              <Link key={trade.id} href={`/trades/${trade.id}`} className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-line px-3 py-2 transition-colors hover:border-line-strong hover:bg-hover sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{trade.symbol}</p>
                  <p className="mt-0.5 text-xs text-muted">{trade.when}</p>
                </div>
                <Chip tone="neutral" className="hidden sm:inline-flex">{trade.side}</Chip>
                <span className={cn("tnum text-right text-sm font-semibold", trade.result >= 0 ? "text-profit" : "text-loss")}>
                  {trade.result >= 0 ? "+" : ""}{formatMoney.format(trade.result)}
                </span>
                <span className={cn("tnum hidden w-16 text-right text-sm sm:block", trade.r >= 0 ? "text-profit" : "text-loss")}>
                  {trade.r >= 0 ? "+" : ""}{trade.r.toFixed(1)}R
                </span>
              </Link>
            ))}
            {data.openTrades.length ? (
              <div className="mt-4 border-t border-line pt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted">Open positions · {data.openTrades.length}</p>
                <div className="space-y-2">
                  {data.openTrades.map((position) => (
                    <Link key={position.id} href={`/trades/${position.id}`} className="grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-line px-3 py-2 transition-colors hover:border-line-strong hover:bg-hover">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-ink">{position.symbol} <span className="text-xs font-normal text-muted">· {position.side}</span></p>
                        <p className="mt-0.5 text-xs text-muted">Entered {position.when}</p>
                      </div>
                      <span className="whitespace-nowrap text-right text-sm text-warn tnum">{formatMoney.format(position.risk)}<span className="ml-1 text-xs text-muted">at risk</span></span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="xl:col-span-5">
          <CardHeader>
            <div>
              <CardTitle>{monthName} activity</CardTitle>
              <CardDescription>Daily closed P&amp;L · {currency} · current month</CardDescription>
            </div>
            <Button asChild variant="ghost" size="compact"><Link href={`/calendar?mode=month&month=${scope.month}`}>Open calendar<CalendarClock aria-hidden="true" /></Link></Button>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="month">
              <TabsList aria-label="Calendar view" className="w-full">
                <TabsTrigger value="month" className="flex-1">Month</TabsTrigger>
                <TabsTrigger value="intensity" className="flex-1">Outcome intensity</TabsTrigger>
              </TabsList>
              <TabsContent value="month">
                <div className="mb-2 grid grid-cols-7 text-center text-[10px] font-semibold uppercase tracking-wider text-faint" aria-hidden="true">
                  {['M','T','W','T','F','S','S'].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((day) => {
                    const result = data.calendar[day];
                    return (
                      <button
                        type="button"
                        key={day}
                        className={cn(
                          "tnum flex aspect-square min-h-11 flex-col items-center justify-center rounded-sm border border-line text-xs text-muted transition-colors hover:border-line-strong",
                          result > 0 && "border-profit/20 bg-profit/10 text-profit",
                          result < 0 && "border-loss/20 bg-loss/10 text-loss",
                        )}
                        aria-label={result == null ? `${monthName} ${day}: no trades` : `${monthName} ${day}: ${formatMoney.format(result)} closed P&L in ${currency}`}
                      >
                        <span>{day}</span>
                        {result != null && <span className="hidden text-[8px] font-semibold 2xl:block">{result > 0 ? "+" : ""}{Math.round(result)}</span>}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted">
                  <span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-full bg-profit" /> Profit</span>
                  <span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-full bg-loss" /> Loss</span>
                  <span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-full border border-line bg-raised" /> No trade</span>
                </div>
              </TabsContent>
              <TabsContent value="intensity">
                <HeatmapChart
                  data={outcomeHeatmap}
                  rows={heatmapRows}
                  columns={heatmapColumns}
                  metric="Daily outcome intensity"
                  unit={currency}
                  scope="Current month · closed journal trades"
                  sampleSize={data.totalTrades}
                  formatValue={formatMoney.format}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 sm:grid-cols-3" aria-label={`${currency} quick statistics`}>
        <Card><CardContent className="flex items-center gap-4 p-5"><TrendingUp className="size-6 text-profit" aria-hidden="true" /><div><p className="text-xs uppercase tracking-wider text-muted">Profit factor</p><p className="tnum mt-1 font-serif text-2xl text-ink">{data.profitFactor.toFixed(2)}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-4 p-5"><Target className="size-6 text-accent" aria-hidden="true" /><div><p className="text-xs uppercase tracking-wider text-muted">Average realized R</p><p className="tnum mt-1 font-serif text-2xl text-ink">+{data.avgR.toFixed(2)}R</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-4 p-5">{data.netPnl >= 0 ? <ArrowUpRight className="size-6 text-profit" aria-hidden="true" /> : <ArrowDownRight className="size-6 text-loss" aria-hidden="true" />}<div><p className="text-xs uppercase tracking-wider text-muted">Top instrument</p><p className="mt-1 font-serif text-2xl text-ink">{data.topSymbol}</p></div></CardContent></Card>
      </section>
    </div>
  );
}
