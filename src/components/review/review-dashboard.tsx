"use client";

import * as React from "react";
import { ArrowUpRight, CheckCircle2, ClipboardCheck, Plus, RotateCcw, Sparkles } from "lucide-react";
import Link from "next/link";

import { BarChart } from "@/components/charts/bar-chart";
import { HeatmapChart, type HeatmapDatum } from "@/components/charts/heatmap-chart";
import { ScopeControls } from "@/components/dashboard/scope-controls";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { EvidenceStat, ReviewAnalytics, ReviewInsight } from "@/lib/domain/review-analytics";
import type { Currency } from "@/lib/domain/types";
import type { ReviewAnalyticsMap } from "@/lib/review-data";
import { reviewComparisonLabel } from "@/lib/review-data";
import type { DashboardScope } from "@/lib/trade-scope";
import { dateKeyInTimeZone, DEFAULT_TIME_ZONE } from "@/lib/date-time";
import { cn } from "@/lib/utils";

const MIN_SAMPLE = 3;

function moneyFormatter(currency: Currency) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: currency === "INR" ? 0 : 2 });
}

function pct(value: number | null) {
  return value == null ? "—" : `${value.toFixed(1)}%`;
}

function Kpi({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <Card className="min-w-0">
      <CardContent className="p-4 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">{label}</p>
        <p className="tnum mt-2 truncate font-serif text-2xl font-medium tracking-[-0.03em] text-ink sm:text-3xl">{value}</p>
        <p className="mt-2 text-xs leading-relaxed text-muted">{detail}</p>
      </CardContent>
    </Card>
  );
}

function EvidenceLinks({ ids }: { ids: string[] }) {
  const unique = [...new Set(ids)].slice(0, 3);
  if (!unique.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2" aria-label="Supporting trades">
      {unique.map((id, index) => (
        <Link key={id} href={`/trades/${id}`} className="inline-flex min-h-11 items-center gap-1 rounded-sm px-2 text-xs font-semibold text-accent underline-offset-4 hover:underline focus-visible:underline">
          Trade {index + 1}<ArrowUpRight className="size-3.5" aria-hidden="true" />
        </Link>
      ))}
    </div>
  );
}

function ComplianceStat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-md border border-line bg-page p-3">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{label}</dt>
      <dd className="tnum mt-1 text-lg font-semibold text-ink">{value}</dd>
      <dd className="mt-1 text-xs leading-relaxed text-muted">{detail}</dd>
    </div>
  );
}

function ImpactRow({ stat, currency }: { stat: EvidenceStat; currency: Currency }) {
  const money = moneyFormatter(currency);
  return (
    <div className="rounded-md border border-line bg-page p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold text-ink">{stat.name}</p>
        <Chip tone={stat.name === "Compliant" ? "accent" : "neutral"}>{stat.count} trades</Chip>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div><dt className="text-muted">Net P&amp;L</dt><dd className={cn("tnum mt-1 font-semibold", stat.pnl >= 0 ? "text-profit" : "text-loss")}>{money.format(stat.pnl)}</dd></div>
        <div><dt className="text-muted">Win rate</dt><dd className="tnum mt-1 font-semibold text-ink">{stat.winPct.toFixed(1)}%</dd></div>
        <div><dt className="text-muted">Expectancy</dt><dd className={cn("tnum mt-1 font-semibold", stat.expectancy >= 0 ? "text-profit" : "text-loss")}>{money.format(stat.expectancy)}</dd></div>
      </dl>
      <EvidenceLinks ids={stat.tradeIds} />
    </div>
  );
}

function InsightCard({ insight, currency }: { insight: ReviewInsight; currency: Currency }) {
  const border = insight.tone === "warning" ? "border-l-warn" : insight.tone === "positive" ? "border-l-profit" : "border-l-accent";
  return (
    <article className={cn("rounded-lg border border-line border-l-4 bg-raised p-5", border)}>
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden="true" />
        <div className="min-w-0">
          <h3 className="font-serif text-xl text-ink">{insight.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-body">{insight.evidence}</p>
          <p className="mt-2 text-xs leading-relaxed text-muted">{insight.consequence} Money figures are {currency}-only.</p>
          <EvidenceLinks ids={insight.tradeIds} />
        </div>
      </div>
    </article>
  );
}

function EvidenceTable({ rows, currency, empty }: { rows: EvidenceStat[]; currency: Currency; empty: string }) {
  const money = moneyFormatter(currency);
  if (!rows.length) return <p className="py-6 text-sm text-faint">{empty}</p>;
  return (
    <Table className="table-fixed">
      <TableHeader><TableRow><TableHead className="w-[36%] px-2">Group</TableHead><TableHead className="w-[16%] px-2 text-right">n</TableHead><TableHead className="w-[21%] px-2 text-right">Win %</TableHead><TableHead className="w-[27%] px-2 text-right">Expectancy</TableHead></TableRow></TableHeader>
      <TableBody>
        {rows.slice(0, 8).map((row) => (
          <TableRow key={row.name}>
            <TableCell className="px-2 align-top">
              <p className="truncate font-semibold text-ink">{row.name}</p>
              <p className="mt-0.5 text-[10px] text-muted">{row.count >= MIN_SAMPLE ? "Descriptive sample" : "Exploratory · n<3"}</p>
              <EvidenceLinks ids={row.tradeIds.slice(0, 1)} />
            </TableCell>
            <TableCell className="tnum px-2 text-right">{row.count}</TableCell>
            <TableCell className="tnum px-2 text-right">{row.winPct.toFixed(0)}%</TableCell>
            <TableCell className={cn("tnum px-2 text-right font-semibold", row.expectancy >= 0 ? "text-profit" : "text-loss")}>{money.format(row.expectancy)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableCaption>{currency} · results are descriptive; groups below three trades are labelled exploratory.</TableCaption>
    </Table>
  );
}

function buildHeatmap(data: ReviewAnalytics["dailyOutcomes"], nowIso: string, timeZone: string) {
  const now = new Date(`${dateKeyInTimeZone(new Date(nowIso), timeZone)}T00:00:00Z`);
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(end.getTime() - 41 * 86_400_000);
  const dayNames = Array.from({ length: 7 }, (_, index) => new Date(start.getTime() + index * 86_400_000).toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" }));
  const rows = Array.from({ length: 6 }, (_, index) => `W${index + 1}`);
  const outcomes = new Map(data.map((day) => [day.date, day]));
  const cells: HeatmapDatum[] = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start.getTime() + index * 86_400_000);
    const key = date.toISOString().slice(0, 10);
    const outcome = outcomes.get(key);
    return {
      row: rows[Math.floor(index / 7)],
      column: dayNames[index % 7],
      label: date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }),
      value: outcome?.pnl ?? null,
    };
  });
  return { cells, rows, columns: dayNames, start, end };
}

function ReviewBody({ data, currency, scope, nowIso, timeZone }: { data: ReviewAnalytics; currency: Currency; scope: DashboardScope; nowIso: string; timeZone: string }) {
  const money = moneyFormatter(currency);
  const heatmap = buildHeatmap(data.dailyOutcomes, nowIso, timeZone);
  const comparison = data.periodComparison;
  const weekday = data.weekdayStats.map((row) => ({ label: row.name, value: row.pnl }));

  return (
    <div className="space-y-6 lg:space-y-8">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4" aria-label={`${currency} review indicators`}>
        <Kpi label="Pending reviews" value={String(data.pendingReviewCount)} detail={`${data.totalClosed} closed ${currency} trades in scope`} />
        <Kpi label="Discipline score" value={pct(data.disciplineScore)} detail="Average of execution score and rule-follow rate when recorded" />
        <Kpi label="Avg execution" value={data.avgExecutionScore == null ? "—" : `${data.avgExecutionScore.toFixed(2)}/5`} detail={`${data.reviewedCount} reviewed trades`} />
        <Kpi label="Rule-follow rate" value={pct(data.ruleFollowRate)} detail="Reviewed trades with no recorded rule violation" />
      </section>

      <section className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <CardHeader><div><CardTitle>Rule compliance</CardTitle><CardDescription>Planning and review completeness · {currency} · selected scope</CardDescription></div><Chip tone="accent">{data.reviewedCount} reviewed</Chip></CardHeader>
          <CardContent><dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <ComplianceStat label="Checklist" value={pct(data.checklistCompletionRate)} detail="Completed ÷ available checklist items on reviewed trades" />
            <ComplianceStat label="Stop discipline" value={pct(data.stopCoverage)} detail="Closed trades with an initial stop recorded" />
            <ComplianceStat label="Target coverage" value={pct(data.targetCoverage)} detail="Closed trades with a planned target recorded" />
            <ComplianceStat label="Target-R capture" value={pct(data.targetCaptureRate)} detail="Average realized R ÷ planned R; negative outcomes stay negative" />
          </dl></CardContent>
        </Card>
        <Card className="xl:col-span-5">
          <CardHeader><div><CardTitle>Compliance impact</CardTitle><CardDescription>Reviewed trades only · association, not causation</CardDescription></div></CardHeader>
          <CardContent className="space-y-3">
            <ImpactRow stat={data.compliance.compliant} currency={currency} />
            <ImpactRow stat={data.compliance.violated} currency={currency} />
            <p className="rounded-md bg-sidebar px-3 py-2 text-xs leading-relaxed text-muted">
              Expectancy delta: <strong className="tnum text-ink">{data.compliance.expectancyDelta == null ? "needs both samples" : money.format(data.compliance.expectancyDelta)}</strong> · Win-rate delta: <strong className="tnum text-ink">{data.compliance.winRateDelta == null ? "—" : `${data.compliance.winRateDelta >= 0 ? "+" : ""}${data.compliance.winRateDelta.toFixed(1)} pp`}</strong>
            </p>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="trading-insights-heading">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div><h2 id="trading-insights-heading" className="font-serif text-2xl text-ink">Trading insights</h2><p className="text-sm text-muted">Transparent rules, measured consequences, and supporting trades.</p></div>
          <Chip>In this sample</Chip>
        </div>
        {data.insights.length ? <div className="grid gap-4 lg:grid-cols-2">{data.insights.map((insight) => <InsightCard key={insight.title} insight={insight} currency={currency} />)}</div> : (
          <Card><CardContent className="py-10 text-center"><h3 className="font-serif text-xl text-ink">Not enough repeated evidence yet.</h3><p className="mt-2 text-sm text-muted">Insights appear after a behavior or setup has enough supporting trades. No confidence percentage is fabricated.</p></CardContent></Card>
        )}
      </section>

      <section className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-5">
          <CardHeader><div><CardTitle>Journaling impact</CardTitle><CardDescription>Trades with notes or a linked journal entry versus trades without</CardDescription></div></CardHeader>
          <CardContent className="space-y-3">
            <ImpactRow stat={data.journaling.withJournal} currency={currency} />
            <ImpactRow stat={data.journaling.withoutJournal} currency={currency} />
            <p className="text-xs leading-relaxed text-muted">Expectancy difference: <strong className="tnum text-ink">{data.journaling.expectancyDelta == null ? "needs both samples" : money.format(data.journaling.expectancyDelta)}</strong>. Notes may be written after a result, so this is descriptive rather than causal.</p>
          </CardContent>
        </Card>
        <Card className="xl:col-span-7">
          <CardHeader><div><CardTitle>Behavior breakdowns</CardTitle><CardDescription>Ranked evidence · {currency} · min-sample labels stay visible</CardDescription></div></CardHeader>
          <CardContent>
            <Tabs defaultValue="setup">
              <TabsList aria-label="Behavior breakdown" className="w-full overflow-x-auto sm:w-auto">
                <TabsTrigger value="setup" className="flex-1 sm:flex-none">Setup</TabsTrigger>
                <TabsTrigger value="mistake" className="flex-1 sm:flex-none">Mistake</TabsTrigger>
                <TabsTrigger value="emotion" className="flex-1 sm:flex-none">Emotion</TabsTrigger>
                <TabsTrigger value="close" className="flex-1 sm:flex-none">Close reason</TabsTrigger>
              </TabsList>
              <TabsContent value="setup"><EvidenceTable rows={data.setupStats} currency={currency} empty="No setup evidence in this scope." /></TabsContent>
              <TabsContent value="emotion"><EvidenceTable rows={data.emotionStats} currency={currency} empty="No emotion evidence in this scope." /></TabsContent>
              <TabsContent value="close"><EvidenceTable rows={data.closeReasonStats} currency={currency} empty="No close-reason evidence in this scope." /></TabsContent>
              <TabsContent value="mistake">
                {data.mistakeCostByTag.length ? <div className="space-y-2 pt-2">{data.mistakeCostByTag.slice(0, 8).map((row) => (
                  <div key={row.tag} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-page p-3">
                    <div><p className="font-semibold text-ink">{row.tag}</p><p className="text-xs text-muted">{row.count} losing trade{row.count === 1 ? "" : "s"} · tagged loss is counted for each attached tag</p><EvidenceLinks ids={row.tradeIds} /></div>
                    <p className="tnum text-sm font-semibold text-loss">{money.format(row.cost)}</p>
                  </div>
                ))}</div> : <p className="py-6 text-sm text-faint">No tagged losing trades in this scope.</p>}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <CardHeader><div><CardTitle>Day-of-week behavior</CardTitle><CardDescription>Net P&amp;L by exit day · {currency}</CardDescription></div></CardHeader>
          <CardContent>{weekday.length ? <BarChart data={weekday} metric="Review P&L by weekday" unit={currency} scope={`${currency} closed trades · selected scope`} sampleSize={data.totalClosed} formatValue={money.format} /> : <p className="py-8 text-sm text-faint">No closed trades in this scope.</p>}</CardContent>
        </Card>
        <Card className="xl:col-span-5">
          <CardHeader><div><CardTitle>Period comparison</CardTitle><CardDescription>{reviewComparisonLabel(scope)} · {currency}</CardDescription></div></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {[{ label: "Current", sample: comparison.current }, { label: "Previous", sample: comparison.previous }].map(({ label, sample }) => (
                <div key={label} className="rounded-md border border-line bg-page p-4"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{label}</p><p className={cn("tnum mt-2 font-serif text-2xl", sample.pnl >= 0 ? "text-profit" : "text-loss")}>{money.format(sample.pnl)}</p><p className="mt-1 text-xs text-muted">{sample.count} trades · {sample.winPct.toFixed(0)}% win · {pct(sample.ruleFollowRate)} rule-follow</p></div>
              ))}
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 rounded-md bg-sidebar p-3 text-xs"><div><dt className="text-muted">P&amp;L Δ</dt><dd className="tnum mt-1 font-semibold text-ink">{money.format(comparison.pnlDelta)}</dd></div><div><dt className="text-muted">Win-rate Δ</dt><dd className="tnum mt-1 font-semibold text-ink">{comparison.winRateDelta >= 0 ? "+" : ""}{comparison.winRateDelta.toFixed(1)} pp</dd></div><div><dt className="text-muted">Rules Δ</dt><dd className="tnum mt-1 font-semibold text-ink">{comparison.ruleFollowRateDelta == null ? "—" : `${comparison.ruleFollowRateDelta >= 0 ? "+" : ""}${comparison.ruleFollowRateDelta.toFixed(1)} pp`}</dd></div></dl>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardHeader><div><CardTitle>42-day outcome map</CardTitle><CardDescription>{heatmap.start.toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "UTC" })}–{heatmap.end.toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "UTC" })} · exit-date outcomes · {currency}</CardDescription></div></CardHeader>
          <CardContent><HeatmapChart data={heatmap.cells} rows={heatmap.rows} columns={heatmap.columns} metric="42-day review outcome" unit={currency} scope={`${currency} closed trades`} sampleSize={data.totalClosed} formatValue={money.format} /></CardContent>
        </Card>
        <Card className="xl:col-span-4">
          <CardHeader><div><CardTitle>One concrete adjustment</CardTitle><CardDescription>Highest-priority next step from transparent rules</CardDescription></div></CardHeader>
          <CardContent><div className="rounded-lg border border-line-strong bg-accent-soft p-5"><CheckCircle2 className="size-6 text-accent" aria-hidden="true" /><p className="mt-3 font-serif text-xl leading-snug text-ink">{data.adjustment}</p></div>{data.pendingReviewCount ? <Button asChild className="mt-4 w-full"><a href="#review-queue"><ClipboardCheck aria-hidden="true" />Open review queue</a></Button> : null}</CardContent>
        </Card>
      </section>

      <Card id="review-queue" className="scroll-mt-24">
        <CardHeader><div><CardTitle>Trades waiting for review</CardTitle><CardDescription>Closed, unreviewed {currency} trades · newest outcome first</CardDescription></div><Chip tone={data.pendingReviewCount ? "accent" : "neutral"}>{data.pendingReviewCount} pending</Chip></CardHeader>
        <CardContent>
          {!data.reviewQueue.length ? <div className="py-10 text-center"><ClipboardCheck className="mx-auto size-7 text-accent" aria-hidden="true" /><h3 className="mt-3 font-serif text-xl text-ink">Review queue clear.</h3><p className="mt-1 text-sm text-muted">Closed trades in this scope have completed reviews.</p></div> : <>
            <div className="hidden sm:block"><Table><TableHeader><TableRow><TableHead>Trade</TableHead><TableHead>Side</TableHead><TableHead>Exit</TableHead><TableHead className="text-right">P&amp;L</TableHead><TableHead className="text-right">R</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader><TableBody>{data.reviewQueue.map((trade) => <TableRow key={trade.id}><TableCell className="font-semibold text-ink">{trade.symbol}</TableCell><TableCell>{trade.direction}</TableCell><TableCell>{new Date(trade.exitedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })}</TableCell><TableCell className={cn("tnum text-right font-semibold", trade.pnl >= 0 ? "text-profit" : "text-loss")}>{money.format(trade.pnl)}</TableCell><TableCell className="tnum text-right">{trade.realizedR == null ? "—" : `${trade.realizedR >= 0 ? "+" : ""}${trade.realizedR.toFixed(2)}R`}</TableCell><TableCell className="text-right"><Button asChild variant="outline" size="compact"><Link href={`/trades/${trade.id}?mode=review`}>Review<ArrowUpRight aria-hidden="true" /></Link></Button></TableCell></TableRow>)}</TableBody><TableCaption>{currency}-only queue · review opens the dedicated Trade Detail canvas.</TableCaption></Table></div>
            <div className="grid gap-3 sm:hidden">{data.reviewQueue.map((trade) => <article key={trade.id} className="rounded-md border border-line bg-page p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-ink">{trade.symbol}</h3><p className="text-xs text-muted">{trade.direction} · {new Date(trade.exitedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "UTC" })}</p></div><p className={cn("tnum text-sm font-semibold", trade.pnl >= 0 ? "text-profit" : "text-loss")}>{money.format(trade.pnl)}</p></div><Button asChild variant="outline" className="mt-3 w-full"><Link href={`/trades/${trade.id}?mode=review`}>Review trade<ArrowUpRight aria-hidden="true" /></Link></Button></article>)}</div>
          </>}
        </CardContent>
      </Card>
    </div>
  );
}

export function ReviewDashboard({ analyticsByCurrency, currency, scope, nowIso, timeZone = DEFAULT_TIME_ZONE }: { analyticsByCurrency: ReviewAnalyticsMap; currency: Currency; scope: DashboardScope; nowIso: string; timeZone?: string }) {
  const data = analyticsByCurrency[currency];
  const scopeActive = scope.period !== "all" || scope.asset !== "Overall";

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader eyebrow={<><Chip tone="accent">Review loop</Chip><Chip>{data.pendingReviewCount} pending · {currency}</Chip></>} title="Review Center" description="Which behaviors help or hurt? Evidence stays currency-separated, sample-labelled, and linked back to the trades behind it." actions={<>{scopeActive ? <Button asChild variant="outline" size="compact"><Link href="/review"><RotateCcw aria-hidden="true" />Reset scope</Link></Button> : null}<Button asChild size="compact"><Link href="/trades/new"><Plus aria-hidden="true" />Add trade</Link></Button></>} />
      <ScopeControls basePath="/review" scope={scope} currency={currency} timeZone={timeZone} />
      <ReviewBody key={currency} data={data} currency={currency} scope={scope} nowIso={nowIso} timeZone={timeZone} />
    </div>
  );
}
