import { ChevronLeft, ChevronRight, Filter, Plus, Search, SlidersHorizontal, X } from "lucide-react";
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
  Object.entries(raw).forEach(([key, value]) => { const item = first(value); if (item) url.set(key, item); });
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

  return <AppShell user={shellUser}>
    <PageHeader eyebrow={<><Chip tone="accent">{account.name} · {account.defaultCurrency}</Chip><Chip>{result.total} matching records</Chip></>} title="My trades" description="Search, filter, sort, and page through the complete tenant-scoped journal." actions={<Button asChild><Link href="/trades/new"><Plus aria-hidden="true" />Add trade</Link></Button>} />
    {first(raw.created) === "1" ? <p role="status" className="mt-5 rounded-md border border-profit/30 bg-profit/10 px-4 py-3 text-sm text-profit">Trade saved to {account.name}.</p> : null}

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
      {filterCount ? <div className="mt-3 flex justify-end"><Button asChild variant="ghost" size="compact"><Link href="/trades"><X aria-hidden="true" />Clear all filters</Link></Button></div> : null}
    </form>

    <section className="mt-6" aria-labelledby="trade-log-title"><div className="mb-3 flex items-end justify-between gap-3"><div><h2 id="trade-log-title" className="font-serif text-2xl text-ink">Trade log</h2><p className="text-sm text-muted">Showing {start}–{end} of {result.total}</p></div><form action="/trades" className="flex items-end gap-2">{[...url.entries()].filter(([key]) => key !== "size" && key !== "page").map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />)}<label className="text-xs font-semibold text-muted">Rows<select name="size" aria-label="Rows per page" defaultValue={result.pageSize} className="ml-2 h-9 rounded-sm border border-line bg-raised px-2"><option>25</option><option>50</option><option>100</option></select></label><button className="h-9 rounded-sm border border-line px-3 text-xs font-semibold text-body hover:bg-hover">Set</button></form></div>
      {result.rows.length === 0 ? <div className="rounded-lg border border-dashed border-line-strong bg-sidebar px-6 py-16 text-center"><h3 className="font-serif text-2xl text-ink">No trades match this scope.</h3><p className="mt-2 text-sm text-muted">Clear filters or widen the date range.</p><Button asChild className="mt-5"><Link href="/trades">Reset trade log</Link></Button></div> : <Table containerClassName="max-h-[68vh] overflow-auto"><TableHeader className="sticky top-0 z-20 shadow-[0_1px_0_var(--line)]"><TableRow><TableHead><Link href={sortHref("symbol-asc")} className="hover:text-ink">Symbol</Link></TableHead><TableHead>Asset</TableHead><TableHead>Side</TableHead><TableHead><Link href={sortHref(query.sort === "entry-desc" ? "entry-asc" : "entry-desc")} className="hover:text-ink">Entry</Link></TableHead><TableHead className="text-right">Qty × mult.</TableHead><TableHead className="text-right"><Link href={sortHref(query.sort === "pnl-desc" ? "pnl-asc" : "pnl-desc")} className="hover:text-ink">P&amp;L</Link></TableHead><TableHead className="text-right"><Link href={sortHref("r-desc")} className="hover:text-ink">R</Link></TableHead><TableHead>Status</TableHead><TableHead>Context</TableHead></TableRow></TableHeader><TableBody>{result.rows.map((row) => { const pnl = row.realizedPnl == null ? null : Number(row.realizedPnl); const context = row.strategyId ? strategyNames.get(row.strategyId) : row.playbookId ? playbookNames.get(row.playbookId) : null; return <TableRow key={row.id}><TableCell><div className="font-semibold text-ink">{row.symbol}</div><div className="text-xs text-faint">{row.instrumentType} · {row.currency}</div></TableCell><TableCell><Chip>{row.assetClass}</Chip></TableCell><TableCell><Chip tone={row.direction === "Long" ? "profit" : "loss"}>{row.direction}</Chip></TableCell><TableCell><div className="tnum">{money(row.currency, Number(row.entryPrice))}</div><div className="text-xs text-faint">{row.entryAt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div></TableCell><TableCell className="text-right tnum">{Number(row.quantity).toLocaleString()} × {Number(row.multiplier).toLocaleString()}</TableCell><TableCell className={"text-right font-semibold tnum " + (pnl == null ? "text-muted" : pnl >= 0 ? "text-profit" : "text-loss")}>{pnl == null ? "—" : money(row.currency, pnl)}</TableCell><TableCell className="text-right tnum">{row.realizedR == null ? "—" : `${Number(row.realizedR).toFixed(2)}R`}</TableCell><TableCell><Chip tone={row.status === "open" ? "warning" : pnl != null && pnl >= 0 ? "profit" : "loss"}>{row.status === "open" ? "Open" : pnl != null && pnl > 0 ? "Win" : pnl != null && pnl < 0 ? "Loss" : "Closed"}</Chip></TableCell><TableCell><div className="max-w-40 truncate text-sm">{context || row.tradingStyle || row.emotion || "—"}</div><div aria-label={row.confidence ? `${row.confidence} of 5 confidence` : undefined} className="text-xs text-warn">{row.confidence ? "★".repeat(row.confidence) : ""}</div></TableCell></TableRow>; })}</TableBody></Table>}
      <nav aria-label="Trade log pages" className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted">Page {result.page} of {result.pageCount}</p><div className="flex items-center gap-2"><Button asChild variant="outline" size="compact"><Link aria-disabled={result.page <= 1} tabIndex={result.page <= 1 ? -1 : undefined} className={result.page <= 1 ? "pointer-events-none opacity-45" : ""} href={hrefWith(url, { page: result.page - 1 })}><ChevronLeft aria-hidden="true" />Previous</Link></Button>{Array.from({ length: result.pageCount }, (_, index) => index + 1).slice(Math.max(0, result.page - 3), Math.max(5, result.page + 2)).map((page) => <Button key={page} asChild variant={page === result.page ? "default" : "outline"} size="compact"><Link aria-current={page === result.page ? "page" : undefined} href={hrefWith(url, { page })}>{page}</Link></Button>)}<Button asChild variant="outline" size="compact"><Link aria-disabled={result.page >= result.pageCount} tabIndex={result.page >= result.pageCount ? -1 : undefined} className={result.page >= result.pageCount ? "pointer-events-none opacity-45" : ""} href={hrefWith(url, { page: result.page + 1 })}>Next<ChevronRight aria-hidden="true" /></Link></Button></div></nav>
    </section>
  </AppShell>;
}
