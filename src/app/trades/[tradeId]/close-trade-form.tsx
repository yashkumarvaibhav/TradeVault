"use client";

import * as React from "react";
import { useActionState } from "react";
import { AlertCircle, Calculator, Check, LockKeyhole } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { evaluateTradeEntry } from "@/lib/domain/trade-entry";
import type { AssetClass, Currency, Direction, InstrumentType } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { DEFAULT_TIME_ZONE, zonedDateTimeToIso } from "@/lib/date-time";

import { closeTradeAction, type CloseTradeState } from "./actions";

export interface CloseTradeFacts {
  id: string;
  symbol: string;
  assetClass: AssetClass;
  instrumentType: InstrumentType;
  direction: Direction;
  currency: Currency;
  entryAt: string;
  entryPrice: number;
  quantity: number;
  multiplier: number;
  stopLoss: number | null;
  plannedTarget: number | null;
  fxToAccount: number;
  fees: number;
}

const numberOrNull = (value: string) => (value.trim() === "" ? null : Number(value));

function Field({ label, name, error, hint, children }: { label: string; name: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      {children}
      {error ? <p id={`${name}-error`} className="text-xs text-danger">{error}</p> : hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function CloseTradeForm({
  trade,
  closeReasons,
  defaultExitAt,
  timeZone = DEFAULT_TIME_ZONE,
}: {
  trade: CloseTradeFacts;
  closeReasons: Array<{ id: string; name: string }>;
  defaultExitAt: string;
  timeZone?: string;
}) {
  const [state, formAction, pending] = useActionState<CloseTradeState, FormData>(closeTradeAction, {});
  const [exitAt, setExitAt] = React.useState(defaultExitAt);
  const [exitPrice, setExitPrice] = React.useState("");
  const [manualPnl, setManualPnl] = React.useState("");
  const [fees, setFees] = React.useState(String(trade.fees));
  const [mfePrice, setMfePrice] = React.useState("");
  const [maePrice, setMaePrice] = React.useState("");
  const isForex = trade.assetClass === "Forex";

  const evaluated = evaluateTradeEntry({
    symbol: trade.symbol,
    assetClass: trade.assetClass,
    instrumentType: trade.instrumentType,
    direction: trade.direction,
    status: "closed",
    currency: trade.currency,
    entryAt: trade.entryAt,
    entryPrice: trade.entryPrice,
    exitAt: exitAt ? (zonedDateTimeToIso(exitAt, timeZone) ?? exitAt) : null,
    exitPrice: numberOrNull(exitPrice),
    quantity: trade.quantity,
    multiplier: trade.multiplier,
    stopLoss: trade.stopLoss,
    plannedTarget: trade.plannedTarget,
    manualPnl: numberOrNull(manualPnl),
    fees: Number(fees) || 0,
    fxToAccount: trade.fxToAccount,
    mfePrice: numberOrNull(mfePrice),
    maePrice: numberOrNull(maePrice),
  });
  const errors = state.fieldErrors ?? {};
  const money = (amount: number | null) =>
    amount == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: trade.currency, maximumFractionDigits: trade.currency === "INR" ? 0 : 2 }).format(amount);
  const pnl = evaluated.preview.realizedPnl;
  const hasExit = exitPrice.trim() !== "" || manualPnl.trim() !== "";

  return (
    <form action={formAction} className="mt-6 rounded-lg border border-line-strong bg-accent-soft p-5" noValidate>
      <input type="hidden" name="tradeId" value={trade.id} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl text-ink">Close this trade</h2>
          <p className="mt-1 text-sm text-muted">Record the exit. Realized P&amp;L and R are computed in {trade.currency} only — never mixed across currencies.</p>
        </div>
        <Button type="submit" disabled={pending}><LockKeyhole aria-hidden="true" />{pending ? "Closing…" : "Close trade"}</Button>
      </div>

      {state.error ? (
        <div role="alert" className="mt-4 flex items-start gap-2 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4" aria-hidden="true" />
          <span>{state.error}</span>
        </div>
      ) : null}

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Exit date & time" name="exitAt" error={errors.exitAt} hint={`${timeZone} · change under Settings`}>
            <Input id="exitAt" name="exitAt" type="datetime-local" value={exitAt} onChange={(e) => setExitAt(e.target.value)} aria-invalid={!!errors.exitAt} />
          </Field>
          <Field label="Exit price" name="exitPrice" error={errors.exitPrice} hint={isForex ? "Optional if you enter a manual P&L below." : undefined}>
            <Input id="exitPrice" name="exitPrice" type="number" step="any" value={exitPrice} onChange={(e) => setExitPrice(e.target.value)} aria-invalid={!!errors.exitPrice} />
          </Field>
          {isForex ? (
            <Field label="Manual P&L fallback" name="manualPnl" error={errors.manualPnl} hint="Signed amount in the selected currency; overrides price-based P&L.">
              <Input id="manualPnl" name="manualPnl" type="number" step="any" value={manualPnl} onChange={(e) => setManualPnl(e.target.value)} aria-invalid={!!errors.manualPnl} />
            </Field>
          ) : null}
          <Field label="Fees / commission" name="fees" error={errors.fees} hint="Total fees for the trade; stored separately from gross P&L.">
            <Input id="fees" name="fees" type="number" min="0" step="any" value={fees} onChange={(e) => setFees(e.target.value)} aria-invalid={!!errors.fees} />
          </Field>
          <Field label="Close reason" name="closeReasonId">
            <select id="closeReasonId" name="closeReasonId" className="h-11 w-full rounded-md border border-line bg-raised px-3 text-sm text-ink">
              <option value="">Not set</option>
              {closeReasons.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </Field>
          <Field label="Maximum favorable price" name="mfePrice" error={errors.mfePrice ?? evaluated.errors.mfePrice} hint={`${trade.direction === "Long" ? "Highest" : "Lowest"} observed price while open · optional manual evidence.`}>
            <Input id="mfePrice" name="mfePrice" type="number" min="0" step="any" value={mfePrice} onChange={(e) => setMfePrice(e.target.value)} aria-invalid={!!(errors.mfePrice ?? evaluated.errors.mfePrice)} />
          </Field>
          <Field label="Maximum adverse price" name="maePrice" error={errors.maePrice ?? evaluated.errors.maePrice} hint={`${trade.direction === "Long" ? "Lowest" : "Highest"} observed price while open · optional manual evidence.`}>
            <Input id="maePrice" name="maePrice" type="number" min="0" step="any" value={maePrice} onChange={(e) => setMaePrice(e.target.value)} aria-invalid={!!(errors.maePrice ?? evaluated.errors.maePrice)} />
          </Field>
        </div>

        <aside className="h-fit rounded-md border border-line bg-page p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-md bg-accent-soft text-accent"><Calculator className="size-4" aria-hidden="true" /></span>
            <div><p className="font-serif text-base text-ink">Close preview</p><p className="text-[11px] text-muted">{trade.currency} only · never mixed</p></div>
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Realized P&amp;L</p>
          <p className={cn("mt-1 font-serif text-3xl tnum", !hasExit ? "text-muted" : (pnl ?? 0) >= 0 ? "text-profit" : "text-loss")}>
            {hasExit ? money(pnl) : "—"}
          </p>
          <p className="mt-1 text-xs text-muted">
            {!hasExit
              ? "Enter an exit price to preview."
              : evaluated.preview.realizedR == null
                ? "R unavailable without an initial stop."
                : `${evaluated.preview.realizedR.toFixed(2)}R realized`}
          </p>
          <p className="mt-3 border-t border-line pt-3 text-[11px] leading-relaxed text-muted">Uses the same tested, direction-aware engine as Add Trade. Fees are not folded into gross P&amp;L.</p>
          <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 text-center"><div><dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">MFE</dt><dd className="tnum mt-1 text-sm font-semibold text-ink">{evaluated.preview.mfeR == null ? "—" : `${evaluated.preview.mfeR.toFixed(2)}R`}</dd></div><div><dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">MAE</dt><dd className="tnum mt-1 text-sm font-semibold text-ink">{evaluated.preview.maeR == null ? "—" : `${evaluated.preview.maeR.toFixed(2)}R`}</dd></div><div><dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">Capture</dt><dd className="tnum mt-1 text-sm font-semibold text-ink">{evaluated.preview.capturedMovePct == null ? "—" : `${evaluated.preview.capturedMovePct.toFixed(0)}%`}</dd></div></dl>
        </aside>
      </div>

      <div className="mt-5">
        <Field label="Closing note (optional)" name="notes" hint="Appends or replaces the trade note. Leave blank to keep the existing note.">
          <textarea id="notes" name="notes" rows={3} className="w-full rounded-md border border-line bg-raised p-3 text-sm text-ink" placeholder="Why did you exit here?" />
        </Field>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button asChild variant="ghost"><Link href={`/trades/${trade.id}`}>Cancel</Link></Button>
        <Button type="submit" disabled={pending}><Check aria-hidden="true" />{pending ? "Closing…" : "Close trade"}</Button>
      </div>
    </form>
  );
}
