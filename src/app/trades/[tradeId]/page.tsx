import { ArrowLeft, Check, CircleDashed, LockKeyhole, Pencil } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { ensureDefaultTradeLibraries, getTradeEntryLibraries } from "@/db/repositories/libraries";
import { createTradeRepository } from "@/db/repositories/trades";
import { getDb } from "@/db/server";
import type { Currency } from "@/lib/domain/types";
import { requireWorkspaceSession } from "@/lib/workspace-session";

import { saveTradeReviewAction } from "./actions";
import { CloseTradeForm } from "./close-trade-form";

export const dynamic = "force-dynamic";

const emotions = ["Focused", "Calm", "Confident", "Anxious", "FOMO", "Revenge"];
const money = (currency: Currency, amount: number) => new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: currency === "INR" ? 0 : 2 }).format(amount);
const number = (value: string | null) => value == null ? null : Number(value);

function Fact({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="rounded-md border border-line bg-page p-3"><dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{label}</dt><dd className="mt-1 text-sm font-semibold text-ink tnum">{value}</dd>{detail ? <p className="mt-0.5 text-xs text-faint">{detail}</p> : null}</div>;
}

export default async function TradeDetailPage({ params, searchParams }: { params: Promise<{ tradeId: string }>; searchParams: Promise<{ mode?: string; reviewed?: string; closed?: string; close?: string }> }) {
  const { shellUser, scope, account } = await requireWorkspaceSession();
  const { tradeId } = await params;
  const query = await searchParams;
  const db = getDb();
  const trade = await createTradeRepository(db, scope).getById(account.id, tradeId);
  if (!trade) notFound();
  await ensureDefaultTradeLibraries(db, scope);
  const libraries = await getTradeEntryLibraries(db, scope);
  const strategy = libraries.strategies.find((item) => item.id === trade.strategyId)?.name;
  const playbook = libraries.playbooks.find((item) => item.id === trade.playbookId)?.name;
  const closeReason = libraries.closeReasons.find((item) => item.id === trade.closeReasonId)?.name;
  const pnl = number(trade.realizedPnl);
  const plannedRisk = number(trade.plannedRisk);
  const plannedRr = number(trade.plannedRewardRisk);
  const realizedR = number(trade.realizedR);
  const durationMs = trade.exitAt ? trade.exitAt.getTime() - trade.entryAt.getTime() : null;
  const duration = durationMs == null ? "Still open" : durationMs < 86_400_000 ? `${Math.max(1, Math.round(durationMs / 3_600_000))} hours` : `${Math.round(durationMs / 86_400_000)} days`;
  const verdict = trade.status === "open" ? "Open" : pnl != null && pnl > 0 ? "Win" : pnl != null && pnl < 0 ? "Loss" : "Closed";
  const reviewMode = query.mode === "review";
  const isOpen = trade.status === "open";
  const closeMode = query.mode === "close" && isOpen;

  return <AppShell user={shellUser}>
    <Link href="/trades" className="mb-5 inline-flex min-h-10 items-center gap-2 rounded-sm px-2 text-sm font-semibold text-muted hover:bg-hover hover:text-ink"><ArrowLeft className="size-4" aria-hidden="true" />Back to My Trades</Link>
    <PageHeader
      eyebrow={<><Chip tone="accent">{trade.assetClass}</Chip><Chip tone={trade.direction === "Long" ? "profit" : "loss"}>{trade.direction}</Chip><Chip tone={trade.status === "open" ? "warning" : pnl != null && pnl >= 0 ? "profit" : "loss"}>{verdict}</Chip></>}
      title={trade.symbol}
      description={`${trade.instrumentType} · ${trade.currency} · entered ${trade.entryAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`}
      actions={<><Button asChild variant={reviewMode ? "default" : "outline"}><Link href={`/trades/${trade.id}?mode=review`}><Check aria-hidden="true" />Review</Link></Button>{isOpen ? <Button asChild variant={closeMode ? "default" : "outline"}><Link href={`/trades/${trade.id}?mode=close`}><LockKeyhole aria-hidden="true" />Close</Link></Button> : <Button disabled variant="outline" title="This trade is already closed"><LockKeyhole aria-hidden="true" />Closed</Button>}<Button disabled variant="ghost" title="Edit workflow lands in the next P4 slice"><Pencil aria-hidden="true" />Edit</Button></>}
    />
    {query.reviewed === "1" ? <p role="status" className="mt-5 rounded-md border border-profit/30 bg-profit/10 px-4 py-3 text-sm text-profit">Review saved. This trade is out of the review queue.</p> : null}
    {query.closed === "1" ? <p role="status" className="mt-5 rounded-md border border-profit/30 bg-profit/10 px-4 py-3 text-sm text-profit">Trade closed. The realized result below is computed in {trade.currency} only.</p> : null}
    {query.close === "already" ? <p role="status" className="mt-5 rounded-md border border-line-strong bg-sidebar px-4 py-3 text-sm text-muted">This trade was already closed — nothing to do.</p> : null}

    {closeMode ? <CloseTradeForm
      trade={{ id: trade.id, symbol: trade.symbol, assetClass: trade.assetClass, instrumentType: trade.instrumentType, direction: trade.direction, currency: trade.currency, entryAt: trade.entryAt.toISOString(), entryPrice: Number(trade.entryPrice), quantity: Number(trade.quantity), multiplier: Number(trade.multiplier), stopLoss: number(trade.stopLoss), plannedTarget: number(trade.plannedTarget), fxToAccount: Number(trade.fxToAccount), fees: Number(trade.fees) }}
      closeReasons={libraries.closeReasons.map((item) => ({ id: item.id, name: item.name }))}
      defaultExitAt={new Date().toISOString().slice(0, 16)}
    /> : null}

    <section aria-label="Trade result" className="mt-7 grid gap-4 rounded-lg border border-line-strong bg-sidebar p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
      <div><p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">Result · {trade.currency} only</p><div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1"><p className={"font-serif text-4xl tnum " + (pnl == null ? "text-muted" : pnl >= 0 ? "text-profit" : "text-loss")}>{pnl == null ? "Outcome pending" : money(trade.currency, pnl)}</p><p className="text-lg font-semibold text-body tnum">{realizedR == null ? "R unavailable" : `${realizedR.toFixed(2)}R`}</p></div><p className="mt-2 text-sm text-muted">{Number(trade.quantity).toLocaleString()} × {Number(trade.multiplier).toLocaleString()} effective sizing · {duration}</p></div>
      <div className="flex flex-wrap gap-2 sm:justify-end">{trade.tags.length ? trade.tags.map((tag) => <Chip key={tag}>{tag}</Chip>) : <span className="text-sm text-faint">No tags</span>}</div>
    </section>

    {reviewMode ? <form action={saveTradeReviewAction} className="mt-6 rounded-lg border border-line-strong bg-accent-soft p-5"><input type="hidden" name="tradeId" value={trade.id} /><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-serif text-2xl text-ink">Review this trade</h2><p className="mt-1 text-sm text-muted">Record the behavior and lesson without changing historical execution facts.</p></div><Button type="submit"><Check aria-hidden="true" />Save review</Button></div><div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3"><label className="text-sm font-semibold text-body">Execution confidence<select name="confidence" defaultValue={trade.confidence ?? ""} className="mt-1.5 h-11 w-full rounded-md border border-line bg-raised px-3 font-normal text-ink"><option value="">Not set</option>{[1,2,3,4,5].map((item) => <option key={item} value={item}>{"★".repeat(item)} · {item}/5</option>)}</select></label><label className="text-sm font-semibold text-body">Emotion<select name="emotion" defaultValue={trade.emotion ?? ""} className="mt-1.5 h-11 w-full rounded-md border border-line bg-raised px-3 font-normal text-ink"><option value="">Not set</option>{emotions.map((item) => <option key={item}>{item}</option>)}</select></label><label className="text-sm font-semibold text-body md:col-span-2 xl:col-span-1">Rule violations<textarea name="ruleViolations" defaultValue={trade.ruleViolations ?? ""} rows={3} className="mt-1.5 w-full rounded-md border border-line bg-raised p-3 font-normal text-ink" placeholder="Leave blank if the plan was followed." /></label></div>{trade.setupChecklist.length ? <fieldset className="mt-5 border-t border-line pt-4"><legend className="font-serif text-lg text-ink">Process checklist</legend><div className="mt-3 grid gap-2 md:grid-cols-2">{trade.setupChecklist.map((item) => <label key={`${item.phase}-${item.id}`} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border border-line bg-raised px-3 py-2.5 text-sm text-body"><input type="checkbox" name="checklistCompleted" value={item.id} defaultChecked={item.completed} className="mt-0.5 size-4 accent-[var(--accent)]" /><span>{item.label}<span className="ml-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-faint">{item.phase}</span></span></label>)}</div></fieldset> : null}<label className="mt-5 block text-sm font-semibold text-body">Review note<textarea name="notes" defaultValue={trade.notes ?? ""} rows={5} className="mt-1.5 w-full rounded-md border border-line bg-raised p-3 font-normal leading-relaxed text-ink" placeholder="What happened, and what should change next time?" /></label><div className="mt-4 flex justify-end gap-2"><Button asChild variant="ghost"><Link href={`/trades/${trade.id}`}>Cancel</Link></Button><Button type="submit"><Check aria-hidden="true" />Save review</Button></div></form> : null}

    <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-6">
        <section className="rounded-lg border border-line bg-raised p-5"><h2 className="font-serif text-2xl text-ink">Execution</h2><p className="mt-1 text-sm text-muted">The historical position facts captured at entry and exit.</p><dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Fact label="Entry" value={money(trade.currency, Number(trade.entryPrice))} detail={trade.entryAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} /><Fact label="Exit" value={trade.exitPrice == null ? "—" : money(trade.currency, Number(trade.exitPrice))} detail={trade.exitAt?.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) ?? "Position remains open"} /><Fact label="Quantity" value={`${Number(trade.quantity).toLocaleString()} × ${Number(trade.multiplier).toLocaleString()}`} detail="Quantity × multiplier" /><Fact label="Fees" value={money(trade.currency, Number(trade.fees))} detail={duration} /></dl></section>
        <section className="rounded-lg border border-line bg-raised p-5"><h2 className="font-serif text-2xl text-ink">Risk &amp; targets</h2><p className="mt-1 text-sm text-muted">Planned risk stays in {trade.currency}; realized R remains currency-neutral.</p><dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Fact label="Initial stop" value={trade.stopLoss == null ? "—" : money(trade.currency, Number(trade.stopLoss))} /><Fact label="Planned target" value={trade.plannedTarget == null ? "—" : money(trade.currency, Number(trade.plannedTarget))} /><Fact label="Planned 1R" value={plannedRisk == null ? "—" : money(trade.currency, plannedRisk)} /><Fact label="Plan / realized" value={`${plannedRr == null ? "—" : `${plannedRr.toFixed(2)}R`} / ${realizedR == null ? "—" : `${realizedR.toFixed(2)}R`}`} /></dl></section>
        <section className="rounded-lg border border-line bg-raised p-5"><h2 className="font-serif text-2xl text-ink">Rules &amp; setup</h2><div className="mt-4 flex flex-wrap gap-2">{strategy ? <Chip tone="accent">Strategy · {strategy}</Chip> : null}{playbook ? <Chip>Playbook · {playbook}</Chip> : null}{closeReason ? <Chip>Close · {closeReason}</Chip> : null}{trade.emotion ? <Chip>Emotion · {trade.emotion}</Chip> : null}</div>{trade.setupChecklist.length ? <ul className="mt-5 grid gap-2 md:grid-cols-2">{trade.setupChecklist.map((item) => <li key={`${item.phase}-${item.id}`} className="flex items-start gap-3 rounded-md border border-line bg-page px-3 py-2.5 text-sm text-body">{item.completed ? <Check className="mt-0.5 size-4 shrink-0 text-profit" aria-hidden="true" /> : <CircleDashed className="mt-0.5 size-4 shrink-0 text-faint" aria-hidden="true" />}<span>{item.label}<span className="ml-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-faint">{item.phase}</span></span></li>)}</ul> : <p className="mt-4 text-sm text-faint">No setup checklist was saved with this trade.</p>}{trade.ruleViolations ? <div className="mt-4 rounded-md border border-loss/20 bg-loss/10 p-3 text-sm text-body"><strong className="text-loss">Rule exception:</strong> {trade.ruleViolations}</div> : <p className="mt-4 flex items-center gap-2 text-sm text-profit"><Check className="size-4" aria-hidden="true" />No rule violation recorded.</p>}</section>
      </div>
      <aside className="h-fit space-y-4 xl:sticky xl:top-24"><section className="rounded-lg border border-line bg-sidebar p-5"><h2 className="font-serif text-xl text-ink">Trade notes</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-body">{trade.notes || "No review note yet."}</p>{trade.linkedNote ? <div className="mt-4 border-t border-line pt-4"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Linked thesis</p><p className="mt-2 text-sm leading-relaxed text-body">{trade.linkedNote}</p></div> : null}</section><section className="rounded-lg border border-dashed border-line-strong bg-page p-5"><h2 className="font-serif text-lg text-ink">Media &amp; attachments</h2><p className="mt-2 text-sm leading-relaxed text-muted">No attachments yet. Upload, captions, and deletion land in the next P4 slice.</p></section></aside>
    </div>
  </AppShell>;
}
