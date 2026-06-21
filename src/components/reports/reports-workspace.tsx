"use client";

import * as React from "react";
import { Download, FileJson, FileText, RotateCcw, ShieldCheck, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { BarChart } from "@/components/charts/bar-chart";
import { EquityChart } from "@/components/charts/equity-chart";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control";
import { toast } from "@/components/ui/toaster";
import type { CurrencyAnalytics, CurrencyAnalyticsMap } from "@/lib/domain/analytics";
import type { Currency } from "@/lib/domain/types";
import { formatDateInTimeZone } from "@/lib/date-time";
import { ASSET_OPTIONS, PERIOD_OPTIONS, scopeHref, scopePeriodLabel, type DashboardScope } from "@/lib/trade-scope";
import { cn } from "@/lib/utils";

import { authorizeSensitiveAction } from "@/app/reports/actions";

function moneyFormatter(currency: Currency) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: currency === "INR" ? 0 : 2 });
}

function ReportKpi({ label, value, detail, tone }: { label: string; value: string; detail: string; tone?: "profit" | "loss" }) {
  return (
    <div className="rounded-md border border-line bg-page p-4">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">{label}</dt>
      <dd className={cn("tnum mt-2 font-serif text-2xl font-medium text-ink", tone === "profit" && "text-profit", tone === "loss" && "text-loss")}>{value}</dd>
      <dd className="mt-1 text-xs text-muted">{detail}</dd>
    </div>
  );
}

function ReportPreview({ data, currency, accountName, period, generatedAt, timeZone }: { data: CurrencyAnalytics; currency: Currency; accountName: string; period: string; generatedAt: string; timeZone: string }) {
  const money = moneyFormatter(currency);
  const equity = data.equityCurve.map((point) => ({ label: point.date.slice(5), value: point.cumulative }));
  const monthly = data.monthlyPnl.map((point) => ({ label: point.month.slice(2), value: point.pnl }));
  const weekday = data.weekdayPnl.map((point) => ({ label: point.weekday, value: point.pnl }));
  const maxSymbolAbs = Math.max(1, ...data.symbolLeaderboard.map((row) => Math.abs(row.pnl)));

  return (
    <article className="report-preview rounded-lg border border-line bg-raised p-5 shadow-[var(--shadow-sm)] sm:p-8" aria-label={`${currency} performance report preview`}>
      <header className="flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">TradeVault performance report</p>
          <h2 className="mt-2 font-serif text-3xl font-medium text-ink">{accountName}</h2>
          <p className="mt-1 text-sm text-muted">{period} · closed trades · {currency} only</p>
        </div>
        <div className="text-left text-xs leading-relaxed text-muted sm:text-right">
          <Chip tone="accent">{currency}</Chip>
          <p className="mt-2">Generated {formatDateInTimeZone(generatedAt, timeZone, { dateStyle: "medium", timeStyle: "short" })}</p>
          <p>{data.totalTrades} closed trades in sample</p>
        </div>
      </header>

      <dl className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <ReportKpi label="Net P&L" value={money.format(data.netPnl)} detail={`${currency} · never cross-currency`} tone={data.netPnl >= 0 ? "profit" : "loss"} />
        <ReportKpi label="Win rate" value={`${data.winPct.toFixed(1)}%`} detail={`${data.winningTrades} wins · ${data.losingTrades} losses`} />
        <ReportKpi label="Profit factor" value={data.profitFactor == null ? "—" : data.profitFactor.toFixed(2)} detail="Gross profit ÷ gross loss" />
        <ReportKpi label="Expectancy" value={money.format(data.expectancy)} detail={`${currency} per closed trade`} tone={data.expectancy >= 0 ? "profit" : "loss"} />
      </dl>

      <section className="mt-6 border-t border-line pt-6" aria-labelledby="report-equity-title">
        <h3 id="report-equity-title" className="font-serif text-xl font-medium text-ink">Equity curve</h3>
        <p className="mt-1 text-xs text-muted">Cumulative closed-trade P&amp;L · {currency}</p>
        <div className="mt-3"><EquityChart points={equity} currency={currency} /></div>
      </section>

      <section className="mt-6 grid gap-6 border-t border-line pt-6 xl:grid-cols-2">
        <div>
          <h3 className="font-serif text-xl font-medium text-ink">Monthly P&amp;L</h3>
          <p className="mt-1 text-xs text-muted">Closed trades · {currency}</p>
          <div className="mt-3"><BarChart data={monthly} metric="Monthly net P&L" unit={currency} scope={period} sampleSize={data.totalTrades} formatValue={money.format} /></div>
        </div>
        <div>
          <h3 className="font-serif text-xl font-medium text-ink">Weekday performance</h3>
          <p className="mt-1 text-xs text-muted">Net P&amp;L by outcome day · {currency}</p>
          <div className="mt-3"><BarChart data={weekday} metric="Net P&L by weekday" unit={currency} scope={period} sampleSize={data.totalTrades} formatValue={money.format} /></div>
        </div>
      </section>

      <section className="mt-6 grid gap-6 border-t border-line pt-6 lg:grid-cols-[1fr_1.3fr]">
        <div>
          <h3 className="font-serif text-xl font-medium text-ink">Risk snapshot</h3>
          <dl className="mt-3 grid grid-cols-2 gap-3">
            {[
              ["Max drawdown", money.format(data.maxDrawdown)],
              ["Avg realized R", `${data.avgRealizedR >= 0 ? "+" : ""}${data.avgRealizedR.toFixed(2)}R`],
              ["Avg win", money.format(data.avgWin)],
              ["Avg loss", money.format(data.avgLoss)],
            ].map(([label, value]) => <div key={label} className="rounded-md border border-line bg-page p-3"><dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{label}</dt><dd className="tnum mt-1 text-sm font-semibold text-ink">{value}</dd></div>)}
          </dl>
        </div>
        <div>
          <h3 className="font-serif text-xl font-medium text-ink">Top symbols</h3>
          <div className="mt-3 space-y-3">
            {data.symbolLeaderboard.slice(0, 6).map((row) => (
              <div key={row.symbol} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <div className="min-w-0">
                  <div className="flex justify-between gap-2 text-xs"><span className="font-semibold text-ink">{row.symbol}</span><span className="text-muted">{row.count} trades · {row.winPct.toFixed(0)}%</span></div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-sidebar"><div className={cn("h-full rounded-full", row.pnl >= 0 ? "bg-profit" : "bg-loss")} style={{ width: `${Math.abs(row.pnl) / maxSymbolAbs * 100}%` }} /></div>
                </div>
                <span className={cn("tnum text-sm font-semibold", row.pnl >= 0 ? "text-profit" : "text-loss")}>{money.format(row.pnl)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
      <footer className="mt-8 border-t border-line pt-4 text-xs leading-relaxed text-muted">This report isolates {currency}. INR and USD are never summed raw. Metrics use closed trades with a computable result in the selected account and period.</footer>
    </article>
  );
}

function ImportControl({ onSelect }: { onSelect: (file: File) => void }) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <>
      <input ref={inputRef} className="sr-only" type="file" accept="application/json,.json" aria-label="Choose TradeVault JSON export to import" onChange={(event) => { const file = event.target.files?.[0]; if (file) onSelect(file); event.currentTarget.value = ""; }} />
      <Button type="button" variant="outline" className="w-full" onClick={() => inputRef.current?.click()}><Upload aria-hidden="true" />Import JSON</Button>
    </>
  );
}

type SensitiveIntent =
  | { kind: "pdf"; href: string }
  | { kind: "export" }
  | { kind: "import"; file: File };

function intentCopy(intent: SensitiveIntent | null): { title: string; action: string } {
  if (intent?.kind === "pdf") return { title: "Download PDF report", action: "Verify & download PDF" };
  if (intent?.kind === "export") return { title: "Export private JSON", action: "Verify & export JSON" };
  return { title: "Import private JSON", action: "Verify & import JSON" };
}

function SensitiveActionDialog({
  intent,
  onClose,
  onAuthorized,
}: {
  intent: SensitiveIntent | null;
  onClose: () => void;
  onAuthorized: (intent: SensitiveIntent) => Promise<void> | void;
}) {
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string>();
  const copy = intentCopy(intent);

  return (
    <Dialog open={Boolean(intent)} onOpenChange={(open) => { if (!open && !pending) { setError(undefined); onClose(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>Confirm your current password, then the 6-digit code from your authenticator. Authorization lasts for two minutes on this signed-in device.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!intent) return;
            const form = new FormData(event.currentTarget);
            setError(undefined);
            startTransition(async () => {
              const result = await authorizeSensitiveAction(String(form.get("password") ?? ""), String(form.get("code") ?? ""));
              if (!result.ok) { setError(result.error); return; }
              const authorizedIntent = intent;
              setError(undefined);
              onClose();
              await onAuthorized(authorizedIntent);
            });
          }}
          noValidate
        >
          {error ? <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}
          <div className="space-y-1.5">
            <Label htmlFor="sensitive-password">Current password</Label>
            <Input id="sensitive-password" name="password" type="password" autoComplete="current-password" autoFocus required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sensitive-code">Authenticator code</Label>
            <Input id="sensitive-code" name="code" inputMode="numeric" autoComplete="one-time-code" className="tnum" required />
          </div>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline" disabled={pending}>Cancel</Button></DialogClose>
            <Button type="submit" disabled={pending}>{pending ? "Verifying…" : copy.action}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ReportsWorkspace({ accountName, defaultCurrency, analyticsByCurrency, scope, timeZone, generatedAt }: { accountName: string; defaultCurrency: Currency; analyticsByCurrency: CurrencyAnalyticsMap; scope: DashboardScope; timeZone: string; generatedAt: string }) {
  const router = useRouter();
  const availableDefault = analyticsByCurrency[defaultCurrency] ? defaultCurrency : analyticsByCurrency.INR ? "INR" : analyticsByCurrency.USD ? "USD" : defaultCurrency;
  const [currency, setCurrency] = React.useState<Currency>(availableDefault);
  const [sensitiveIntent, setSensitiveIntent] = React.useState<SensitiveIntent | null>(null);
  const data = analyticsByCurrency[currency];
  const tradeCount = data?.totalTrades ?? 0;
  const scopeActive = scope.period !== "all" || scope.asset !== "Overall";

  // Link to the server-generated PDF for the active scope + currency. The PDF is
  // rendered identically regardless of the viewer's theme/device, unlike browser
  // print which followed the live (possibly dark, possibly mobile) page.
  const pdfParams = new URLSearchParams();
  if (scope.period !== "all") pdfParams.set("period", scope.period);
  if (scope.period === "custom") {
    if (scope.from) pdfParams.set("from", scope.from);
    if (scope.to) pdfParams.set("to", scope.to);
  }
  if (scope.asset !== "Overall") pdfParams.set("asset", scope.asset);
  pdfParams.set("currency", currency);
  const pdfHref = `/api/reports/pdf?${pdfParams.toString()}`;

  function download(href: string) {
    const link = document.createElement("a");
    link.href = href;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  async function runAuthorized(intent: SensitiveIntent) {
    if (intent.kind === "pdf") { download(intent.href); return; }
    if (intent.kind === "export") { download("/api/data-transfer/export"); return; }

    const form = new FormData();
    form.set("file", intent.file);
    try {
      const response = await fetch("/api/data-transfer/import", { method: "POST", body: form });
      const payload = await response.json() as { error?: string; details?: string[]; summary?: { trades: { imported: number; skipped: number }; notes: { imported: number; skipped: number } } };
      if (!response.ok || !payload.summary) throw new Error([payload.error, ...(payload.details ?? [])].filter(Boolean).join(" ") || "Import failed.");
      toast.success("Import complete", { description: `${payload.summary.trades.imported} trades and ${payload.summary.notes.imported} notes added. ${payload.summary.trades.skipped} duplicate trades skipped.` });
      router.refresh();
    } catch (error) {
      toast.error("Import not applied", { description: error instanceof Error ? error.message : "The file could not be imported." });
    }
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <div className="print-hidden">
        <PageHeader eyebrow={<><Chip tone="accent">Reports</Chip><Chip>{tradeCount} closed trades · {currency}</Chip></>} title="Reports & backups" description="Download a polished PDF performance report, export a private JSON backup, or restore a TradeVault v1–v3 export." actions={scopeActive ? <Button asChild variant="outline" size="compact"><Link href="/reports"><RotateCcw aria-hidden="true" />Reset scope</Link></Button> : undefined} />
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[19rem_minmax(0,1fr)]">
        <aside className="print-hidden space-y-4 xl:sticky xl:top-24" aria-label="Report configuration">
          <Card>
            <CardHeader><div><CardTitle>Report setup</CardTitle><CardDescription>Preview updates from the URL scope.</CardDescription></div></CardHeader>
            <CardContent className="space-y-5">
              <div><p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Account</p><p className="mt-1 text-sm font-semibold text-ink">{accountName}</p></div>
              <fieldset>
                <legend className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Period</legend>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {PERIOD_OPTIONS.map((option) => <Link key={option.value} href={scopeHref("/reports", scope, { period: option.value })} aria-current={scope.period === option.value ? "true" : undefined} className={cn("inline-flex min-h-10 items-center justify-center rounded-md border px-2 text-center text-xs font-semibold", scope.period === option.value ? "border-line-strong bg-accent-soft text-ink" : "border-line bg-raised text-muted hover:bg-hover")}>{option.label}</Link>)}
                </div>
                <details className="mt-2" open={scope.period === "custom"}>
                  <summary className="cursor-pointer text-xs font-semibold text-accent">Custom range</summary>
                  <form action="/reports" className="mt-2 space-y-2">
                    <input type="hidden" name="period" value="custom" />
                    {scope.asset !== "Overall" ? <input type="hidden" name="asset" value={scope.asset} /> : null}
                    <label className="block text-xs font-semibold text-muted">From<input className="mt-1 h-10 w-full rounded-md border border-line bg-raised px-2 text-sm" type="date" name="from" required defaultValue={scope.from} /></label>
                    <label className="block text-xs font-semibold text-muted">To<input className="mt-1 h-10 w-full rounded-md border border-line bg-raised px-2 text-sm" type="date" name="to" required defaultValue={scope.to} /></label>
                    <Button type="submit" variant="outline" size="compact" className="w-full">Apply range</Button>
                  </form>
                  {scope.rangeError ? <p role="alert" className="mt-2 text-xs font-semibold text-danger">{scope.rangeError}</p> : null}
                </details>
              </fieldset>
              <form action="/reports">
                {scope.period !== "all" ? <input type="hidden" name="period" value={scope.period} /> : null}
                {scope.period === "custom" && scope.from ? <input type="hidden" name="from" value={scope.from} /> : null}
                {scope.period === "custom" && scope.to ? <input type="hidden" name="to" value={scope.to} /> : null}
                <label className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Asset<select name="asset" defaultValue={scope.asset} onChange={(event) => event.currentTarget.form?.requestSubmit()} className="mt-2 h-11 w-full rounded-md border border-line bg-raised px-3 text-sm font-normal normal-case tracking-normal text-ink">{ASSET_OPTIONS.map((item) => <option key={item}>{item}</option>)}</select></label>
              </form>
              <fieldset><legend className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Currency</legend><SegmentedControl type="single" value={currency} onValueChange={(value) => value && setCurrency(value as Currency)} aria-label="Report currency" className="mt-2 w-full"><SegmentedControlItem value="INR" className="flex-1">INR</SegmentedControlItem><SegmentedControlItem value="USD" className="flex-1">USD</SegmentedControlItem></SegmentedControl></fieldset>
              <div className="rounded-md border border-line bg-sidebar p-3"><p className="text-xs font-semibold text-ink">{tradeCount} closed trades</p><p className="mt-1 text-xs leading-relaxed text-muted">{scopePeriodLabel(scope)} · {scope.asset} · {currency}</p></div>
              {data ? (
                <Button type="button" className="w-full" onClick={() => setSensitiveIntent({ kind: "pdf", href: pdfHref })}><FileText aria-hidden="true" />Download PDF report</Button>
              ) : (
                <Button type="button" className="w-full" disabled><FileText aria-hidden="true" />Download PDF report</Button>
              )}
              <p className="text-xs leading-relaxed text-muted">A4 portrait · {currency} only · the same polished layout on every device, light or dark.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><div><CardTitle>Private data</CardTitle><CardDescription>Portable JSON, scoped to this account.</CardDescription></div><ShieldCheck className="size-5 text-accent" aria-hidden="true" /></CardHeader>
            <CardContent className="space-y-2">
              <Button type="button" variant="secondary" className="w-full" onClick={() => setSensitiveIntent({ kind: "export" })}><Download aria-hidden="true" />Export JSON</Button>
              <ImportControl onSelect={(file) => setSensitiveIntent({ kind: "import", file })} />
              <p className="pt-2 text-xs leading-relaxed text-muted"><FileJson className="mr-1 inline size-3.5" aria-hidden="true" />No passwords, sessions, TOTP secrets, internal IDs, or attachment files are included. Attachment counts are retained.</p>
            </CardContent>
          </Card>
        </aside>

        <main className="min-w-0">
          {data ? <ReportPreview key={currency} data={data} currency={currency} accountName={accountName} period={`${scopePeriodLabel(scope)} · ${scope.asset}`} generatedAt={generatedAt} timeZone={timeZone} /> : <Card className="report-preview"><CardContent className="px-6 py-20 text-center"><h2 className="font-serif text-2xl text-ink">No closed {currency} trades in this scope.</h2><p className="mt-2 text-sm text-muted">Switch currency or widen the report period. Currency totals are never combined.</p></CardContent></Card>}
        </main>
      </div>
      <SensitiveActionDialog intent={sensitiveIntent} onClose={() => setSensitiveIntent(null)} onAuthorized={runAuthorized} />
    </div>
  );
}
