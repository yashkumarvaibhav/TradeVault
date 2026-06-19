"use client";

import * as React from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Filter,
  RotateCcw,
  ShieldAlert,
  Target,
  TrendingUp,
} from "lucide-react";

import { BarChart, type BarDatum } from "@/components/charts/bar-chart";
import { EquityChart, type EquityDatum } from "@/components/charts/equity-chart";
import { HistogramChart, type HistogramDatum } from "@/components/charts/histogram-chart";
import { PageHeader } from "@/components/layout/page-header";
import { ScopeField, ScopeToolbar } from "@/components/layout/scope-toolbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Combobox } from "@/components/ui/combobox";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toaster";
import type { Currency } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

interface TradePreview {
  symbol: string;
  side: "Long" | "Short";
  result: number;
  r: number;
  when: string;
}

interface PreviewData {
  netPnl: number;
  winRate: number;
  totalTrades: number;
  expectancy: number;
  openRisk: number;
  unreviewed: number;
  equity: EquityDatum[];
  monthlyPnl: BarDatum[];
  returnDistribution: HistogramDatum[];
  strategies: StrategyPreview[];
  trades: TradePreview[];
  calendar: Record<number, number>;
  profitFactor: number;
  avgR: number;
  topSymbol: string;
}

interface StrategyPreview {
  name: string;
  trades: number;
  winRate: number;
  expectancy: number;
}

const preview: Record<Currency, PreviewData> = {
  INR: {
    netPnl: 18420,
    winRate: 64.3,
    totalTrades: 14,
    expectancy: 1315.71,
    openRisk: 6200,
    unreviewed: 3,
    equity: [
      { label: "21 May", value: 0 },
      { label: "25 May", value: 4200 },
      { label: "29 May", value: 1800 },
      { label: "2 Jun", value: 7600 },
      { label: "6 Jun", value: 6400 },
      { label: "10 Jun", value: 12100 },
      { label: "14 Jun", value: 9800 },
      { label: "18 Jun", value: 18420 },
    ],
    monthlyPnl: [
      { label: "Jan", value: 2800 },
      { label: "Feb", value: -1450 },
      { label: "Mar", value: 4250 },
      { label: "Apr", value: 3100 },
      { label: "May", value: 6200 },
      { label: "Jun", value: 12220 },
    ],
    returnDistribution: [
      { range: "-4%–-2%", count: 1 },
      { range: "-2%–0%", count: 4 },
      { range: "0%–2%", count: 5 },
      { range: "2%–4%", count: 3 },
      { range: "4%–6%", count: 1 },
    ],
    strategies: [
      { name: "Opening breakout", trades: 5, winRate: 80, expectancy: 1900 },
      { name: "Trend continuation", trades: 4, winRate: 75, expectancy: 1210 },
      { name: "Mean reversion", trades: 3, winRate: 33.3, expectancy: -420 },
    ],
    trades: [
      { symbol: "NIFTY FUT", side: "Long", result: 6250, r: 1.8, when: "Today, 11:24" },
      { symbol: "RELIANCE", side: "Short", result: -2180, r: -0.7, when: "Yesterday" },
      { symbol: "BANKNIFTY", side: "Long", result: 4350, r: 1.2, when: "17 Jun" },
    ],
    calendar: { 2: 1800, 4: -950, 6: 3100, 9: 2250, 10: 3450, 13: -2300, 17: 4350, 18: 6250 },
    profitFactor: 2.14,
    avgR: 0.62,
    topSymbol: "NIFTY FUT",
  },
  USD: {
    netPnl: 486.75,
    winRate: 60,
    totalTrades: 10,
    expectancy: 48.68,
    openRisk: 140,
    unreviewed: 2,
    equity: [
      { label: "21 May", value: 0 },
      { label: "25 May", value: 85 },
      { label: "29 May", value: 42 },
      { label: "2 Jun", value: 185 },
      { label: "6 Jun", value: 160 },
      { label: "10 Jun", value: 335 },
      { label: "14 Jun", value: 298 },
      { label: "18 Jun", value: 486.75 },
    ],
    monthlyPnl: [
      { label: "Jan", value: 82 },
      { label: "Feb", value: -44.5 },
      { label: "Mar", value: 116.25 },
      { label: "Apr", value: 95 },
      { label: "May", value: 142 },
      { label: "Jun", value: 344.75 },
    ],
    returnDistribution: [
      { range: "-4%–-2%", count: 1 },
      { range: "-2%–0%", count: 3 },
      { range: "0%–2%", count: 3 },
      { range: "2%–4%", count: 2 },
      { range: "4%–6%", count: 1 },
    ],
    strategies: [
      { name: "US open momentum", trades: 4, winRate: 75, expectancy: 72.5 },
      { name: "Trend continuation", trades: 3, winRate: 66.7, expectancy: 54.25 },
      { name: "Mean reversion", trades: 3, winRate: 33.3, expectancy: -18.5 },
    ],
    trades: [
      { symbol: "MNQ", side: "Long", result: 188.75, r: 1.5, when: "Today, 09:42" },
      { symbol: "AAPL", side: "Long", result: 96, r: 0.8, when: "Yesterday" },
      { symbol: "MES", side: "Short", result: -64.5, r: -0.6, when: "16 Jun" },
    ],
    calendar: { 1: 48, 3: -31, 5: 126, 8: 72, 11: -42, 14: 57, 16: -64.5, 18: 188.75 },
    profitFactor: 1.82,
    avgR: 0.48,
    topSymbol: "MNQ",
  },
};

const calendarDays = Array.from({ length: 30 }, (_, index) => index + 1);
const assetOptions = [
  { value: "all", label: "All assets" },
  { value: "equity", label: "Equity", keywords: ["cash", "stocks"] },
  { value: "index", label: "Index", keywords: ["futures", "options"] },
  { value: "forex", label: "Forex", keywords: ["currency", "fx"] },
  { value: "crypto", label: "Crypto", keywords: ["spot", "perpetual"] },
];

const strategyOptions = [
  { value: "all", label: "All strategies" },
  { value: "breakout", label: "Opening breakout" },
  { value: "trend", label: "Trend continuation" },
  { value: "reversion", label: "Mean reversion" },
];

function buildDrawdown(points: EquityDatum[]): EquityDatum[] {
  let peak = 0;
  return points.map((point) => {
    peak = Math.max(peak, point.value);
    return { label: point.label, value: point.value - peak };
  });
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

export function OverviewDashboard() {
  const [currency, setCurrency] = React.useState<Currency>("INR");
  const [asset, setAsset] = React.useState("all");
  const [strategy, setStrategy] = React.useState("all");
  const [direction, setDirection] = React.useState("all");
  const [equityMode, setEquityMode] = React.useState<"equity" | "drawdown">("equity");
  const data = preview[currency];
  const formatMoney = moneyFormatter(currency);
  const equityPoints = equityMode === "equity" ? data.equity : buildDrawdown(data.equity);

  function resetScope() {
    setCurrency("INR");
    setAsset("all");
    setStrategy("all");
    setDirection("all");
    setEquityMode("equity");
    toast.success("Preview scope reset", { description: "Showing the INR foundation sample." });
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        eyebrow={
          <>
            <Chip tone="accent">Foundation preview</Chip>
            <Chip>Sample data · not your journal</Chip>
          </>
        }
        title="Good afternoon, Yash."
        description="Friday, 19 June · A calm read on performance, risk, and unfinished review work."
        actions={
          <>
            <Button variant="outline" size="compact" onClick={resetScope}>
              <RotateCcw aria-hidden="true" /> Reset scope
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="secondary" size="compact"><Filter aria-hidden="true" /> More filters</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>More preview filters</DialogTitle>
                  <DialogDescription>These controls establish the interaction pattern. They will query real journal data after the data layer lands.</DialogDescription>
                </DialogHeader>
                <div className="space-y-5 py-2">
                  <ScopeField label="Strategy">
                    <Combobox
                      ariaLabel="Strategy filter"
                      options={strategyOptions}
                      value={strategy}
                      onValueChange={setStrategy}
                      placeholder="All strategies"
                      searchPlaceholder="Search strategies…"
                    />
                  </ScopeField>
                  <ScopeField label="Direction">
                    <SegmentedControl
                      type="single"
                      value={direction}
                      onValueChange={(value) => value && setDirection(value)}
                      aria-label="Direction filter"
                      className="w-full"
                    >
                      <SegmentedControlItem value="all" className="flex-1">All</SegmentedControlItem>
                      <SegmentedControlItem value="long" className="flex-1">Long</SegmentedControlItem>
                      <SegmentedControlItem value="short" className="flex-1">Short</SegmentedControlItem>
                    </SegmentedControl>
                  </ScopeField>
                </div>
                <DialogFooter>
                  <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                  <DialogClose asChild>
                    <Button onClick={() => toast.info("Filter pattern saved", { description: "Real query wiring arrives with the Drizzle data layer." })}>Apply preview</Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <ScopeToolbar
        label="Dashboard scope"
        note={<>Money metrics are isolated to <strong className="text-ink">{currency}</strong>. INR and USD are never combined.</>}
      >
          <ScopeField label="Period" className="flex-1">
            <Select defaultValue="30d">
              <SelectTrigger aria-label="Period scope" className="w-full sm:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="30d">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
          </ScopeField>
          <ScopeField label="Asset" className="flex-1">
            <Combobox
              ariaLabel="Asset scope"
              options={assetOptions}
              value={asset}
              onValueChange={(value) => {
                setAsset(value);
                if (value !== "all") toast.info("Asset control preview", { description: "The sample stays fixed until journal queries are connected." });
              }}
              className="sm:w-44"
            />
          </ScopeField>
          <ScopeField label="Currency">
            <Select value={currency} onValueChange={(value) => setCurrency(value as Currency)}>
              <SelectTrigger aria-label="Currency scope" className="w-full sm:w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="INR">INR</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
          </ScopeField>
      </ScopeToolbar>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5 lg:gap-4" aria-label={`${currency} key performance indicators`}>
        <MetricCard label="Net P&L" value={formatMoney.format(data.netPnl)} detail={`${currency} · closed trades · 30 days`} tone="profit" />
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
              <CardDescription>{equityMode === "equity" ? "Cumulative net P&L" : "Distance below the running peak"} · {currency} · 30 days</CardDescription>
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
              <p className="mt-1 text-xs text-muted">Across 2 open positions · {currency}</p>
            </div>
            <div className="flex min-h-14 items-center gap-3 rounded-md border border-line p-3">
              <CircleAlert className="size-5 text-warn" aria-hidden="true" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-ink">{data.unreviewed} trades await review</p>
                <p className="text-xs text-muted">Oldest pending for 3 days</p>
              </div>
            </div>
            <div className="flex min-h-14 items-center gap-3 rounded-md border border-line p-3">
              <CheckCircle2 className="size-5 text-profit" aria-hidden="true" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-ink">82% rule-follow rate</p>
                <p className="text-xs text-muted">Reviewed sample · 11 trades</p>
              </div>
            </div>
            <Button variant="outline" className="w-full" disabled>Open review queue · coming soon</Button>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-12" aria-label={`${currency} performance diagnostics`}>
        <Card className="xl:col-span-8">
          <CardHeader>
            <div>
              <CardTitle>Performance diagnostics</CardTitle>
              <CardDescription>One diagnostic at a time · {currency} · closed preview trades</CardDescription>
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
                  scope="closed trades · preview history"
                  sampleSize={data.totalTrades}
                  formatValue={formatMoney.format}
                />
              </TabsContent>
              <TabsContent value="returns">
                <HistogramChart
                  data={data.returnDistribution}
                  metric="Return distribution"
                  scope={`${currency} closed trades · 30 days`}
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
              <TableCaption>{currency} strategy results · preview sample · insufficient-data labels follow with real queries.</TableCaption>
            </Table>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <CardHeader>
            <div>
              <CardTitle>Recent trades</CardTitle>
              <CardDescription>Latest closed positions in the {currency} preview</CardDescription>
            </div>
            <Clock3 className="size-5 text-muted" aria-hidden="true" />
          </CardHeader>
          <CardContent className="space-y-2">
            {data.trades.map((trade) => (
              <div key={trade.symbol} className="grid min-h-16 grid-cols-[1fr_auto] items-center gap-3 rounded-md border border-line px-3 py-2 sm:grid-cols-[1fr_auto_auto_auto]">
                <div>
                  <p className="font-semibold text-ink">{trade.symbol}</p>
                  <p className="mt-0.5 text-xs text-muted">{trade.when}</p>
                </div>
                <Chip tone="neutral" className="hidden sm:inline-flex">{trade.side}</Chip>
                <span className={cn("tnum text-right text-sm font-semibold", trade.result >= 0 ? "text-profit" : "text-loss")}>
                  {trade.result >= 0 ? "+" : ""}{formatMoney.format(trade.result)}
                </span>
                <span className={cn("tnum hidden w-16 text-right text-sm sm:block", trade.r >= 0 ? "text-profit" : "text-loss")}>
                  {trade.r >= 0 ? "+" : ""}{trade.r.toFixed(1)}R
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="xl:col-span-5">
          <CardHeader>
            <div>
              <CardTitle>June activity</CardTitle>
              <CardDescription>Daily closed P&amp;L · {currency} · preview</CardDescription>
            </div>
            <CalendarClock className="size-5 text-muted" aria-hidden="true" />
          </CardHeader>
          <CardContent>
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
                    aria-label={result == null ? `June ${day}: no trades` : `June ${day}: ${formatMoney.format(result)} closed P&L in ${currency}`}
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
