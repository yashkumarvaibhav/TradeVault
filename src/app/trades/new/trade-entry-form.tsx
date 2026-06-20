"use client";

import * as React from "react";
import { useActionState } from "react";
import { AlertCircle, Calculator, Check, Plus } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TradeEntryLibraries } from "@/db/repositories/libraries";
import type { SetupChecklistItem } from "@/db/schema";
import { evaluateTradeEntry } from "@/lib/domain/trade-entry";
import type { AssetClass, Currency, Direction, InstrumentType, TradeStatus } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

import { createTradeAction, type TradeFormState } from "./actions";

const assets: AssetClass[] = ["Equity", "Index", "Forex", "Commodity", "US Index", "Crypto"];
const instruments: InstrumentType[] = ["Cash", "Futures", "Options"];
const emotions = ["Focused", "Calm", "Confident", "Anxious", "FOMO", "Revenge"];

type Values = {
  symbol: string; assetClass: AssetClass; instrumentType: InstrumentType; direction: Direction;
  status: TradeStatus; currency: Currency; entryAt: string; entryPrice: string; exitAt: string;
  exitPrice: string; quantity: string; multiplier: string; stopLoss: string; plannedTarget: string;
  manualPnl: string; fees: string; fxToAccount: string; confidence: string; emotion: string;
  subcategory: string; tradingStyle: string; platform: string; strategyId: string; playbookId: string;
  closeReasonId: string;
};

function numberOrNull(value: string) { return value.trim() === "" ? null : Number(value); }

function Field({ label, name, error, children, hint }: { label: string; name: string; error?: string; children: React.ReactNode; hint?: string }) {
  return <div className="space-y-1.5"><Label htmlFor={name}>{label}</Label>{children}{error ? <p id={`${name}-error`} className="text-xs text-danger">{error}</p> : hint ? <p className="text-xs text-muted">{hint}</p> : null}</div>;
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return <div className="rounded-md border border-line bg-page p-3"><p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{label}</p><p className="mt-1 font-serif text-xl text-ink tnum">{value}</p><p className="mt-0.5 text-[11px] text-faint">{sub}</p></div>;
}

type TradeAction = (state: TradeFormState, formData: FormData) => Promise<TradeFormState>;

export function TradeEntryForm({
  initialEntryAt,
  libraries,
  saved = false,
  mode = "create",
  action = createTradeAction,
  initialValues,
  initialChecklist,
  initialText,
  hiddenFields,
  cancelHref = "/trades",
}: {
  initialEntryAt: string;
  libraries: TradeEntryLibraries;
  saved?: boolean;
  mode?: "create" | "edit";
  action?: TradeAction;
  initialValues?: Partial<Values>;
  initialChecklist?: SetupChecklistItem[];
  initialText?: { tags?: string; ruleViolations?: string; linkedNote?: string; notes?: string };
  hiddenFields?: Record<string, string>;
  cancelHref?: string;
}) {
  const isEdit = mode === "edit";
  const [state, formAction, pending] = useActionState<TradeFormState, FormData>(action, {});
  const [v, setV] = React.useState<Values>({
    symbol: "", assetClass: "Equity", instrumentType: "Cash", direction: "Long", status: "open",
    currency: "INR", entryAt: initialEntryAt, entryPrice: "", exitAt: "", exitPrice: "", quantity: "1",
    multiplier: "1", stopLoss: "", plannedTarget: "", manualPnl: "", fees: "0", fxToAccount: "1",
    confidence: "", emotion: "", subcategory: "", tradingStyle: "", platform: "", strategyId: "",
    playbookId: "", closeReasonId: "",
    ...initialValues,
  });
  const [defaultsApplied, setDefaultsApplied] = React.useState("");
  const [templateId, setTemplateId] = React.useState(initialChecklist ? "" : libraries.checklistTemplates[0]?.id ?? "");
  const [setupChecklist, setSetupChecklist] = React.useState<SetupChecklistItem[]>(() =>
    initialChecklist ?? (libraries.checklistTemplates[0]?.items ?? []).map((item) => ({ ...item, completed: false })),
  );
  const update = <K extends keyof Values>(key: K, value: Values[K]) => setV((current) => ({ ...current, [key]: value }));
  const evaluated = evaluateTradeEntry({
    symbol: v.symbol, assetClass: v.assetClass, instrumentType: v.instrumentType, direction: v.direction,
    status: v.status, currency: v.currency, entryAt: v.entryAt, entryPrice: Number(v.entryPrice),
    exitAt: v.exitAt || null, exitPrice: numberOrNull(v.exitPrice), quantity: Number(v.quantity),
    multiplier: Number(v.multiplier), stopLoss: numberOrNull(v.stopLoss), plannedTarget: numberOrNull(v.plannedTarget),
    manualPnl: numberOrNull(v.manualPnl), fees: Number(v.fees), fxToAccount: Number(v.fxToAccount),
    confidence: numberOrNull(v.confidence),
  });
  const errors = state.fieldErrors ?? {};
  const money = (amount: number | null) => amount == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: v.currency, maximumFractionDigits: v.currency === "INR" ? 0 : 2 }).format(amount);
  const presetTarget = (multiple: number) => {
    const entry = Number(v.entryPrice); const stop = numberOrNull(v.stopLoss);
    if (!Number.isFinite(entry) || stop == null) return;
    const risk = Math.abs(entry - stop);
    update("plannedTarget", String(v.direction === "Long" ? entry + risk * multiple : entry - risk * multiple));
  };
  const applyInstrumentDefaults = (symbol: string) => {
    const normalized = symbol.trim().toUpperCase();
    const savedInstrument = libraries.instruments.find((item) => item.symbol === normalized && item.instrumentType === v.instrumentType)
      ?? libraries.instruments.find((item) => item.symbol === normalized);
    if (!savedInstrument) {
      update("symbol", normalized);
      setDefaultsApplied("");
      return;
    }
    setV((current) => ({
      ...current,
      symbol: savedInstrument.symbol,
      assetClass: savedInstrument.assetClass,
      instrumentType: savedInstrument.instrumentType,
      currency: savedInstrument.currency,
      subcategory: savedInstrument.subcategory ?? "",
      tradingStyle: savedInstrument.tradingStyle ?? "",
      quantity: savedInstrument.quantity ?? current.quantity,
      multiplier: savedInstrument.multiplier ?? current.multiplier,
      platform: savedInstrument.platform ?? "",
    }));
    setDefaultsApplied(`Saved defaults applied for ${savedInstrument.symbol}.`);
  };
  const applyChecklistTemplate = (id: string) => {
    setTemplateId(id);
    const template = libraries.checklistTemplates.find((item) => item.id === id);
    setSetupChecklist((template?.items ?? []).map((item) => ({ ...item, completed: false })));
  };

  return <form action={formAction} className="pb-24" noValidate>
    {hiddenFields ? Object.entries(hiddenFields).map(([name, fieldValue]) => <input key={name} type="hidden" name={name} value={fieldValue} />) : null}
    {saved ? <p role="status" className="mb-5 flex items-center gap-2 rounded-md border border-profit/30 bg-profit/10 px-4 py-3 text-sm text-profit"><Check className="size-4" aria-hidden="true" />Trade saved. Add the next one.</p> : null}
    {state.error ? <div role="alert" className="mb-5 flex items-start gap-2 rounded-md border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"><AlertCircle className="mt-0.5 size-4" aria-hidden="true" /><span><strong>{state.error}</strong> Errors remain beside their fields.</span></div> : null}

    <fieldset className="mb-6"><legend className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted">Asset class</legend><div className="grid grid-cols-3 gap-2 lg:grid-cols-6">{assets.map((asset) => <label key={asset} className={cn("flex min-h-11 cursor-pointer items-center justify-center rounded-md border px-3 text-center text-sm font-semibold transition-colors", v.assetClass === asset ? "border-line-strong bg-accent-soft text-ink" : "border-line bg-raised text-muted hover:bg-hover")}><input type="radio" name="assetClass" value={asset} checked={v.assetClass === asset} onChange={() => update("assetClass", asset)} className="sr-only" />{asset}</label>)}</div></fieldset>

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-6">
        <section className="rounded-lg border border-line bg-raised p-5"><h2 className="font-serif text-xl text-ink">Position</h2><p className="mb-5 text-sm text-muted">What you traded and how the position was structured.</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Instrument / symbol" name="symbol" error={errors.symbol} hint={libraries.instruments.length ? "Choose a saved symbol to reuse its defaults, or type a new one." : "Your first save creates a reusable instrument default."}><Input id="symbol" name="symbol" list="saved-instruments" value={v.symbol} onChange={(e) => applyInstrumentDefaults(e.target.value)} placeholder="NIFTY, RELIANCE, EURUSD" autoFocus autoComplete="off" aria-invalid={!!errors.symbol} /><datalist id="saved-instruments">{libraries.instruments.map((item) => <option key={item.id} value={item.symbol}>{item.instrumentType} · {item.currency}</option>)}</datalist>{defaultsApplied ? <p role="status" className="text-xs font-semibold text-accent">{defaultsApplied}</p> : null}</Field>
            <Field label="Instrument type" name="instrumentType"><select id="instrumentType" name="instrumentType" value={v.instrumentType} onChange={(e) => update("instrumentType", e.target.value as InstrumentType)} className="h-11 w-full rounded-md border border-line bg-raised px-3 text-sm text-ink">{instruments.map((item) => <option key={item}>{item}</option>)}</select></Field>
            <Field label="Currency" name="currency" hint="All risk and P&L below stays in this currency."><select id="currency" name="currency" value={v.currency} onChange={(e) => update("currency", e.target.value as Currency)} className="h-11 w-full rounded-md border border-line bg-raised px-3 text-sm text-ink"><option>INR</option><option>USD</option></select></Field>
            <Field label="Direction" name="direction"><div className="grid grid-cols-2 gap-2">{(["Long", "Short"] as Direction[]).map((direction) => <label key={direction} className={cn("flex min-h-11 cursor-pointer items-center justify-center rounded-md border text-sm font-semibold", v.direction === direction ? "border-line-strong bg-accent-soft text-ink" : "border-line text-muted")}><input className="sr-only" type="radio" name="direction" value={direction} checked={v.direction === direction} onChange={() => update("direction", direction)} />{direction}</label>)}</div></Field>
            <Field label="Quantity" name="quantity" error={errors.quantity}><Input id="quantity" name="quantity" type="number" min="0" step="any" value={v.quantity} onChange={(e) => update("quantity", e.target.value)} aria-invalid={!!errors.quantity} /></Field>
            <Field label="Lot / contract multiplier" name="multiplier" error={errors.multiplier} hint="1 for cash/spot; lot size for derivatives."><Input id="multiplier" name="multiplier" type="number" min="0" step="any" value={v.multiplier} onChange={(e) => update("multiplier", e.target.value)} aria-invalid={!!errors.multiplier} /></Field>
          </div>
        </section>

        <section className="rounded-lg border border-line bg-raised p-5"><h2 className="font-serif text-xl text-ink">Entry, risk & target</h2><p className="mb-5 text-sm text-muted">Directional checks update as you type.</p><div className="grid gap-4 sm:grid-cols-2">
          <Field label="Entry date & time" name="entryAt" error={errors.entryAt}><Input id="entryAt" name="entryAt" type="datetime-local" value={v.entryAt} onChange={(e) => update("entryAt", e.target.value)} aria-invalid={!!errors.entryAt} /></Field>
          <Field label="Entry price" name="entryPrice" error={errors.entryPrice}><Input id="entryPrice" name="entryPrice" type="number" step="any" value={v.entryPrice} onChange={(e) => update("entryPrice", e.target.value)} aria-invalid={!!errors.entryPrice} /></Field>
          <Field label="Initial stop" name="stopLoss" error={errors.stopLoss ?? evaluated.errors.stopLoss}><Input id="stopLoss" name="stopLoss" type="number" step="any" value={v.stopLoss} onChange={(e) => update("stopLoss", e.target.value)} aria-invalid={!!(errors.stopLoss ?? evaluated.errors.stopLoss)} /></Field>
          <Field label="Planned target" name="plannedTarget" error={errors.plannedTarget ?? evaluated.errors.plannedTarget}><Input id="plannedTarget" name="plannedTarget" type="number" step="any" value={v.plannedTarget} onChange={(e) => update("plannedTarget", e.target.value)} aria-invalid={!!(errors.plannedTarget ?? evaluated.errors.plannedTarget)} /><div className="mt-2 flex flex-wrap gap-1.5" aria-label="R-multiple target presets">{[1,2,3,4,5].map((r) => <button key={r} type="button" onClick={() => presetTarget(r)} className="min-h-9 rounded-sm border border-line px-3 text-xs font-semibold text-muted hover:border-line-strong hover:bg-accent-soft">{r}R</button>)}</div></Field>
          <Field label="Fees / commission" name="fees" error={errors.fees}><Input id="fees" name="fees" type="number" min="0" step="any" value={v.fees} onChange={(e) => update("fees", e.target.value)} /></Field>
          <Field label="Status" name="status"><select id="status" name="status" value={v.status} onChange={(e) => update("status", e.target.value as TradeStatus)} className="h-11 w-full rounded-md border border-line bg-raised px-3 text-sm text-ink"><option value="open">Open / planned</option><option value="closed">Already closed</option></select></Field>
        </div>{v.status === "closed" ? <div className="mt-5 grid gap-4 border-t border-line pt-5 sm:grid-cols-2"><Field label="Exit date & time" name="exitAt" error={errors.exitAt}><Input id="exitAt" name="exitAt" type="datetime-local" value={v.exitAt} onChange={(e) => update("exitAt", e.target.value)} /></Field><Field label="Exit price" name="exitPrice" error={errors.exitPrice}><Input id="exitPrice" name="exitPrice" type="number" step="any" value={v.exitPrice} onChange={(e) => update("exitPrice", e.target.value)} /></Field><Field label="Close reason" name="closeReasonId"><select id="closeReasonId" name="closeReasonId" value={v.closeReasonId} onChange={(e) => update("closeReasonId", e.target.value)} className="h-11 w-full rounded-md border border-line bg-raised px-3 text-sm text-ink"><option value="">Not set</option>{libraries.closeReasons.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>{v.assetClass === "Forex" ? <Field label="Manual P&L fallback" name="manualPnl" error={errors.manualPnl} hint="Signed amount in the selected currency; overrides price-based P&L."><Input id="manualPnl" name="manualPnl" type="number" step="any" value={v.manualPnl} onChange={(e) => update("manualPnl", e.target.value)} /></Field> : null}</div> : null}</section>

        <section className="rounded-lg border border-line bg-raised p-5"><h2 className="font-serif text-xl text-ink">Context & discipline</h2><p className="mb-5 text-sm text-muted">Link the trade to repeatable setups and preserve the facts that make review useful.</p><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Field label="Strategy" name="strategyId"><select id="strategyId" name="strategyId" value={v.strategyId} onChange={(e) => update("strategyId", e.target.value)} className="h-11 w-full rounded-md border border-line bg-raised px-3 text-sm text-ink"><option value="">Not set</option>{libraries.strategies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Playbook" name="playbookId"><select id="playbookId" name="playbookId" value={v.playbookId} onChange={(e) => update("playbookId", e.target.value)} className="h-11 w-full rounded-md border border-line bg-raised px-3 text-sm text-ink"><option value="">Not set</option>{libraries.playbooks.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Trading style" name="tradingStyle"><Input id="tradingStyle" name="tradingStyle" value={v.tradingStyle} onChange={(e) => update("tradingStyle", e.target.value)} placeholder="Intraday, swing…" /></Field><Field label="Platform" name="platform"><Input id="platform" name="platform" value={v.platform} onChange={(e) => update("platform", e.target.value)} placeholder="Zerodha, IBKR…" /></Field><Field label="Subcategory" name="subcategory"><Input id="subcategory" name="subcategory" value={v.subcategory} onChange={(e) => update("subcategory", e.target.value)} placeholder="Large cap, major pair…" /></Field><Field label="Confidence (1–5)" name="confidence" error={errors.confidence}><select id="confidence" name="confidence" value={v.confidence} onChange={(e) => update("confidence", e.target.value)} className="h-11 w-full rounded-md border border-line bg-raised px-3 text-sm text-ink"><option value="">Not set</option>{[1,2,3,4,5].map((n) => <option key={n} value={n}>{"★".repeat(n)}</option>)}</select></Field><Field label="Emotion" name="emotion"><select id="emotion" name="emotion" value={v.emotion} onChange={(e) => update("emotion", e.target.value)} className="h-11 w-full rounded-md border border-line bg-raised px-3 text-sm text-ink"><option value="">Not set</option>{emotions.map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Tags" name="tags" hint="Comma-separated"><Input id="tags" name="tags" defaultValue={initialText?.tags ?? ""} placeholder="breakout, A+ setup" /></Field></div>
          <fieldset className="mt-5 border-t border-line pt-5"><legend className="font-serif text-lg text-ink">Setup checklist</legend><p className="mt-1 text-sm text-muted">A compact process check stored with this trade—not a generic task list.</p><div className="mt-3 max-w-md"><Label htmlFor="checklistTemplate">Checklist template</Label><select id="checklistTemplate" value={templateId} onChange={(e) => applyChecklistTemplate(e.target.value)} className="mt-1.5 h-11 w-full rounded-md border border-line bg-raised px-3 text-sm text-ink"><option value="">No checklist</option>{libraries.checklistTemplates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div><input type="hidden" name="setupChecklist" value={JSON.stringify(setupChecklist)} /><div className="mt-4 grid gap-2 lg:grid-cols-2">{setupChecklist.map((item, index) => <label key={`${item.phase}-${item.id}`} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border border-line bg-page px-3 py-2.5 text-sm text-body hover:border-line-strong"><input type="checkbox" checked={item.completed} onChange={(e) => setSetupChecklist((current) => current.map((entry, itemIndex) => itemIndex === index ? { ...entry, completed: e.target.checked } : entry))} className="mt-0.5 size-4 accent-[var(--accent)]" /><span><span className="block">{item.label}</span><span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">{item.phase}</span></span></label>)}</div></fieldset>
          <div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Rule violations" name="ruleViolations"><textarea id="ruleViolations" name="ruleViolations" rows={3} defaultValue={initialText?.ruleViolations ?? ""} className="w-full rounded-md border border-line bg-raised p-3 text-sm text-ink" placeholder="Leave blank when rules were followed." /></Field><Field label="Linked note" name="linkedNote"><textarea id="linkedNote" name="linkedNote" rows={3} defaultValue={initialText?.linkedNote ?? ""} className="w-full rounded-md border border-line bg-raised p-3 text-sm text-ink" placeholder="Pre-trade thesis or journal link." /></Field></div><Field label="Trade notes" name="notes"><textarea id="notes" name="notes" rows={4} defaultValue={initialText?.notes ?? ""} className="w-full rounded-md border border-line bg-raised p-3 text-sm text-ink" placeholder="What made this trade worth taking?" /></Field></section>
      </div>

      <aside className="h-fit rounded-lg border border-line-strong bg-sidebar p-4 xl:sticky xl:top-24"><div className="mb-4 flex items-center gap-2"><span className="flex size-9 items-center justify-center rounded-md bg-accent-soft text-accent"><Calculator className="size-4" aria-hidden="true" /></span><div><h2 className="font-serif text-lg text-ink">Live risk preview</h2><p className="text-xs text-muted">{v.currency} only · never mixed</p></div></div><div className="grid grid-cols-2 gap-2"><Metric label="1R risk" value={money(evaluated.preview.plannedRisk)} sub="Entry → initial stop" /><Metric label="Planned R:R" value={evaluated.preview.plannedRewardRisk == null ? "—" : `${evaluated.preview.plannedRewardRisk.toFixed(2)}R`} sub="Target reward ÷ 1R" /><Metric label="Effective units" value={evaluated.preview.effectiveUnits?.toLocaleString() ?? "—"} sub="Quantity × multiplier" /><Metric label="Position value" value={money(evaluated.preview.positionValue)} sub="Before fees" /></div>{v.status === "closed" ? <div className="mt-3 rounded-md border border-line bg-page p-3"><p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Realized preview</p><p className={cn("mt-1 font-serif text-2xl tnum", (evaluated.preview.realizedPnl ?? 0) >= 0 ? "text-profit" : "text-loss")}>{money(evaluated.preview.realizedPnl)}</p><p className="text-xs text-muted">{evaluated.preview.realizedR == null ? "R unavailable without an initial stop" : `${evaluated.preview.realizedR.toFixed(2)}R realized`}</p></div> : null}<p className="mt-4 text-xs leading-relaxed text-muted">Risk uses the tested direction-aware engine. Fees are stored separately and are not silently folded into gross P&L.</p></aside>
    </div>

    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-page/95 p-3 backdrop-blur md:left-64"><div className="mx-auto flex max-w-[1540px] items-center justify-end gap-2"><Button asChild variant="ghost"><Link href={cancelHref}>Cancel</Link></Button>{isEdit ? <Button type="submit" name="intent" value="done" disabled={pending}>{pending ? "Saving…" : "Save changes"}</Button> : <><Button type="submit" name="intent" value="another" variant="secondary" disabled={pending}><Plus aria-hidden="true" />Save & add another</Button><Button type="submit" name="intent" value="done" disabled={pending}>{pending ? "Saving…" : "Save trade"}</Button></>}</div></div>
  </form>;
}
