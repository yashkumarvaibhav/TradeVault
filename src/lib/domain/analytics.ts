/**
 * Currency-scoped aggregate analytics.
 *
 * The formulas and edge semantics are ported from v1 `build_currency_analytics`
 * and `build_return_distribution` (`app.py` at edbce1f). Every money-derived
 * value is calculated only after trades have been partitioned by currency; the
 * returned shape has no cross-currency total.
 */

import { plannedRR, realizedPnl, realizedPnlPct, realizedR } from "./pnl";
import type { AssetClass, Currency, TradeMath } from "./types";

export interface AnalyticsTrade extends TradeMath {
  instrument?: string | null;
  assetClass?: AssetClass | null;
  entryAt?: string | null;
  exitAt?: string | null;
  strategy?: string | null;
  playbook?: string | null;
  mistakeTags?: readonly string[] | string | null;
}

export interface EquityPoint {
  date: string;
  pnl: number;
  cumulative: number;
  /** Negative distance from the running equity peak; zero while at a peak. */
  drawdown: number;
  instrument: string;
  currency: Currency;
}

export interface MonthlyPnlPoint {
  month: string;
  pnl: number;
}

export interface ReturnDistributionBucket {
  range: string;
  count: number;
}

export interface MistakeCost {
  tag: string;
  cost: number;
}

export interface CurrencyAnalytics {
  currency: Currency;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winPct: number;
  netPnl: number;
  avgWin: number;
  avgLoss: number;
  payoffRatio: number | null;
  adjustedPayoffRatio: number | null;
  profitFactor: number | null;
  expectancy: number;
  avgPlannedRR: number;
  avgRealizedR: number;
  avgWinDurationHours: number;
  avgLossDurationHours: number;
  maxDrawdown: number;
  currentStreak: string;
  largestWin: number;
  largestLoss: number;
  equityCurve: EquityPoint[];
  monthlyPnl: MonthlyPnlPoint[];
  categoryPnl: Record<string, number>;
  strategyPnl: Record<string, number>;
  playbookPnl: Record<string, number>;
  mistakeCostByTag: MistakeCost[];
  returnDistribution: ReturnDistributionBucket[];
}

export type CurrencyAnalyticsMap = Partial<Record<Currency, CurrencyAnalytics>>;

interface Outcome {
  trade: AnalyticsTrade;
  rawPnl: number;
  pnl: number;
  date: string;
  durationHours: number;
}

function round2(value: number): number {
  const rounded = Number(value.toFixed(2));
  return Object.is(rounded, -0) ? 0 : rounded;
}

function addToGroup(group: Record<string, number>, key: string, amount: number): void {
  group[key] = round2((group[key] ?? 0) + amount);
}

function durationHours(trade: AnalyticsTrade): number {
  if (!trade.entryAt || !trade.exitAt) return 0;
  const entry = Date.parse(trade.entryAt);
  const exit = Date.parse(trade.exitAt);
  if (!Number.isFinite(entry) || !Number.isFinite(exit)) return 0;
  return (exit - entry) / 3_600_000;
}

function normalizedMistakeTags(tags: AnalyticsTrade["mistakeTags"]): string[] {
  const values = typeof tags === "string" ? tags.split(",") : (tags ?? []);
  return values.map((tag) => tag.trim()).filter(Boolean);
}

/** Port of v1's clamped two-percentage-point return histogram. */
export function buildReturnDistribution(pctReturns: readonly number[]): ReturnDistributionBucket[] {
  const buckets = new Map<number, number>();
  for (const pct of pctReturns) {
    if (!Number.isFinite(pct)) continue;
    const bucketStart = Math.max(-100, Math.min(600, Math.floor(pct / 2) * 2));
    buckets.set(bucketStart, (buckets.get(bucketStart) ?? 0) + 1);
  }
  return [...buckets.entries()]
    .sort(([left], [right]) => left - right)
    .map(([start, count]) => ({ range: `${start}% to ${start + 2}%`, count }));
}

function buildOneCurrency(currency: Currency, outcomes: Outcome[]): CurrencyAnalytics {
  const wins: Outcome[] = [];
  const losses: Outcome[] = [];
  const categoryPnl: Record<string, number> = {};
  const monthlyPnl: Record<string, number> = {};
  const strategyPnl: Record<string, number> = {};
  const playbookPnl: Record<string, number> = {};
  const mistakeCost: Record<string, number> = {};
  const plannedRRValues: number[] = [];
  const realizedRValues: number[] = [];
  const pctReturns: number[] = [];

  for (const outcome of outcomes) {
    const { trade, rawPnl, pnl, date } = outcome;
    (pnl >= 0 ? wins : losses).push(outcome);

    addToGroup(categoryPnl, trade.assetClass || "Other", pnl);
    if (date) addToGroup(monthlyPnl, date.slice(0, 7), pnl);
    addToGroup(strategyPnl, trade.strategy || "No Strategy", pnl);
    addToGroup(playbookPnl, trade.playbook || "No Playbook", pnl);

    if (pnl < 0) {
      for (const tag of normalizedMistakeTags(trade.mistakeTags)) {
        addToGroup(mistakeCost, tag, Math.abs(pnl));
      }
    }

    const planned = plannedRR(trade);
    if (planned != null) plannedRRValues.push(planned);
    const realized = realizedR(trade, rawPnl);
    if (realized != null) realizedRValues.push(realized);
    const pct = realizedPnlPct(trade, rawPnl);
    if (pct != null) pctReturns.push(pct);
  }

  const chronological = [...outcomes].sort((left, right) => left.date.localeCompare(right.date));
  let cumulative = 0;
  let peak = 0;
  let maxDrawdown = 0;
  const equityCurve: EquityPoint[] = chronological.map(({ trade, pnl, date }) => {
    cumulative = round2(cumulative + pnl);
    peak = Math.max(peak, cumulative);
    const drawdown = round2(cumulative - peak);
    maxDrawdown = Math.min(maxDrawdown, drawdown);
    return {
      date,
      pnl,
      cumulative,
      drawdown,
      instrument: trade.instrument || "",
      currency,
    };
  });

  let streakCount = 0;
  let streakType = "";
  for (let index = chronological.length - 1; index >= 0; index -= 1) {
    const type = chronological[index].pnl >= 0 ? "W" : "L";
    if (!streakType) streakType = type;
    if (type !== streakType) break;
    streakCount += 1;
  }

  const total = outcomes.length;
  const winCount = wins.length;
  const lossCount = losses.length;
  const winPct = total ? (winCount / total) * 100 : 0;
  const lossPct = 100 - winPct;
  const sum = (items: Outcome[]): number => items.reduce((totalValue, item) => totalValue + item.pnl, 0);
  const average = (values: number[]): number =>
    values.length ? values.reduce((totalValue, value) => totalValue + value, 0) / values.length : 0;
  const avgWin = winCount ? sum(wins) / winCount : 0;
  const avgLoss = lossCount ? sum(losses) / lossCount : 0;
  const payoffRatio = avgLoss ? avgWin / Math.abs(avgLoss) : null;
  const adjustedPayoffRatio =
    lossPct > 0 && avgLoss ? ((winPct / 100) * avgWin) / ((lossPct / 100) * Math.abs(avgLoss)) : null;
  const grossProfit = sum(wins);
  const grossLoss = Math.abs(sum(losses));
  const profitFactor = grossLoss ? grossProfit / grossLoss : grossProfit ? null : 0;
  const netPnl = equityCurve.reduce((totalValue, point) => totalValue + point.pnl, 0);

  return {
    currency,
    totalTrades: total,
    winningTrades: winCount,
    losingTrades: lossCount,
    winPct: round2(winPct),
    netPnl: round2(netPnl),
    avgWin: round2(avgWin),
    avgLoss: round2(avgLoss),
    payoffRatio: payoffRatio == null ? null : round2(payoffRatio),
    adjustedPayoffRatio: adjustedPayoffRatio == null ? null : round2(adjustedPayoffRatio),
    profitFactor: profitFactor == null ? null : round2(profitFactor),
    expectancy: round2(netPnl / total),
    avgPlannedRR: round2(average(plannedRRValues)),
    avgRealizedR: round2(average(realizedRValues)),
    avgWinDurationHours: round2(average(wins.map(({ durationHours: duration }) => duration))),
    avgLossDurationHours: round2(average(losses.map(({ durationHours: duration }) => duration))),
    maxDrawdown: round2(maxDrawdown),
    currentStreak: streakCount ? `${streakCount}${streakType}` : "",
    largestWin: round2(Math.max(...wins.map(({ pnl }) => pnl), 0)),
    largestLoss: round2(Math.min(...losses.map(({ pnl }) => pnl), 0)),
    equityCurve,
    monthlyPnl: Object.entries(monthlyPnl)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([month, pnl]) => ({ month, pnl })),
    categoryPnl,
    strategyPnl,
    playbookPnl,
    mistakeCostByTag: Object.entries(mistakeCost)
      .sort((left, right) => right[1] - left[1])
      .map(([tag, cost]) => ({ tag, cost })),
    returnDistribution: buildReturnDistribution(pctReturns),
  };
}

/**
 * Build money metrics per currency. Open/non-computable trades are excluded so
 * they cannot dilute win rate or expectancy. An empty usable sample returns {}.
 */
export function buildCurrencyAnalytics(trades: readonly AnalyticsTrade[]): CurrencyAnalyticsMap {
  const grouped = new Map<Currency, Outcome[]>();
  for (const trade of trades) {
    const rawPnl = realizedPnl(trade);
    if (rawPnl == null) continue;
    const outcome: Outcome = {
      trade,
      rawPnl,
      pnl: round2(rawPnl),
      date: trade.exitAt || trade.entryAt || "",
      durationHours: durationHours(trade),
    };
    const currencyOutcomes = grouped.get(trade.currency) ?? [];
    currencyOutcomes.push(outcome);
    grouped.set(trade.currency, currencyOutcomes);
  }

  const result: CurrencyAnalyticsMap = {};
  for (const currency of [...grouped.keys()].sort()) {
    result[currency] = buildOneCurrency(currency, grouped.get(currency) ?? []);
  }
  return result;
}
