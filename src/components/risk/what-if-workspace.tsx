"use client";

import * as React from "react";
import { AlertTriangle, RotateCcw, Sparkles } from "lucide-react";

import { WhatIfEquityChart } from "@/components/charts/what-if-equity-chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buildRiskWhatIf, type RiskWhatIfMetrics, type RiskWhatIfSample, type RiskWhatIfSettings } from "@/lib/domain/risk-what-if";
import { RISK_SIM_MIN_SAMPLE } from "@/lib/domain/risk-sim";
import type { Currency } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

const DEFAULT_SETTINGS: RiskWhatIfSettings = {
  lossCapR: null,
  winnerExtensionPct: 0,
  minQuality: null,
  playbook: null,
  ruleFilter: "all",
  frequencyPct: 100,
  feesR: 0,
};

const PRESETS: { label: string; description: string; settings: Partial<RiskWhatIfSettings> }[] = [
  { label: "Cut losses", description: "Cap each loss at −1R", settings: { lossCapR: 1 } },
  { label: "Let winners run", description: "Extend every winner 25%", settings: { winnerExtensionPct: 25 } },
  { label: "Clean setups", description: "Quality 4+ and rules followed", settings: { minQuality: 4, ruleFilter: "followed" } },
  { label: "Cost stress", description: "80% frequency and −0.10R fees", settings: { frequencyPct: 80, feesR: 0.1 } },
];

function signedR(value: number, digits = 2): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}R`;
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function ratio(value: number | null): string {
  return value == null ? "—" : `${value.toFixed(2)}×`;
}

function RangeControl({ id, label, valueLabel, value, min, max, step, onChange }: {
  id: string;
  label: string;
  valueLabel: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label htmlFor={id} className="block rounded-md border border-line bg-raised px-3 py-2.5">
      <span className="flex items-center justify-between gap-3 text-xs font-semibold text-ink"><span>{label}</span><output htmlFor={id} className="tnum text-accent">{valueLabel}</output></span>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="h-11 w-full cursor-pointer accent-[var(--accent)]" />
    </label>
  );
}

function FilterSelect({ id, label, value, onChange, children }: { id: string; label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="h-11 w-full"><SelectValue /></SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </label>
  );
}

function ComparisonMetric({ label, baseline, scenario, delta, positiveIsGood = true }: { label: string; baseline: string; scenario: string; delta: number | null; positiveIsGood?: boolean }) {
  const good = delta != null && (positiveIsGood ? delta >= 0 : delta <= 0);
  return (
    <Card className="min-w-0">
      <CardContent className="p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted">{label}</p>
        <p className="tnum mt-2 font-serif text-2xl text-ink">{scenario}</p>
        <p className="mt-1 text-xs text-muted">Baseline {baseline}</p>
        <p className={cn("tnum mt-2 text-xs font-semibold", delta == null ? "text-muted" : good ? "text-profit" : "text-loss")}>{delta == null ? "No comparable delta" : `${delta >= 0 ? "+" : ""}${delta.toFixed(label === "Win rate" ? 1 : 2)}${label === "Win rate" ? " pp" : ""}`}</p>
      </CardContent>
    </Card>
  );
}

function compareCards(baseline: RiskWhatIfMetrics, scenario: RiskWhatIfMetrics, delta: RiskWhatIfMetrics) {
  return [
    <ComparisonMetric key="net" label="Net P&L (R)" baseline={signedR(baseline.netR, 1)} scenario={signedR(scenario.netR, 1)} delta={delta.netR} />,
    <ComparisonMetric key="win" label="Win rate" baseline={pct(baseline.winRate)} scenario={pct(scenario.winRate)} delta={delta.winRate * 100} />,
    <ComparisonMetric key="pf" label="Profit factor" baseline={ratio(baseline.profitFactor)} scenario={ratio(scenario.profitFactor)} delta={delta.profitFactor} />,
    <ComparisonMetric key="exp" label="Expectancy" baseline={signedR(baseline.expectancyR)} scenario={signedR(scenario.expectancyR)} delta={delta.expectancyR} />,
    <ComparisonMetric key="payoff" label="Payoff" baseline={ratio(baseline.payoffRatio)} scenario={ratio(scenario.payoffRatio)} delta={delta.payoffRatio} />,
  ];
}

export function WhatIfWorkspace({ samples, currency }: { samples: RiskWhatIfSample[]; currency: Currency }) {
  const [settings, setSettings] = React.useState<RiskWhatIfSettings>(DEFAULT_SETTINGS);
  const result = React.useMemo(() => buildRiskWhatIf({ samples, currency, settings }), [samples, currency, settings]);
  const playbooks = React.useMemo(() => [...new Set(samples.map((sample) => sample.playbook).filter((name): name is string => Boolean(name)))].sort(), [samples]);
  const set = <K extends keyof RiskWhatIfSettings>(key: K, value: RiskWhatIfSettings[K]) => setSettings((current) => ({ ...current, [key]: value }));
  const reset = () => setSettings(DEFAULT_SETTINGS);
  const applyPreset = (preset: Partial<RiskWhatIfSettings>) => setSettings({ ...DEFAULT_SETTINGS, ...preset });

  if (samples.length < RISK_SIM_MIN_SAMPLE) {
    return (
      <Card><CardContent className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        <Sparkles className="size-8 text-muted" aria-hidden="true" />
        <h2 className="font-serif text-2xl text-ink">Not enough closed {currency} trades for What-If</h2>
        <p className="max-w-md text-sm text-muted">What-If needs at least <strong className="text-ink">{RISK_SIM_MIN_SAMPLE}</strong> single-currency trades with a computable R. You have <strong className="text-ink">{samples.length}</strong>.</p>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div><CardTitle>Build a transparent scenario</CardTitle><CardDescription>Every control derives a new R sequence from your {samples.length} closed {currency} trades. Nothing writes back to the journal.</CardDescription></div>
          <Button type="button" variant="ghost" size="compact" onClick={reset}><RotateCcw aria-hidden="true" />Reset</Button>
        </CardHeader>
        <CardContent className="space-y-5">
          <fieldset>
            <legend className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Quick scenarios</legend>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {PRESETS.map((preset) => (
                <button key={preset.label} type="button" onClick={() => applyPreset(preset.settings)} className="min-h-14 rounded-md border border-line bg-raised px-3 py-2 text-left transition-colors hover:border-accent/50 hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
                  <span className="block text-sm font-semibold text-ink">{preset.label}</span><span className="mt-0.5 block text-xs text-muted">{preset.description}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Outcome transforms</legend>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <RangeControl id="what-if-loss-cap" label="Loss cap" valueLabel={settings.lossCapR == null ? "Off" : `−${settings.lossCapR.toFixed(2)}R`} value={settings.lossCapR ?? 0} min={0} max={3} step={0.25} onChange={(value) => set("lossCapR", value === 0 ? null : value)} />
              <RangeControl id="what-if-winner-extension" label="Extend winners" valueLabel={`+${settings.winnerExtensionPct}%`} value={settings.winnerExtensionPct} min={0} max={100} step={5} onChange={(value) => set("winnerExtensionPct", value)} />
              <RangeControl id="what-if-frequency" label="Trade frequency" valueLabel={`${settings.frequencyPct}%`} value={settings.frequencyPct} min={50} max={150} step={10} onChange={(value) => set("frequencyPct", value)} />
              <RangeControl id="what-if-fees" label="Extra fees / trade" valueLabel={`−${settings.feesR.toFixed(2)}R`} value={settings.feesR} min={0} max={0.5} step={0.05} onChange={(value) => set("feesR", value)} />
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Evidence filters</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              <FilterSelect id="what-if-quality" label="Recorded quality" value={settings.minQuality == null ? "all" : String(settings.minQuality)} onChange={(value) => set("minQuality", value === "all" ? null : Number(value))}>
                <SelectItem value="all">All recorded trades</SelectItem><SelectItem value="3">Quality 3+</SelectItem><SelectItem value="4">Quality 4+</SelectItem><SelectItem value="5">Quality 5</SelectItem>
              </FilterSelect>
              <FilterSelect id="what-if-playbook" label="Playbook" value={settings.playbook ?? "all"} onChange={(value) => set("playbook", value === "all" ? null : value)}>
                <SelectItem value="all">All playbooks</SelectItem>{playbooks.map((playbook) => <SelectItem key={playbook} value={playbook}>{playbook}</SelectItem>)}
              </FilterSelect>
              <FilterSelect id="what-if-rule" label="Rule follow" value={settings.ruleFilter} onChange={(value) => set("ruleFilter", value as RiskWhatIfSettings["ruleFilter"])}>
                <SelectItem value="all">All reviewed states</SelectItem><SelectItem value="followed">Rules followed</SelectItem><SelectItem value="violated">Rule violation recorded</SelectItem>
              </FilterSelect>
            </div>
            <p className="mt-2 text-xs text-muted">Quality uses the recorded 1–5 confidence field. Rule filters only include reviewed trades with explicit evidence; unknowns are not treated as compliant.</p>
          </fieldset>
        </CardContent>
      </Card>

      {!result.ok ? (
        <div className="flex items-start gap-3 rounded-lg border border-line bg-sidebar p-4" role="status" aria-live="polite">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
          <div><p className="text-sm font-semibold text-ink">Scenario needs a broader sample</p><p className="mt-1 text-sm text-muted">{result.message}</p></div>
        </div>
      ) : (
        <>
          <div className="flex items-start gap-3 rounded-lg border border-line bg-accent-soft/40 p-4" aria-live="polite">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" /><p className="text-sm leading-relaxed text-ink">{result.insight}</p>
          </div>
          <Card>
            <CardHeader className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div><CardTitle>Baseline vs scenario</CardTitle><CardDescription>Chronological realized-R replay · dashed baseline · solid transformed scenario</CardDescription></div>
              <div className="flex items-center gap-2"><Chip tone="accent">{currency}</Chip><Chip tone={result.delta.netR >= 0 ? "profit" : "loss"}>{signedR(result.delta.netR, 1)} delta</Chip></div>
            </CardHeader>
            <CardContent><WhatIfEquityChart baseline={result.baselineEquity} scenario={result.scenarioEquity} currency={currency} /></CardContent>
          </Card>
          <section aria-labelledby="what-if-comparison-title">
            <div className="mb-2 flex flex-wrap items-end justify-between gap-2"><div><h2 id="what-if-comparison-title" className="font-serif text-xl text-ink">Comparison</h2><p className="text-xs text-muted">Scenario {result.scenario.sampleSize} trades · baseline {result.baseline.sampleSize} trades · all values in R</p></div></div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">{compareCards(result.baseline, result.scenario, result.delta)}</div>
          </section>
          <p className="text-xs text-muted">{result.label}. Filters and transforms apply only to this derived {currency} R sequence; source trades are never modified.</p>
        </>
      )}
    </div>
  );
}
