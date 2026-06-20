"use client";

import * as React from "react";
import { ArrowDownRight, ArrowUpRight, CalendarCheck2, ChevronLeft, ChevronRight, Clock3, Plus } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { ScopeField, ScopeToolbar } from "@/components/layout/scope-toolbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CalendarAnalytics, CalendarDay } from "@/lib/domain/calendar";
import type { Currency } from "@/lib/domain/types";
import type { CalendarDataByAsset } from "@/lib/calendar-data";
import { dateKeyInTimeZone, DEFAULT_TIME_ZONE, formatDateInTimeZone } from "@/lib/date-time";
import { ASSET_OPTIONS, type ScopeAsset } from "@/lib/trade-scope";
import { cn } from "@/lib/utils";

export type CalendarMode = "recent" | "month" | "year" | "custom";

const DAY_MS = 86_400_000;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function utcDate(key: string) {
  return new Date(`${key}T00:00:00Z`);
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, amount: number) {
  return new Date(date.getTime() + amount * DAY_MS);
}

function monthKey(date: Date) {
  return date.toISOString().slice(0, 7);
}

function monthStart(key: string) {
  return new Date(`${key}-01T00:00:00Z`);
}

function shiftMonth(key: string, amount: number) {
  const date = monthStart(key);
  return monthKey(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1)));
}

function monthLabel(key: string) {
  return monthStart(key).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
}

function longDate(key: string) {
  return utcDate(key).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

function moneyFormatter(currency: Currency) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: currency === "INR" ? 0 : 2 });
}

function compactMoney(currency: Currency, amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 }).format(amount);
}

function dayMap(data: CalendarAnalytics) {
  return new Map(data.days.map((day) => [day.date, day]));
}

function rangeFor(mode: CalendarMode, now: Date, month: string, year: number, customFrom?: string, customTo?: string) {
  if (mode === "recent") {
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    return { start: addDays(end, -41), end };
  }
  if (mode === "month") {
    const start = monthStart(month);
    return { start, end: new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)) };
  }
  if (mode === "custom") {
    const start = customFrom ? utcDate(customFrom) : now;
    const end = customTo ? utcDate(customTo) : now;
    return start <= end ? { start, end } : { start: now, end: now };
  }
  return { start: new Date(Date.UTC(year, 0, 1)), end: new Date(Date.UTC(year, 11, 31)) };
}

function latestActivity(data: CalendarAnalytics, start: Date, end: Date) {
  return [...data.days].reverse().find((day) => {
    const date = utcDate(day.date);
    return date >= start && date <= end;
  })?.date ?? dateKey(start);
}

function summarize(data: CalendarAnalytics, start: Date, end: Date) {
  const days = data.days.filter((day) => {
    const date = utcDate(day.date);
    return date >= start && date <= end;
  });
  return {
    days,
    tradingDays: days.filter((day) => day.count > 0).length,
    pnl: days.reduce((sum, day) => sum + (day.pnl ?? 0), 0),
    wins: days.reduce((sum, day) => sum + day.wins, 0),
    losses: days.reduce((sum, day) => sum + day.losses, 0),
    reviews: days.reduce((sum, day) => sum + day.reviewCount, 0),
  };
}

function cellTone(day: CalendarDay | undefined, selected: boolean) {
  return cn(
    "border-line bg-raised text-muted hover:border-line-strong hover:bg-hover",
    day?.pnl != null && day.pnl > 0 && "border-profit/25 bg-profit/10 text-profit",
    day?.pnl != null && day.pnl < 0 && "border-loss/25 bg-loss/10 text-loss",
    day?.pnl === 0 && day.count > 0 && "border-line-strong bg-sidebar text-ink",
    day?.pnl == null && day?.reviewCount && "border-line-strong bg-accent-soft text-ink",
    selected && "ring-2 ring-accent ring-offset-2 ring-offset-page",
  );
}

function dayLabel(key: string, day: CalendarDay | undefined, currency: Currency) {
  const money = moneyFormatter(currency);
  if (!day) return `${longDate(key)}: no trades or reviews`;
  const outcome = day.pnl == null ? "no trade outcome" : `${money.format(day.pnl)} net P&L from ${day.count} trade${day.count === 1 ? "" : "s"}`;
  return `${longDate(key)}: ${outcome}; ${day.reviewCount} review${day.reviewCount === 1 ? "" : "s"}`;
}

function DayButton({ date, day, currency, selected, compact = false, onSelect }: { date: string; day?: CalendarDay; currency: Currency; selected: boolean; compact?: boolean; onSelect: (date: string) => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={dayLabel(date, day, currency)}
      onClick={() => onSelect(date)}
      className={cn(
        "tnum relative flex min-h-11 min-w-11 flex-col items-center justify-center rounded-sm border px-1 py-1 text-xs transition-colors",
        cellTone(day, selected),
      )}
    >
      <span className="font-semibold">{utcDate(date).getUTCDate()}</span>
      {!compact && day?.pnl != null ? <span className="max-w-full truncate text-[9px] font-semibold">{compactMoney(currency, day.pnl)}</span> : null}
      {!compact && day?.count ? <span className="text-[8px] opacity-80">{day.count} trade{day.count === 1 ? "" : "s"}</span> : null}
      {day?.reviewCount ? <span className="absolute right-1 top-1 size-1.5 rounded-full bg-accent" aria-hidden="true" /> : null}
    </button>
  );
}

function CalendarLegend() {
  return (
    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-muted" aria-label="Calendar intensity legend">
      <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-loss/70" aria-hidden="true" /> Loss</span>
      <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm border border-line-strong bg-sidebar" aria-hidden="true" /> Flat</span>
      <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm border border-line bg-raised" aria-hidden="true" /> No trade</span>
      <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-profit/70" aria-hidden="true" /> Profit</span>
      <span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-full bg-accent" aria-hidden="true" /> Review completed</span>
    </div>
  );
}

function ActivityList({ days, currency, selected, onSelect }: { days: CalendarDay[]; currency: Currency; selected: string; onSelect: (date: string) => void }) {
  const money = moneyFormatter(currency);
  return (
    <details className="mt-4 rounded-md border border-line bg-page">
      <summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm font-semibold text-ink">List days with activity</summary>
      <div className="grid gap-2 border-t border-line p-3 sm:grid-cols-2">
        {days.length ? [...days].reverse().map((day) => (
          <button type="button" key={day.date} onClick={() => onSelect(day.date)} aria-pressed={selected === day.date} className={cn("flex min-h-11 items-center justify-between gap-3 rounded-sm border border-line px-3 text-left text-sm hover:border-line-strong hover:bg-hover", selected === day.date && "border-line-strong bg-accent-soft")}>
            <span><span className="block font-semibold text-ink">{longDate(day.date)}</span><span className="text-xs text-muted">{day.count} trades · {day.reviewCount} reviews</span></span>
            <span className={cn("tnum shrink-0 font-semibold", (day.pnl ?? 0) >= 0 ? "text-profit" : "text-loss")}>{day.pnl == null ? "—" : money.format(day.pnl)}</span>
          </button>
        )) : <p className="text-sm text-faint">No activity in this range.</p>}
      </div>
    </details>
  );
}

function SummaryBand({ data, currency, start, end }: { data: CalendarAnalytics; currency: Currency; start: Date; end: Date }) {
  const summary = summarize(data, start, end);
  const money = moneyFormatter(currency);
  return (
    <dl className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
      {[
        ["Trading days", String(summary.tradingDays)],
        ["Net P&L", money.format(summary.pnl)],
        ["Wins", String(summary.wins)],
        ["Losses", String(summary.losses)],
        ["Reviews", String(summary.reviews)],
      ].map(([label, value]) => <div key={label} className="rounded-md border border-line bg-page p-3"><dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">{label}</dt><dd className="tnum mt-1 font-semibold text-ink">{value}</dd></div>)}
    </dl>
  );
}

function DayActivity({ date, day, currency, timeZone }: { date: string; day?: CalendarDay; currency: Currency; timeZone: string }) {
  const money = moneyFormatter(currency);
  return (
    <Card className="h-fit xl:sticky xl:top-24">
      <CardHeader><div><CardTitle>Day activity</CardTitle><CardDescription>{longDate(date)} · {currency}</CardDescription></div><CalendarCheck2 className="size-5 text-accent" aria-hidden="true" /></CardHeader>
      <CardContent>
        {!day ? <div className="py-8 text-center"><p className="font-serif text-xl text-ink">No activity.</p><p className="mt-1 text-sm text-muted">No trades exited or reviews were completed on this day.</p></div> : <>
          <dl className="grid grid-cols-3 gap-2">
            <div className="rounded-md bg-sidebar p-3"><dt className="text-[10px] uppercase tracking-wider text-muted">Net P&amp;L</dt><dd className={cn("tnum mt-1 font-semibold", (day.pnl ?? 0) >= 0 ? "text-profit" : "text-loss")}>{day.pnl == null ? "—" : money.format(day.pnl)}</dd></div>
            <div className="rounded-md bg-sidebar p-3"><dt className="text-[10px] uppercase tracking-wider text-muted">W / L</dt><dd className="tnum mt-1 font-semibold text-ink">{day.wins} / {day.losses}</dd></div>
            <div className="rounded-md bg-sidebar p-3"><dt className="text-[10px] uppercase tracking-wider text-muted">Reviews</dt><dd className="tnum mt-1 font-semibold text-ink">{day.reviewCount}</dd></div>
          </dl>
          <div className="mt-4 space-y-3">
            {day.trades.map((trade) => (
              <Link key={trade.id} href={`/trades/${trade.id}`} aria-label={`View ${trade.symbol} trade detail`} className="block rounded-md border border-line p-3 transition-colors hover:border-line-strong hover:bg-hover">
                <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-2">{trade.direction === "Long" ? <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-profit" aria-hidden="true" /> : <ArrowDownRight className="mt-0.5 size-4 shrink-0 text-loss" aria-hidden="true" />}<div className="min-w-0"><p className="truncate font-semibold text-ink">{trade.symbol}</p><p className="text-xs text-muted">{trade.direction} · {trade.quantity} @ {trade.entryPrice.toLocaleString("en-IN")}</p></div></div><p className={cn("tnum shrink-0 text-sm font-semibold", trade.pnl >= 0 ? "text-profit" : "text-loss")}>{money.format(trade.pnl)}</p></div>
                <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted"><span>Entered {formatDateInTimeZone(trade.entryAt, timeZone, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span><span className="tnum">{trade.realizedR == null ? "R —" : `${trade.realizedR >= 0 ? "+" : ""}${trade.realizedR.toFixed(2)}R`}</span></div>
              </Link>
            ))}
            {!day.trades.length ? <p className="rounded-md border border-dashed border-line p-4 text-sm text-muted">No trades exited on this day.</p> : null}
          </div>
          {day.reviewedTradeIds.length ? <div className="mt-4 border-t border-line pt-4"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Reviews completed</p><div className="mt-2 flex flex-wrap gap-2">{day.reviewedTradeIds.slice(0, 6).map((id, index) => <Button key={id} asChild variant="ghost" size="compact"><Link href={`/trades/${id}?mode=review`}>Review {index + 1}<ArrowUpRight aria-hidden="true" /></Link></Button>)}</div></div> : null}
        </>}
      </CardContent>
    </Card>
  );
}

function MonthGrid({ data, currency, month, selected, onSelect }: { data: CalendarAnalytics; currency: Currency; month: string; selected: string; onSelect: (date: string) => void }) {
  const first = monthStart(month);
  const mondayOffset = (first.getUTCDay() + 6) % 7;
  const gridStart = addDays(first, -mondayOffset);
  const map = dayMap(data);
  const dates = Array.from({ length: 42 }, (_, index) => dateKey(addDays(gridStart, index)));
  const range = rangeFor("month", first, month, first.getUTCFullYear());
  const activity = summarize(data, range.start, range.end).days;
  return <>
    <SummaryBand data={data} currency={currency} start={range.start} end={range.end} />
    <div className="overflow-x-auto pb-2"><div className="min-w-[36rem]"><div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wider text-faint">{WEEKDAYS.map((day) => <span key={day}>{day}</span>)}</div><div className="grid grid-cols-7 gap-1.5">{dates.map((date) => date.startsWith(month) ? <DayButton key={date} date={date} day={map.get(date)} currency={currency} selected={selected === date} onSelect={onSelect} /> : <span key={date} className="min-h-11 rounded-sm bg-sidebar/40" aria-hidden="true" />)}</div></div></div>
    <CalendarLegend /><ActivityList days={activity} currency={currency} selected={selected} onSelect={onSelect} />
  </>;
}

function RecentGrid({ data, currency, now, selected, onSelect }: { data: CalendarAnalytics; currency: Currency; now: Date; selected: string; onSelect: (date: string) => void }) {
  const range = rangeFor("recent", now, monthKey(now), now.getUTCFullYear());
  const dates = Array.from({ length: 42 }, (_, index) => dateKey(addDays(range.start, index)));
  const columns = dates.slice(0, 7).map((date) => utcDate(date).toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" }));
  const map = dayMap(data);
  const activity = summarize(data, range.start, range.end).days;
  return <>
    <SummaryBand data={data} currency={currency} start={range.start} end={range.end} />
    <div className="overflow-x-auto pb-2"><div className="min-w-[36rem]"><div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wider text-faint">{columns.map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div><div className="grid grid-cols-7 gap-1.5">{dates.map((date) => <DayButton key={date} date={date} day={map.get(date)} currency={currency} selected={selected === date} onSelect={onSelect} />)}</div></div></div>
    <CalendarLegend /><ActivityList days={activity} currency={currency} selected={selected} onSelect={onSelect} />
  </>;
}

function CustomGrid({ data, currency, start, end, selected, onSelect }: { data: CalendarAnalytics; currency: Currency; start: Date; end: Date; selected: string; onSelect: (date: string) => void }) {
  const count = Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1);
  const dates = Array.from({ length: count }, (_, index) => dateKey(addDays(start, index)));
  const columns = dates.slice(0, Math.min(7, dates.length)).map((date) => utcDate(date).toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" }));
  const map = dayMap(data);
  const activity = summarize(data, start, end).days;
  return <>
    <SummaryBand data={data} currency={currency} start={start} end={end} />
    <div className="overflow-x-auto pb-2"><div className="min-w-[36rem]"><div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wider text-faint">{columns.map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div><div className="grid grid-cols-7 gap-1.5">{dates.map((date) => <DayButton key={date} date={date} day={map.get(date)} currency={currency} selected={selected === date} onSelect={onSelect} />)}</div></div></div>
    <CalendarLegend /><ActivityList days={activity} currency={currency} selected={selected} onSelect={onSelect} />
  </>;
}

function YearGrid({ data, currency, year, selected, onSelect }: { data: CalendarAnalytics; currency: Currency; year: number; selected: string; onSelect: (date: string) => void }) {
  const map = dayMap(data);
  const range = rangeFor("year", new Date(), `${year}-01`, year);
  const activity = summarize(data, range.start, range.end).days;
  return <>
    <SummaryBand data={data} currency={currency} start={range.start} end={range.end} />
    <div className="grid min-w-0 gap-3 lg:grid-cols-2 2xl:grid-cols-3">{Array.from({ length: 12 }, (_, monthIndex) => {
      const first = new Date(Date.UTC(year, monthIndex, 1));
      const key = monthKey(first);
      const offset = (first.getUTCDay() + 6) % 7;
      const start = addDays(first, -offset);
      const dates = Array.from({ length: 42 }, (_, index) => dateKey(addDays(start, index)));
      return <section key={key} className="min-w-0 rounded-md border border-line bg-page p-3" aria-label={`${monthLabel(key)} intensity`}><h3 className="mb-2 font-serif text-lg text-ink">{first.toLocaleDateString("en-IN", { month: "long", timeZone: "UTC" })}</h3><div className="overflow-x-auto pb-1"><div className="min-w-[20rem]"><div className="mb-1 grid grid-cols-7 gap-1 text-center text-[9px] uppercase text-faint">{WEEKDAYS.map((day) => <span key={day}>{day.slice(0, 1)}</span>)}</div><div className="grid grid-cols-7 gap-1">{dates.map((date) => date.startsWith(key) ? <DayButton key={date} date={date} day={map.get(date)} currency={currency} selected={selected === date} compact onSelect={onSelect} /> : <span key={date} className="min-h-11 min-w-11 rounded-sm bg-sidebar/30" aria-hidden="true" />)}</div></div></div></section>;
    })}</div>
    <CalendarLegend /><ActivityList days={activity} currency={currency} selected={selected} onSelect={onSelect} />
  </>;
}

function CalendarScope({ asset, currency, timeZone, onAsset, onCurrency }: { asset: ScopeAsset; currency: Currency; timeZone: string; onAsset: (asset: ScopeAsset) => void; onCurrency: (currency: Currency) => void }) {
  return <ScopeToolbar label="Calendar scope" note={<>Money cells are isolated to <strong className="text-ink">{currency}</strong>. INR and USD are never combined; switching asset or currency recomputes every day. Dates use <strong className="text-ink">{timeZone}</strong>. <Link href="/settings" className="font-semibold text-accent underline-offset-2 hover:underline">Change</Link></>}>
    <ScopeField label="Asset"><Select value={asset} onValueChange={(value) => onAsset(value as ScopeAsset)}><SelectTrigger aria-label="Asset class scope" className="w-full sm:w-44"><SelectValue /></SelectTrigger><SelectContent>{ASSET_OPTIONS.map((option) => <SelectItem value={option} key={option}>{option}</SelectItem>)}</SelectContent></Select></ScopeField>
    <ScopeField label="Currency"><Select value={currency} onValueChange={(value) => onCurrency(value as Currency)}><SelectTrigger aria-label="Currency scope" className="w-full sm:w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="INR">INR</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent></Select></ScopeField>
  </ScopeToolbar>;
}

export function CalendarDashboard({ dataByAsset, nowIso, initialMode = "month", initialMonth, initialYear, initialDay, initialFrom, initialTo, initialAsset = "Overall", initialCurrency = "INR", rangeError, timeZone = DEFAULT_TIME_ZONE }: { dataByAsset: CalendarDataByAsset; nowIso: string; initialMode?: CalendarMode; initialMonth: string; initialYear: number; initialDay?: string; initialFrom?: string; initialTo?: string; initialAsset?: ScopeAsset; initialCurrency?: Currency; rangeError?: string; timeZone?: string }) {
  const now = React.useMemo(() => utcDate(dateKeyInTimeZone(new Date(nowIso), timeZone)), [nowIso, timeZone]);
  const [asset, setAsset] = React.useState<ScopeAsset>(initialAsset);
  const [currency, setCurrency] = React.useState<Currency>(initialCurrency);
  const [mode, setModeState] = React.useState<CalendarMode>(initialMode);
  const [month, setMonth] = React.useState(initialMonth);
  const [year, setYear] = React.useState(initialYear);
  const data = dataByAsset[asset][currency];
  const initialRange = rangeFor(initialMode, now, initialMonth, initialYear, initialFrom, initialTo);
  const [selected, setSelected] = React.useState(() => initialDay && /^\d{4}-\d{2}-\d{2}$/.test(initialDay) ? initialDay : latestActivity(data, initialRange.start, initialRange.end));
  const selectedDay = dayMap(data).get(selected);
  const visibleRange = rangeFor(mode, now, month, year, initialFrom, initialTo);

  const pickFor = React.useCallback((nextData: CalendarAnalytics, nextMode: CalendarMode, nextMonth: string, nextYear: number) => {
    const range = rangeFor(nextMode, now, nextMonth, nextYear, initialFrom, initialTo);
    setSelected(latestActivity(nextData, range.start, range.end));
  }, [initialFrom, initialTo, now]);

  function setMode(nextMode: CalendarMode) {
    setModeState(nextMode);
    pickFor(data, nextMode, month, year);
  }
  function moveMonth(amount: number) {
    const next = shiftMonth(month, amount);
    setMonth(next);
    setYear(monthStart(next).getUTCFullYear());
    pickFor(data, "month", next, monthStart(next).getUTCFullYear());
  }
  function moveYear(amount: number) {
    const next = year + amount;
    setYear(next);
    pickFor(data, "year", month, next);
  }
  function changeAsset(next: ScopeAsset) {
    setAsset(next);
    pickFor(dataByAsset[next][currency], mode, month, year);
  }
  function changeCurrency(next: Currency) {
    setCurrency(next);
    pickFor(dataByAsset[asset][next], mode, month, year);
  }

  return <div className="space-y-6 lg:space-y-8">
    <PageHeader eyebrow={<><Chip tone="accent">Trading calendar</Chip><Chip>{dataByAsset.Overall.INR.totalClosed + dataByAsset.Overall.USD.totalClosed} closed outcomes</Chip></>} title="Calendar" description="When did results and reviews happen? Every money cell stays inside one currency, and a no-trade day is never painted as zero." actions={<Button asChild size="compact"><Link href="/trades/new"><Plus aria-hidden="true" />Add trade</Link></Button>} />
    <CalendarScope asset={asset} currency={currency} timeZone={timeZone} onAsset={changeAsset} onCurrency={changeCurrency} />
    <Card>
      <CardHeader className="flex-col sm:flex-row sm:items-center"><div><CardTitle>Calendar mode</CardTitle><CardDescription>{mode === "recent" || mode === "custom" ? `${longDate(dateKey(visibleRange.start))}–${longDate(dateKey(visibleRange.end))}` : mode === "month" ? monthLabel(month) : String(year)} · exit-date outcomes and actual review dates</CardDescription></div><SegmentedControl type="single" value={mode} onValueChange={(value) => value && setMode(value as CalendarMode)} aria-label="Calendar mode"><SegmentedControlItem value="recent">Recent</SegmentedControlItem><SegmentedControlItem value="month">Month</SegmentedControlItem><SegmentedControlItem value="year">Year</SegmentedControlItem><SegmentedControlItem value="custom">Custom</SegmentedControlItem></SegmentedControl></CardHeader>
      {mode === "custom" ? <CardContent><form action="/calendar" method="get" className="grid gap-3 rounded-md border border-line bg-page p-3 sm:grid-cols-[minmax(8.5rem,1fr)_minmax(8.5rem,1fr)_auto] sm:items-end"><input type="hidden" name="mode" value="custom" /><input type="hidden" name="asset" value={asset} /><input type="hidden" name="currency" value={currency} /><label className="text-xs font-semibold text-muted">From<input type="date" name="from" required defaultValue={initialFrom} className="mt-1 h-11 w-full rounded-md border border-line bg-raised px-3 text-sm text-ink" /></label><label className="text-xs font-semibold text-muted">To<input type="date" name="to" required defaultValue={initialTo} className="mt-1 h-11 w-full rounded-md border border-line bg-raised px-3 text-sm text-ink" /></label><Button type="submit" variant="outline">Apply range</Button></form>{rangeError ? <p role="alert" className="mt-2 text-xs font-semibold text-danger">{rangeError}</p> : null}</CardContent> : null}
    </Card>
    <section className="grid min-w-0 gap-4 xl:grid-cols-12" aria-label={`${mode} calendar and selected day activity`}>
      <Card className="min-w-0 xl:col-span-8 2xl:col-span-9">
        <CardHeader className="flex-row items-center"><div><CardTitle>{mode === "recent" ? "Recent 42 days" : mode === "month" ? monthLabel(month) : mode === "year" ? `${year} intensity` : "Custom date range"}</CardTitle><CardDescription>{currency} · {asset} · selected cell has a teal outline</CardDescription></div>{mode === "month" || mode === "year" ? <div className="flex items-center gap-1"><Button variant="ghost" size="icon" aria-label={mode === "month" ? "Previous month" : "Previous year"} onClick={() => mode === "month" ? moveMonth(-1) : moveYear(-1)}><ChevronLeft aria-hidden="true" /></Button><Button variant="ghost" size="icon" aria-label={mode === "month" ? "Next month" : "Next year"} onClick={() => mode === "month" ? moveMonth(1) : moveYear(1)}><ChevronRight aria-hidden="true" /></Button></div> : <Clock3 className="size-5 text-muted" aria-hidden="true" />}</CardHeader>
        <CardContent>{mode === "recent" ? <RecentGrid data={data} currency={currency} now={now} selected={selected} onSelect={setSelected} /> : mode === "month" ? <MonthGrid data={data} currency={currency} month={month} selected={selected} onSelect={setSelected} /> : mode === "year" ? <YearGrid data={data} currency={currency} year={year} selected={selected} onSelect={setSelected} /> : <CustomGrid data={data} currency={currency} start={visibleRange.start} end={visibleRange.end} selected={selected} onSelect={setSelected} />}</CardContent>
      </Card>
      <div className="min-w-0 xl:col-span-4 2xl:col-span-3"><DayActivity date={selected} day={selectedDay} currency={currency} timeZone={timeZone} /></div>
    </section>
  </div>;
}
