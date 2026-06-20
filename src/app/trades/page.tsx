import { Plus } from "lucide-react";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createTradeRepository } from "@/db/repositories/trades";
import { getDb } from "@/db/server";
import { sumMoneyByCurrency } from "@/db/money";
import type { Currency } from "@/lib/domain/types";
import { requireWorkspaceSession } from "@/lib/workspace-session";

export const dynamic = "force-dynamic";

function money(currency: Currency, amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: currency === "INR" ? 0 : 2 }).format(amount);
}

export default async function TradesPage({ searchParams }: { searchParams: Promise<{ created?: string }> }) {
  const { shellUser, scope, account } = await requireWorkspaceSession();
  const rows = await createTradeRepository(getDb(), scope).list({ accountId: account.id, limit: 50 });
  const { created } = await searchParams;
  const realized = rows.filter((row) => row.realizedPnl != null).map((row) => ({ currency: row.currency, amount: Number(row.realizedPnl) }));
  const totals = sumMoneyByCurrency(realized);
  const closed = rows.filter((row) => row.status === "closed" && row.realizedPnl != null);
  const wins = closed.filter((row) => Number(row.realizedPnl) > 0).length;

  return <AppShell user={shellUser}>
    <PageHeader eyebrow={<Chip tone="accent">{account.name} · {account.defaultCurrency}</Chip>} title="My trades" description="Your tenant-scoped journal. Currency totals stay separated by design." actions={<Button asChild><Link href="/trades/new"><Plus aria-hidden="true" />Add trade</Link></Button>} />
    {created === "1" ? <p role="status" className="mt-5 rounded-md border border-profit/30 bg-profit/10 px-4 py-3 text-sm text-profit">Trade saved to {account.name}.</p> : null}

    <section aria-label="Trade summary" className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {(["INR", "USD"] as Currency[]).map((currency) => <div key={currency} className="rounded-lg border border-line bg-raised p-4"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Net P&amp;L · {currency}</p><p className={"mt-2 font-serif text-2xl tnum " + ((totals[currency]?.amount ?? 0) >= 0 ? "text-profit" : "text-loss")}>{totals[currency] ? money(currency, totals[currency]!.amount) : "—"}</p><p className="mt-1 text-xs text-faint">Closed trades only</p></div>)}
      <div className="rounded-lg border border-line bg-raised p-4"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Trades</p><p className="mt-2 font-serif text-2xl text-ink tnum">{rows.length}</p><p className="mt-1 text-xs text-faint">Latest 50 in {account.name}</p></div>
      <div className="rounded-lg border border-line bg-raised p-4"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Win rate</p><p className="mt-2 font-serif text-2xl text-ink tnum">{closed.length ? `${((wins / closed.length) * 100).toFixed(1)}%` : "—"}</p><p className="mt-1 text-xs text-faint">{closed.length} closed with results</p></div>
    </section>

    <section className="mt-6" aria-labelledby="trade-log-title"><div className="mb-3 flex items-end justify-between"><div><h2 id="trade-log-title" className="font-serif text-2xl text-ink">Trade log</h2><p className="text-sm text-muted">Newest entry first</p></div><Chip>{rows.length} records</Chip></div>
      {rows.length === 0 ? <div className="rounded-lg border border-dashed border-line-strong bg-sidebar px-6 py-16 text-center"><h3 className="font-serif text-2xl text-ink">Your first clean record starts here.</h3><p className="mx-auto mt-2 max-w-md text-sm text-muted">Log an open plan or a completed trade. The risk preview checks direction and sizing before saving.</p><Button asChild className="mt-5"><Link href="/trades/new"><Plus aria-hidden="true" />Add your first trade</Link></Button></div> : <Table><TableHeader className="sticky top-16 z-10"><TableRow><TableHead>Symbol</TableHead><TableHead>Asset</TableHead><TableHead>Side</TableHead><TableHead>Entry</TableHead><TableHead className="text-right">Qty × mult.</TableHead><TableHead className="text-right">P&amp;L</TableHead><TableHead className="text-right">R</TableHead><TableHead>Status</TableHead><TableHead>Context</TableHead></TableRow></TableHeader><TableBody>{rows.map((row) => { const pnl = row.realizedPnl == null ? null : Number(row.realizedPnl); return <TableRow key={row.id}><TableCell><div className="font-semibold text-ink">{row.symbol}</div><div className="text-xs text-faint">{row.instrumentType} · {row.currency}</div></TableCell><TableCell><Chip>{row.assetClass}</Chip></TableCell><TableCell><Chip tone={row.direction === "Long" ? "profit" : "loss"}>{row.direction}</Chip></TableCell><TableCell><div className="tnum">{money(row.currency, Number(row.entryPrice))}</div><div className="text-xs text-faint">{row.entryAt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div></TableCell><TableCell className="text-right tnum">{Number(row.quantity).toLocaleString()} × {Number(row.multiplier).toLocaleString()}</TableCell><TableCell className={"text-right font-semibold tnum " + (pnl == null ? "text-muted" : pnl >= 0 ? "text-profit" : "text-loss")}>{pnl == null ? "—" : money(row.currency, pnl)}</TableCell><TableCell className="text-right tnum">{row.realizedR == null ? "—" : `${Number(row.realizedR).toFixed(2)}R`}</TableCell><TableCell><Chip tone={row.status === "open" ? "warning" : pnl != null && pnl >= 0 ? "profit" : "loss"}>{row.status === "open" ? "Open" : pnl != null && pnl > 0 ? "Win" : pnl != null && pnl < 0 ? "Loss" : "Closed"}</Chip></TableCell><TableCell><div className="max-w-40 truncate text-sm">{row.tradingStyle || row.emotion || "—"}</div><div aria-label={row.confidence ? `${row.confidence} of 5 confidence` : undefined} className="text-xs text-warn">{row.confidence ? "★".repeat(row.confidence) : ""}</div></TableCell></TableRow>; })}</TableBody></Table>}
    </section>
  </AppShell>;
}
