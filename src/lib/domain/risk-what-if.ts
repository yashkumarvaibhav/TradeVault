import { RISK_SIM_LABEL, RISK_SIM_MIN_SAMPLE } from "./risk-sim";
import type { Currency } from "./types";

/** Minimal, non-monetary evidence required by Risk Studio's What-If filters. */
export interface RiskWhatIfSample {
  r: number;
  currency: Currency;
  quality: number | null;
  playbook: string | null;
  ruleFollowed: boolean | null;
}

export interface RiskWhatIfSettings {
  lossCapR: number | null;
  winnerExtensionPct: number;
  minQuality: number | null;
  playbook: string | null;
  ruleFilter: "all" | "followed" | "violated";
  frequencyPct: number;
  feesR: number;
}

export interface RiskWhatIfMetrics {
  sampleSize: number;
  netR: number;
  winRate: number;
  profitFactor: number | null;
  expectancyR: number;
  payoffRatio: number | null;
}

export interface RiskWhatIfResult {
  ok: true;
  label: typeof RISK_SIM_LABEL;
  currency: Currency;
  baseline: RiskWhatIfMetrics;
  scenario: RiskWhatIfMetrics;
  delta: RiskWhatIfMetrics;
  baselineEquity: { step: number; valueR: number }[];
  scenarioEquity: { step: number; valueR: number }[];
  transformedR: number[];
  settings: RiskWhatIfSettings;
  insight: string;
}

export interface RiskWhatIfError {
  ok: false;
  reason: "invalid-input" | "insufficient-sample" | "scenario-insufficient-sample";
  message: string;
  sampleSize: number;
  minSample: number;
}

export type RiskWhatIfOutput = RiskWhatIfResult | RiskWhatIfError;

const round4 = (value: number) => Math.round(value * 1e4) / 1e4;

function metrics(values: readonly number[]): RiskWhatIfMetrics {
  const wins = values.filter((value) => value > 0);
  const losses = values.filter((value) => value < 0);
  const grossWins = wins.reduce((sum, value) => sum + value, 0);
  const grossLosses = Math.abs(losses.reduce((sum, value) => sum + value, 0));
  const netR = values.reduce((sum, value) => sum + value, 0);
  const avgWin = wins.length ? grossWins / wins.length : 0;
  const avgLoss = losses.length ? grossLosses / losses.length : 0;
  return {
    sampleSize: values.length,
    netR: round4(netR),
    winRate: round4(values.length ? wins.length / values.length : 0),
    profitFactor: grossLosses > 0 ? round4(grossWins / grossLosses) : null,
    expectancyR: round4(values.length ? netR / values.length : 0),
    payoffRatio: avgLoss > 0 ? round4(avgWin / avgLoss) : null,
  };
}

function equity(values: readonly number[]): { step: number; valueR: number }[] {
  let total = 0;
  return [
    { step: 0, valueR: 0 },
    ...values.map((value, index) => {
      total += value;
      return { step: index + 1, valueR: round4(total) };
    }),
  ];
}

/** Deterministically contracts or expands a sequence while preserving its order. */
function adjustFrequency<T>(values: readonly T[], frequencyPct: number): T[] {
  const target = Math.max(1, Math.round(values.length * frequencyPct / 100));
  return Array.from({ length: target }, (_, index) => values[Math.floor(index * values.length / target)]);
}

function deltaMetrics(scenario: RiskWhatIfMetrics, baseline: RiskWhatIfMetrics): RiskWhatIfMetrics {
  return {
    sampleSize: scenario.sampleSize - baseline.sampleSize,
    netR: round4(scenario.netR - baseline.netR),
    winRate: round4(scenario.winRate - baseline.winRate),
    profitFactor: scenario.profitFactor == null || baseline.profitFactor == null ? null : round4(scenario.profitFactor - baseline.profitFactor),
    expectancyR: round4(scenario.expectancyR - baseline.expectancyR),
    payoffRatio: scenario.payoffRatio == null || baseline.payoffRatio == null ? null : round4(scenario.payoffRatio - baseline.payoffRatio),
  };
}

function buildInsight(delta: RiskWhatIfMetrics, settings: RiskWhatIfSettings): string {
  const expectancy = `${delta.expectancyR >= 0 ? "+" : ""}${delta.expectancyR.toFixed(2)}R`;
  const net = `${delta.netR >= 0 ? "+" : ""}${delta.netR.toFixed(1)}R`;
  const direction = delta.expectancyR > 0.005 ? "improves" : delta.expectancyR < -0.005 ? "reduces" : "barely changes";
  const changes = [
    settings.lossCapR != null ? `capping losses at −${settings.lossCapR.toFixed(2)}R` : null,
    settings.winnerExtensionPct > 0 ? `extending winners ${settings.winnerExtensionPct}%` : null,
    settings.minQuality != null ? `keeping quality ${settings.minQuality}+` : null,
    settings.playbook ? `keeping ${settings.playbook}` : null,
    settings.ruleFilter !== "all" ? `keeping ${settings.ruleFilter} trades` : null,
    settings.frequencyPct !== 100 ? `running at ${settings.frequencyPct}% frequency` : null,
    settings.feesR > 0 ? `subtracting ${settings.feesR.toFixed(2)}R per trade` : null,
  ].filter(Boolean);
  return `This scenario ${direction} expectancy by ${expectancy} per trade and changes the replayed net result by ${net}${changes.length ? ` after ${changes.join(", ")}` : ""}. Historical scenario, not a forecast.`;
}

/**
 * Apply transparent What-If transforms to one currency's realized-R evidence.
 * The returned sequence is always derived; input samples are never changed.
 */
export function buildRiskWhatIf(input: {
  samples: readonly RiskWhatIfSample[];
  currency: Currency;
  settings: RiskWhatIfSettings;
  minSample?: number;
}): RiskWhatIfOutput {
  const minSample = input.minSample ?? RISK_SIM_MIN_SAMPLE;
  const settings = { ...input.settings };
  const validSettings =
    (settings.lossCapR == null || Number.isFinite(settings.lossCapR) && settings.lossCapR > 0) &&
    Number.isFinite(settings.winnerExtensionPct) && settings.winnerExtensionPct >= 0 && settings.winnerExtensionPct <= 200 &&
    (settings.minQuality == null || Number.isInteger(settings.minQuality) && settings.minQuality >= 1 && settings.minQuality <= 5) &&
    Number.isFinite(settings.frequencyPct) && settings.frequencyPct >= 25 && settings.frequencyPct <= 200 &&
    Number.isFinite(settings.feesR) && settings.feesR >= 0 && settings.feesR <= 5;

  if (!validSettings || input.samples.some((sample) => sample.currency !== input.currency || !Number.isFinite(sample.r))) {
    return { ok: false, reason: "invalid-input", message: "What-If needs finite, single-currency R samples and valid transform settings.", sampleSize: input.samples.length, minSample };
  }
  if (input.samples.length < minSample) {
    return { ok: false, reason: "insufficient-sample", message: `Need at least ${minSample} closed ${input.currency} trades; have ${input.samples.length}.`, sampleSize: input.samples.length, minSample };
  }

  const filtered = input.samples.filter((sample) => {
    if (settings.minQuality != null && (sample.quality == null || sample.quality < settings.minQuality)) return false;
    if (settings.playbook != null && sample.playbook !== settings.playbook) return false;
    if (settings.ruleFilter === "followed" && sample.ruleFollowed !== true) return false;
    if (settings.ruleFilter === "violated" && sample.ruleFollowed !== false) return false;
    return true;
  });
  if (filtered.length < minSample) {
    return {
      ok: false,
      reason: "scenario-insufficient-sample",
      message: `These filters leave ${filtered.length} ${input.currency} trades. Widen the scenario to at least ${minSample} before comparing it.`,
      sampleSize: filtered.length,
      minSample,
    };
  }

  const selected = adjustFrequency(filtered, settings.frequencyPct);
  const baselineR = input.samples.map((sample) => sample.r);
  const transformedR = selected.map((sample) => {
    let value = sample.r;
    if (settings.lossCapR != null && value < -settings.lossCapR) value = -settings.lossCapR;
    if (value > 0) value *= 1 + settings.winnerExtensionPct / 100;
    return round4(value - settings.feesR);
  });
  const baseline = metrics(baselineR);
  const scenario = metrics(transformedR);
  const delta = deltaMetrics(scenario, baseline);

  return {
    ok: true,
    label: RISK_SIM_LABEL,
    currency: input.currency,
    baseline,
    scenario,
    delta,
    baselineEquity: equity(baselineR),
    scenarioEquity: equity(transformedR),
    transformedR,
    settings,
    insight: buildInsight(delta, settings),
  };
}
