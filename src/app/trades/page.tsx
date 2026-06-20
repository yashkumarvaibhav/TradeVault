import { CheckCheck, ChevronDown, ChevronLeft, ChevronRight, Columns3, Filter, Plus, RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ensureDefaultTradeLibraries, getTradeEntryLibraries } from "@/db/repositories/libraries";
import { createTradeRepository, type TradeQueryOptions } from "@/db/repositories/trades";
import { assetClasses, currencyCodes, instrumentTypes, tradeDirections, tradeStatuses } from "@/db/schema";
import { getDb } from "@/db/server";
import type { Currency } from "@/lib/domain/types";
import { requireWorkspaceSession } from "@/lib/workspace-session";

import { bulkTradeAction } from "./actions";

export const dynamic = "force-dynamic";

type Params = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value ?? "";
const allowed = <T extends readonly string[]>(value: string, values: T) => values.includes(value as T[number]) ? value : "";
const selectClass = "h-11 rounded-md border border-line bg-raised px-3 text-sm text-ink";

function money(currency: Currency, amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: currency === "INR" ? 0 : 2 }).format(amount);
}

function hrefWith(params: URLSearchParams, changes: Record<string, string | number | null>) {
  const next = new URLSearchParams(params);
  for (const [key, value] of Object.entries(changes)) {
    if (value == null || value === "") next.delete(key);
    else next.set(key, String(value));
  }
  return `/trades${next.size ? `?${next}` : ""}`;
}

export default async function TradesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { shellUser, scope, account } = await requireWorkspaceSession();
  const raw = await searchParams;
  const url = new URLSearchParams();
  const transientParams = new Set(["created", "bulk", "changed"]);
  Object.entries(raw).forEach(([key, value]) => { const item = first(value); if (item && !transientParams.has(key)) url.set(key, item); });
  const query: TradeQueryOptions = {
    accountId: account.id,
    page: Number(first(raw.page)) || 1,
    pageSize: Number(first(raw.size)) || 25,
    search: first(raw.q), assetClass: allowed(first(raw.asset), assetClasses), status: allowed(first(raw.status), tradeStatuses),
    result: allowed(first(raw.result), ["win", "loss", "breakeven"] as const) as TradeQueryOptions["result"],
    direction: allowed(first(raw.direction), tradeDirections), currency: allowed(first(raw.currency), currencyCodes),
    instrumentType: allowed(first(raw.instrument), instrumentTypes), emotion: first(raw.emotion),
    symbol: first(raw.symbol), subcategory: first(raw.subcategory), tradingStyle: first(raw.style), platform: first(raw.platform),
    strategyId: first(raw.strategy), playbookId: first(raw.playbook), closeReasonId: first(raw.closeReason),
    dateFrom: /^\d{4}-\d{2}-\d{2}$/.test(first(raw.from)) ? first(raw.from) : "",
    dateTo: /^\d{4}-\d{2}-\d{2}$/.test(first(raw.to)) ? first(raw.to) : "",
    sort: (allowed(first(raw.sort), ["entry-desc", "entry-asc", "pnl-desc", "pnl-asc", "symbol-asc", "r-desc"] as const) || "entry-desc") as TradeQueryOptions["sort"],
  };
  const db = getDb();
  await ensureDefaultTradeLibraries(db, scope);
  const repository = createTradeRepository(db, scope);
  const [result, options, libraries] = await Promise.all([repository.queryPage(query), repository.filterOptions(account.id), getTradeEntryLibraries(db, scope)]);
  const strategyNames = new Map(libraries.strategies.map((item) => [item.id, item.name]));
  const playbookNames = new Map(libraries.playbooks.map((item) => [item.id, item.name]));
  const realized = result.summaryRows.filter((row) => row.realizedPnl != null);
  const closed = realized.length;
  const wins = realized.filter((row) => Number(row.realizedPnl) > 0).length;
  const avgRValues = realized.filter((row) => row.realizedR != null).map((row) => Number(row.realizedR));
  const totals = Object.fromEntries(currencyCodes.map((currency) => [currency, realized.filter((row) => row.currency === currency).reduce((sum, row) => sum + Number(row.realizedPnl), 0)])) as Record<Currency, number>;
  const profitFactor = (currency: Currency) => {
    const values = realized.filter((row) => row.currency === currency).map((row) => Number(row.realizedPnl));
    const grossProfit = values.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
    const grossLoss = Math.abs(values.filter((value) => value < 0).reduce((sum, value) => sum + value, 0));
    return grossLoss ? (grossProfit / grossLoss).toFixed(2) : grossProfit ? "∞" : "—";
  };
  const filterKeys = ["q", "asset", "status", "result", "direction", "currency", "instrument", "symbol", "subcategory", "style", "platform", "emotion", "strategy", "playbook", "closeReason", "from", "to"];
  const filterCount = filterKeys.filter((key) => url.get(key)).length;
  const start = result.total ? (result.page - 1) * result.pageSize + 1 : 0;
  const end = Math.min(result.page * result.pageSize, result.total);
  const sortHref = (sort: NonNullable<TradeQueryOptions["sort"]>) => hrefWith(url, { sort, page: 1 });
  const columnsConfigured = first(raw.columns) === "1";
  const visibleColumns = {
    asset: !columnsConfigured || first(raw.showAsset) === "1",
    side: !columnsConfigured || first(raw.showSide) === "1",
    size: !columnsConfigured || first(raw.showSize) === "1",
    context: !columnsConfigured || first(raw.showContext) === "1",
  };
  const columnParamNames = new Set(["columns", "showAsset", "showSide", "showSize", "showContext"]);
  const currentPath = `/trades${url.size ? `?${url}` : ""}`;

  return <AppShell user={shellUser}>
    <PageHeader eyebrow={<><Chip tone="accent">{account.name} · {account.defaultCurrency}</Chip><Chip>{result.total} matching records</Chip></>} title="My trades" description="Search, filter, sort, and page through the complete tenant-scoped journal." actions={<Button asChild><Link href="/trades/new"><Plus aria-hidden="true" />Add trade</Link></Button>} />
    {first(raw.created) === "1" ? <p role="status" className="mt-5 rounded-md border border-profit/30 bg-profit/10 px-4 py-3 text-sm text-profit">Trade saved to {account.name}.</p> : null}
    {first(raw.bulk) === "reviewed" ? <p role="status" className="mt-5 rounded-md border border-profit/30 bg-profit/10 px-4 py-3 text-sm text-profit">Marked {Number(first(raw.changed)) || 0} selected trade{first(raw.changed) === "1" ? "" : "s"} reviewed.</p> : first(raw.bulk) === "unreviewed" ? <p role="status" className="mt-5 rounded-md border border-line-strong bg-accent-soft px-4 py-3 text-sm text-ink">Moved {Number(first(raw.changed)) || 0} selected trade{first(raw.changed) === "1" ? "" : "s"} back to the review queue.</p> : first(raw.bulk) === "none" ? <p role="status" className="mt-5 rounded-md border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-body">Select at least one trade before running a bulk action.</p> : null}

    <section aria-label="Filtered trade summary" className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {currencyCodes.map((currency) => <div key={currency} className="rounded-lg border border-line bg-raised p-4"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Net P&amp;L · {currency}</p><p className={"mt-2 font-serif text-2xl tnum " + (totals[currency] >= 0 ? "text-profit" : "text-loss")}>{realized.some((row) => row.currency === currency) ? money(currency, totals[currency]) : "—"}</p><p className="mt-1 text-xs text-faint">Profit factor {profitFactor(currency)} · filtered closed trades</p></div>)}
      <div className="rounded-lg border border-line bg-raised p-4"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Matching trades</p><p className="mt-2 font-serif text-2xl text-ink tnum">{result.total}</p><p className="mt-1 text-xs text-faint">Across all result pages</p></div>
      <div className="rounded-lg border border-line bg-raised p-4"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Win rate</p><p className="mt-2 font-serif text-2xl text-ink tnum">{closed ? `${((wins / closed) * 100).toFixed(1)}%` : "—"}</p><p className="mt-1 text-xs text-faint">{wins} wins · {closed} closed</p></div>
      <div className="rounded-lg border border-line bg-raised p-4"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Average realized R</p><p className="mt-2 font-serif text-2xl text-ink tnum">{avgRValues.length ? `${(avgRValues.reduce((sum, value) => sum + value, 0) / avgRValues.length).toFixed(2)}R` : "—"}</p><p className="mt-1 text-xs text-faint">Dimensionless · currencies may coexist</p></div>
    </section>

    <form className="mt-6 rounded-lg border border-line bg-sidebar p-4" action="/trades" method="get">
      <div className="grid gap-3 lg:grid-cols-[minmax(15rem,1fr)_repeat(4,minmax(9rem,auto))_auto]">
        <label className="relative"><span className="sr-only">Search trades</span><Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted" aria-hidden="true" /><input name="q" defaultValue={query.search} placeholder="Search symbol, style, platform, emotion…" className="h-11 w-full rounded-md border border-line bg-raised pl-10 pr-3 text-sm text-ink" /></label>
        <select name="asset" defaultValue={query.assetClass} aria-label="Asset class filter" className={selectClass}><option value="">All assets</option>{assetClasses.map((item) => <option key={item}>{item}</option>)}</select>
        <select name="status" defaultValue={query.status} aria-label="Status filter" className={selectClass}><option value="">Any status</option>{tradeStatuses.map((item) => <option key={item} value={item}>{item === "open" ? "Open" : "Closed"}</option>)}</select>
        <select name="result" defaultValue={query.result} aria-label="Result filter" className={selectClass}><option value="">Any result</option><option value="win">Win</option><option value="loss">Loss</option><option value="breakeven">Break-even</option></select>
        <select name="sort" defaultValue={query.sort} aria-label="Sort trades" className={selectClass}><option value="entry-desc">Newest entry</option><option value="entry-asc">Oldest entry</option><option value="pnl-desc">Highest P&amp;L</option><option value="pnl-asc">Lowest P&amp;L</option><option value="r-desc">Highest R</option><option value="symbol-asc">Symbol A–Z</option></select>
        <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-accent-contrast"><Filter className="size-4" aria-hidden="true" />Apply</button>
      </div>
      <details className="mt-3" open={filterKeys.slice(4).some((key) => url.get(key))}><summary className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-3 text-sm font-semibold text-body hover:bg-hover"><SlidersHorizontal className="size-4" aria-hidden="true" />More filters {filterCount ? <Chip tone="accent">{filterCount} active</Chip> : null}</summary><div className="grid gap-3 border-t border-line pt-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6"><select name="strategy" defaultValue={query.strategyId} aria-label="Strategy filter" className={selectClass}><option value="">Any strategy</option>{libraries.strategies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select name="playbook" defaultValue={query.playbookId} aria-label="Playbook filter" className={selectClass}><option value="">Any playbook</option>{libraries.playbooks.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select name="closeReason" defaultValue={query.closeReasonId} aria-label="Close reason filter" className={selectClass}><option value="">Any close reason</option>{libraries.closeReasons.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select name="direction" defaultValue={query.direction} aria-label="Direction filter" className={selectClass}><option value="">Any direction</option>{tradeDirections.map((item) => <option key={item}>{item}</option>)}</select><select name="currency" defaultValue={query.currency} aria-label="Currency filter" className={selectClass}><option value="">Any currency</option>{currencyCodes.map((item) => <option key={item}>{item}</option>)}</select><select name="instrument" defaultValue={query.instrumentType} aria-label="Instrument type filter" className={selectClass}><option value="">Any instrument type</option>{instrumentTypes.map((item) => <option key={item}>{item}</option>)}</select><select name="symbol" defaultValue={query.symbol} aria-label="Instrument filter" className={selectClass}><option value="">Any instrument</option>{options.symbols.map((item) => <option key={item}>{item}</option>)}</select><select name="subcategory" defaultValue={query.subcategory} aria-label="Subcategory filter" className={selectClass}><option value="">Any subcategory</option>{options.subcategories.map((item) => <option key={item}>{item}</option>)}</select><select name="style" defaultValue={query.tradingStyle} aria-label="Trading style filter" className={selectClass}><option value="">Any style</option>{options.tradingStyles.map((item) => <option key={item}>{item}</option>)}</select><select name="platform" defaultValue={query.platform} aria-label="Platform filter" className={selectClass}><option value="">Any platform</option>{options.platforms.map((item) => <option key={item}>{item}</option>)}</select><select name="emotion" defaultValue={query.emotion} aria-label="Emotion filter" className={selectClass}><option value="">Any emotion</option>{options.emotions.map((item) => <option key={item}>{item}</option>)}</select><label className="text-xs font-semibold text-muted">From<input name="from" type="date" defaultValue={query.dateFrom} className={`${selectClass} mt-1 w-full`} /></label><label className="text-xs font-semibold text-muted">To<input name="to" type="date" defaultValue={query.dateTo} className={`${selectClass} mt-1 w-full`} /></label></div></details>
      <input type="hidden" name="size" value={result.pageSize} />
      {columnsConfigured ? <><input type="hidden" name="columns" value="1" />{visibleColumns.asset ? <input type="hidden" name="showAsset" value="1" /> : null}{visibleColumns.side ? <input type="hidden" name="showSide" value="1" /> : null}{visibleColumns.size ? <input type="hidden" name="showSize" value="1" /> : null}{visibleColumns.context ? <input type="hidden" name="showContext" value="1" /> : null}</> : null}
      {filterCount ? <div className="mt-3 flex justify-end"><Button asChild variant="ghost" size="compact"><Link href="/trades"><X aria-hidden="true" />Clear all filters</Link></Button></div> : null}
    </form>

    <section className="mt-6" aria-labelledby="trade-log-title">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div><h2 id="trade-log-title" className="font-serif text-2xl text-ink">Trade log</h2><p className="text-sm text-muted">Showing {start}–{end} of {result.total}</p></div>
        <div className="flex flex-wrap items-end justify-end gap-2">
          <details className="group relative">
            <summary className="inline-flex h-9 cursor-pointer list-none items-center gap-2 rounded-sm border border-line bg-raised px-3 text-xs font-semibold text-body hover:bg-hover"><Columns3 className="size-4" aria-hidden="true" />Columns<ChevronDown className="size-3.5 transition-transform group-open:rotate-180" aria-hidden="true" /></summary>
            <form action="/trades" method="get" className="absolute right-0 z-30 mt-2 w-64 rounded-md border border-line bg-raised p-4 shadow-sm">
              {[...url.entries()].filter(([key]) => key !== "page" && !columnParamNames.has(key)).map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />)}
              <input type="hidden" name="columns" value="1" />
              <fieldset><legend className="font-serif text-lg text-ink">Visible columns</legend><p className="mt-1 text-xs text-muted">Core outcome columns always stay visible.</p><div className="mt-3 space-y-2">{([ ["showAsset", "Asset", visibleColumns.asset], ["showSide", "Side", visibleColumns.side], ["showSize", "Quantity × multiplier", visibleColumns.size], ["showContext", "Context", visibleColumns.context] ] as const).map(([name, label, checked]) => <label key={name} className="flex min-h-9 cursor-pointer items-center gap-2 rounded-sm px-2 text-sm text-body hover:bg-hover"><input type="checkbox" name={name} value="1" defaultChecked={checked} className="size-4 accent-[var(--accent)]" />{label}</label>)}</div></fieldset>
              <div className="mt-4 flex justify-between gap-2"><Button asChild variant="ghost" size="compact"><Link href={hrefWith(url, { columns: null, showAsset: null, showSide: null, showSize: null, showContext: null })}>Reset</Link></Button><Button type="submit" size="compact">Apply columns</Button></div>
            </form>
          </details>
          <form action="/trades" className="flex items-end gap-2">{[...url.entries()].filter(([key]) => key !== "size" && key !== "page").map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />)}<label className="text-xs font-semibold text-muted">Rows<select name="size" aria-label="Rows per page" defaultValue={result.pageSize} className="ml-2 h-9 rounded-sm border border-line bg-raised px-2"><option>25</option><option>50</option><option>100</option></select></label><button className="h-9 rounded-sm border border-line px-3 text-xs font-semibold text-body hover:bg-hover">Set</button></form>
        </div>
      </div>
      {result.rows.length === 0 ? <div className="rounded-lg border border-dashed border-line-strong bg-sidebar px-6 py-16 text-center"><h3 className="font-serif text-2xl text-ink">No trades match this scope.</h3><p className="mt-2 text-sm text-muted">Clear filters or widen the date range.</p><Button asChild className="mt-5"><Link href="/trades">Reset trade log</Link></Button></div> :
        <form action={bulkTradeAction}>
          <input type="hidden" name="returnTo" value={currentPath} />
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-sidebar px-3 py-2"><p className="text-xs text-muted">Select rows on this page, then update their review state.</p><div className="flex gap-2"><Button type="submit" name="intent" value="unreviewed" variant="outline" size="compact"><RotateCcw aria-hidden="true" />Move to review queue</Button><Button type="submit" name="intent" value="reviewed" size="compact"><CheckCheck aria-hidden="true" />Mark reviewed</Button></div></div>
          <Table containerClassName="hidden max-h-[68vh] overflow-auto md:block"><TableHeader className="sticky top-0 z-20 shadow-[0_1px_0_var(--line)]"><TableRow><TableHead><span className="sr-only">Select</span></TableHead><TableHead><Link href={sortHref("symbol-asc")} className="hover:text-ink">Symbol</Link></TableHead>{visibleColumns.asset ? <TableHead>Asset</TableHead> : null}{visibleColumns.side ? <TableHead>Side</TableHead> : null}<TableHead><Link href={sortHref(query.sort === "entry-desc" ? "entry-asc" : "entry-desc")} className="hover:text-ink">Entry</Link></TableHead>{visibleColumns.size ? <TableHead className="text-right">Qty × mult.</TableHead> : null}<TableHead className="text-right"><Link href={sortHref(query.sort === "pnl-desc" ? "pnl-asc" : "pnl-desc")} className="hover:text-ink">P&amp;L</Link></TableHead><TableHead className="text-right"><Link href={sortHref("r-desc")} className="hover:text-ink">R</Link></TableHead><TableHead>Status</TableHead>{visibleColumns.context ? <TableHead>Context</TableHead> : null}</TableRow></TableHeader><TableBody>{result.rows.map((row) => { const pnl = row.realizedPnl == null ? null : Number(row.realizedPnl); const context = row.strategyId ? strategyNames.get(row.strategyId) : row.playbookId ? playbookNames.get(row.playbookId) : null; return <TableRow key={row.id} className={row.reviewedAt ? "bg-accent-soft/40" : undefined}><TableCell><input type="checkbox" name="tradeId" value={row.id} aria-label={`Select ${row.symbol} entered ${row.entryAt.toLocaleDateString("en-IN")}`} className="size-4 accent-[var(--accent)]" /></TableCell><TableCell><div className="font-semibold text-ink">{row.symbol}</div><div className="text-xs text-faint">{row.instrumentType} · {row.currency}</div></TableCell>{visibleColumns.asset ? <TableCell><Chip>{row.assetClass}</Chip></TableCell> : null}{visibleColumns.side ? <TableCell><Chip tone={row.direction === "Long" ? "profit" : "loss"}>{row.direction}</Chip></TableCell> : null}<TableCell><div className="tnum">{money(row.currency, Number(row.entryPrice))}</div><div className="text-xs text-faint">{row.entryAt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div></TableCell>{visibleColumns.size ? <TableCell className="text-right tnum">{Number(row.quantity).toLocaleString()} × {Number(row.multiplier).toLocaleString()}</TableCell> : null}<TableCell className={"text-right font-semibold tnum " + (pnl == null ? "text-muted" : pnl >= 0 ? "text-profit" : "text-loss")}>{pnl == null ? "—" : money(row.currency, pnl)}</TableCell><TableCell className="text-right tnum">{row.realizedR == null ? "—" : `${Number(row.realizedR).toFixed(2)}R`}</TableCell><TableCell><Chip tone={row.status === "open" ? "warning" : pnl != null && pnl >= 0 ? "profit" : "loss"}>{row.status === "open" ? "Open" : pnl != null && pnl > 0 ? "Win" : pnl != null && pnl < 0 ? "Loss" : "Closed"}</Chip></TableCell>{visibleColumns.context ? <TableCell><div className="max-w-40 truncate text-sm">{context || row.tradingStyle || row.emotion || "—"}</div><div className="text-xs text-faint">{row.reviewedAt ? "Reviewed" : "Needs review"}</div><div aria-label={row.confidence ? `${row.confidence} of 5 confidence` : undefined} className="text-xs text-warn">{row.confidence ? "★".repeat(row.confidence) : ""}</div></TableCell> : null}</TableRow>; })}</TableBody></Table>
          <div className="space-y-2 md:hidden">{result.rows.map((row) => { const pnl = row.realizedPnl == null ? null : Number(row.realizedPnl); const context = row.strategyId ? strategyNames.get(row.strategyId) : row.playbookId ? playbookNames.get(row.playbookId) : null; return <div key={row.id} className="flex items-start gap-3 rounded-md border border-line bg-raised p-3"><input type="checkbox" name="tradeId" value={row.id} aria-label={`Select ${row.symbol} entered ${row.entryAt.toLocaleDateString("en-IN")}`} className="mt-3 size-4 shrink-0 accent-[var(--accent)]" /><details className="group min-w-0 flex-1"><summary className="grid min-h-14 cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-3"><div className="min-w-0"><div className="flex items-center gap-2"><span className="truncate font-semibold text-ink">{row.symbol}</span><Chip tone={row.status === "open" ? "warning" : pnl != null && pnl >= 0 ? "profit" : "loss"}>{row.status === "open" ? "Open" : pnl != null && pnl > 0 ? "Win" : pnl != null && pnl < 0 ? "Loss" : "Closed"}</Chip></div><p className="mt-1 text-xs text-faint">{row.instrumentType} · {row.currency} · {row.reviewedAt ? "Reviewed" : "Needs review"}</p></div><div className="flex items-center gap-2 text-right"><div><p className={"font-semibold tnum " + (pnl == null ? "text-muted" : pnl >= 0 ? "text-profit" : "text-loss")}>{pnl == null ? "—" : money(row.currency, pnl)}</p><p className="text-xs text-muted tnum">{row.realizedR == null ? "—" : `${Number(row.realizedR).toFixed(2)}R`}</p></div><ChevronDown className="size-4 text-muted transition-transform group-open:rotate-180" aria-hidden="true" /></div></summary><dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-3 text-sm"><div><dt className="text-xs text-faint">Asset / side</dt><dd className="mt-0.5 text-body">{row.assetClass} · {row.direction}</dd></div><div><dt className="text-xs text-faint">Entry</dt><dd className="mt-0.5 text-body tnum">{money(row.currency, Number(row.entryPrice))}</dd></div><div><dt className="text-xs text-faint">Quantity × multiplier</dt><dd className="mt-0.5 text-body tnum">{Number(row.quantity).toLocaleString()} × {Number(row.multiplier).toLocaleString()}</dd></div><div><dt className="text-xs text-faint">Context</dt><dd className="mt-0.5 truncate text-body">{context || row.tradingStyle || row.emotion || "—"}</dd></div><div className="col-span-2"><dt className="text-xs text-faint">Entered</dt><dd className="mt-0.5 text-body">{row.entryAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</dd></div></dl></details></div>; })}</div>
        </form>}
      <nav aria-label="Trade log pages" className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted">Page {result.page} of {result.pageCount}</p><div className="flex items-center gap-2"><Button asChild variant="outline" size="compact"><Link aria-disabled={result.page <= 1} tabIndex={result.page <= 1 ? -1 : undefined} className={result.page <= 1 ? "pointer-events-none opacity-45" : ""} href={hrefWith(url, { page: result.page - 1 })}><ChevronLeft aria-hidden="true" />Previous</Link></Button>{Array.from({ length: result.pageCount }, (_, index) => index + 1).slice(Math.max(0, result.page - 3), Math.max(5, result.page + 2)).map((page) => <Button key={page} asChild variant={page === result.page ? "default" : "outline"} size="compact"><Link aria-current={page === result.page ? "page" : undefined} href={hrefWith(url, { page })}>{page}</Link></Button>)}<Button asChild variant="outline" size="compact"><Link aria-disabled={result.page >= result.pageCount} tabIndex={result.page >= result.pageCount ? -1 : undefined} className={result.page >= result.pageCount ? "pointer-events-none opacity-45" : ""} href={hrefWith(url, { page: result.page + 1 })}>Next<ChevronRight aria-hidden="true" /></Link></Button></div></nav>
    </section>
  </AppShell>;
}
