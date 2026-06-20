/**
 * Currency-scoped behavioral review analytics.
 *
 * The queue, discipline score, and mistake-cost rules preserve the v1 Review
 * Center oracle (`build_review_summary` at edbce1f). New comparisons stay
 * descriptive: they report associations inside the selected sample and never
 * claim that a behavior caused an outcome.
 */

import { plannedRR, realizedPnl, realizedR } from "./pnl";
import type { AnalyticsTrade } from "./analytics";
import type { Currency } from "./types";

export interface ReviewTrade extends AnalyticsTrade {
  id: string;
  reviewedAt?: string | null;
  confidence?: number | null;
  emotion?: string | null;
  closeReason?: string | null;
  checklistCompleted?: number;
  checklistTotal?: number;
  hasJournal?: boolean;
}

export interface ReviewQueueItem {
  id: string;
  symbol: string;
  direction: ReviewTrade["direction"];
  pnl: number;
  realizedR: number | null;
  exitedAt: string;
}

export interface EvidenceStat {
  name: string;
  count: number;
  pnl: number;
  winPct: number;
  expectancy: number;
  tradeIds: string[];
}

export interface MistakeCostEvidence {
  tag: string;
  cost: number;
  count: number;
  tradeIds: string[];
}

export interface DailyReviewOutcome {
  date: string;
  pnl: number;
  count: number;
  wins: number;
  losses: number;
  reviewed: number;
}

export interface ReviewInsight {
  title: string;
  evidence: string;
  consequence: string;
  tone: "positive" | "warning" | "neutral";
  tradeIds: string[];
}

export interface ReviewPeriodSample {
  count: number;
  pnl: number;
  winPct: number;
  ruleFollowRate: number | null;
}

export interface ReviewAnalytics {
  currency: Currency;
  totalClosed: number;
  totalPnl: number;
  reviewedCount: number;
  pendingReviewCount: number;
  avgExecutionScore: number | null;
  ruleFollowRate: number | null;
  disciplineScore: number | null;
  checklistCompletionRate: number | null;
  stopCoverage: number;
  targetCoverage: number;
  targetCaptureRate: number | null;
  compliance: {
    compliant: EvidenceStat;
    violated: EvidenceStat;
    expectancyDelta: number | null;
    winRateDelta: number | null;
  };
  journaling: {
    withJournal: EvidenceStat;
    withoutJournal: EvidenceStat;
    expectancyDelta: number | null;
  };
  setupStats: EvidenceStat[];
  emotionStats: EvidenceStat[];
  closeReasonStats: EvidenceStat[];
  weekdayStats: EvidenceStat[];
  mistakeCostByTag: MistakeCostEvidence[];
  dailyOutcomes: DailyReviewOutcome[];
  reviewQueue: ReviewQueueItem[];
  insights: ReviewInsight[];
  adjustment: string;
  periodComparison: {
    current: ReviewPeriodSample;
    previous: ReviewPeriodSample;
    pnlDelta: number;
    winRateDelta: number;
    ruleFollowRateDelta: number | null;
  };
}

interface Outcome {
  trade: ReviewTrade;
  pnl: number;
  date: string;
  reviewed: boolean;
  tags: string[];
}

interface StatAccumulator {
  pnl: number;
  count: number;
  wins: number;
  tradeIds: string[];
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const round2 = (value: number) => {
  const rounded = Number(value.toFixed(2));
  return Object.is(rounded, -0) ? 0 : rounded;
};

function normalizeTags(tags: ReviewTrade["mistakeTags"]): string[] {
  const values = typeof tags === "string" ? tags.split(/[,;\n]/) : (tags ?? []);
  return [...new Set(values.flatMap((tag) => tag.split(/[,;\n]/)).map((tag) => tag.trim()).filter(Boolean))];
}

function outcomesFor(trades: readonly ReviewTrade[], currency: Currency): Outcome[] {
  return trades.flatMap((trade) => {
    if (trade.currency !== currency) return [];
    const computed = realizedPnl(trade);
    if (computed == null) return [];
    return [{
      trade,
      pnl: round2(computed),
      date: trade.outcomeDate || trade.exitAt || trade.entryAt || "",
      reviewed: Boolean(trade.reviewedAt),
      tags: normalizeTags(trade.mistakeTags),
    }];
  });
}

function bump(group: Map<string, StatAccumulator>, key: string, outcome: Outcome): void {
  const current = group.get(key) ?? { pnl: 0, count: 0, wins: 0, tradeIds: [] };
  group.set(key, {
    pnl: round2(current.pnl + outcome.pnl),
    count: current.count + 1,
    wins: current.wins + (outcome.pnl >= 0 ? 1 : 0),
    tradeIds: [...current.tradeIds, outcome.trade.id],
  });
}

function evidence(name: string, outcomes: readonly Outcome[]): EvidenceStat {
  const pnl = round2(outcomes.reduce((sum, outcome) => sum + outcome.pnl, 0));
  const wins = outcomes.filter((outcome) => outcome.pnl >= 0).length;
  return {
    name,
    count: outcomes.length,
    pnl,
    winPct: round2(outcomes.length ? (wins / outcomes.length) * 100 : 0),
    expectancy: round2(outcomes.length ? pnl / outcomes.length : 0),
    tradeIds: outcomes.map((outcome) => outcome.trade.id),
  };
}

function groupStats(outcomes: readonly Outcome[], keyFor: (outcome: Outcome) => string): EvidenceStat[] {
  const grouped = new Map<string, StatAccumulator>();
  for (const outcome of outcomes) bump(grouped, keyFor(outcome), outcome);
  return [...grouped.entries()].map(([name, stat]) => ({
    name,
    count: stat.count,
    pnl: stat.pnl,
    winPct: round2(stat.count ? (stat.wins / stat.count) * 100 : 0),
    expectancy: round2(stat.count ? stat.pnl / stat.count : 0),
    tradeIds: stat.tradeIds,
  })).sort((left, right) => right.pnl - left.pnl || left.name.localeCompare(right.name));
}

function periodSample(outcomes: readonly Outcome[]): ReviewPeriodSample {
  const reviewed = outcomes.filter((outcome) => outcome.reviewed);
  const followed = reviewed.filter((outcome) => outcome.tags.length === 0).length;
  const stat = evidence("Period", outcomes);
  return {
    count: stat.count,
    pnl: stat.pnl,
    winPct: stat.winPct,
    ruleFollowRate: reviewed.length ? round2((followed / reviewed.length) * 100) : null,
  };
}

function buildInsights({
  compliant,
  violated,
  journaling,
  setupStats,
  emotionStats,
}: {
  compliant: EvidenceStat;
  violated: EvidenceStat;
  journaling: ReviewAnalytics["journaling"];
  setupStats: EvidenceStat[];
  emotionStats: EvidenceStat[];
}): ReviewInsight[] {
  const insights: ReviewInsight[] = [];
  if (compliant.count >= 2 && violated.count >= 2) {
    const delta = round2(compliant.expectancy - violated.expectancy);
    insights.push({
      title: "Rule-compliant trades separated from violations",
      evidence: `${compliant.count} compliant and ${violated.count} violated reviewed trades are in this sample.`,
      consequence: `Compliant-trade expectancy was ${delta >= 0 ? "+" : ""}${delta.toFixed(2)} per trade versus violated trades. This is an association, not proof of causation.`,
      tone: delta >= 0 ? "positive" : "warning",
      tradeIds: [...compliant.tradeIds, ...violated.tradeIds],
    });
  }

  const setup = setupStats.find((stat) => stat.count >= 3);
  if (setup) {
    insights.push({
      title: `${setup.name} has the clearest setup sample`,
      evidence: `${setup.count} closed trades · ${setup.winPct.toFixed(0)}% win rate in this sample.`,
      consequence: `Measured expectancy is ${setup.expectancy >= 0 ? "+" : ""}${setup.expectancy.toFixed(2)} per trade; inspect the supporting trades before changing size.`,
      tone: setup.expectancy >= 0 ? "positive" : "warning",
      tradeIds: setup.tradeIds,
    });
  }

  const emotion = [...emotionStats].filter((stat) => stat.count >= 2).sort((left, right) => left.expectancy - right.expectancy)[0];
  if (emotion) {
    insights.push({
      title: `${emotion.name} is the weakest repeated emotion tag`,
      evidence: `${emotion.count} trades · ${emotion.winPct.toFixed(0)}% win rate in this sample.`,
      consequence: `Measured expectancy is ${emotion.expectancy >= 0 ? "+" : ""}${emotion.expectancy.toFixed(2)} per trade. Treat this as a review prompt, not a diagnosis.`,
      tone: emotion.expectancy < 0 ? "warning" : "neutral",
      tradeIds: emotion.tradeIds,
    });
  }

  if (journaling.withJournal.count >= 2 && journaling.withoutJournal.count >= 2) {
    const delta = journaling.expectancyDelta ?? 0;
    insights.push({
      title: "Journaled and unjournaled trades differ",
      evidence: `${journaling.withJournal.count} trades have notes; ${journaling.withoutJournal.count} do not in this sample.`,
      consequence: `Journaled-trade expectancy differs by ${delta >= 0 ? "+" : ""}${delta.toFixed(2)} per trade. Notes may be written after the outcome, so this is descriptive only.`,
      tone: "neutral",
      tradeIds: [...journaling.withJournal.tradeIds, ...journaling.withoutJournal.tradeIds],
    });
  }
  return insights.slice(0, 4);
}

export function buildReviewAnalytics(
  trades: readonly ReviewTrade[],
  previousTrades: readonly ReviewTrade[],
  currency: Currency,
  comparisonTrades: readonly ReviewTrade[] = trades,
): ReviewAnalytics {
  const outcomes = outcomesFor(trades, currency);
  const previousOutcomes = outcomesFor(previousTrades, currency);
  const comparisonOutcomes = outcomesFor(comparisonTrades, currency);
  const reviewed = outcomes.filter((outcome) => outcome.reviewed);
  const pending = outcomes.filter((outcome) => !outcome.reviewed);
  const executionScores = reviewed.map(({ trade }) => trade.confidence).filter((score): score is number => score != null && score >= 1 && score <= 5);
  const rawExecutionScore = executionScores.length ? executionScores.reduce((sum, score) => sum + score, 0) / executionScores.length : null;
  const avgExecutionScore = rawExecutionScore == null ? null : round2(rawExecutionScore);
  const followed = reviewed.filter((outcome) => outcome.tags.length === 0);
  const ruleFollowRate = reviewed.length ? round2((followed.length / reviewed.length) * 100) : null;
  const disciplineComponents = [rawExecutionScore == null ? null : (rawExecutionScore / 5) * 100, reviewed.length ? (followed.length / reviewed.length) * 100 : null].filter((value): value is number => value != null && value > 0);
  const disciplineScore = disciplineComponents.length ? round2(disciplineComponents.reduce((sum, value) => sum + value, 0) / disciplineComponents.length) : null;

  const checklistTotals = reviewed.reduce((totals, { trade }) => ({
    completed: totals.completed + (trade.checklistCompleted ?? 0),
    total: totals.total + (trade.checklistTotal ?? 0),
  }), { completed: 0, total: 0 });
  const checklistCompletionRate = checklistTotals.total ? round2((checklistTotals.completed / checklistTotals.total) * 100) : null;
  const stopCoverage = round2(outcomes.length ? (outcomes.filter(({ trade }) => trade.stopLoss != null).length / outcomes.length) * 100 : 0);
  const targetCoverage = round2(outcomes.length ? (outcomes.filter(({ trade }) => trade.plannedTarget != null).length / outcomes.length) * 100 : 0);
  const captureValues = outcomes.flatMap((outcome) => {
    const planned = plannedRR(outcome.trade);
    const actual = realizedR(outcome.trade, outcome.pnl);
    return planned != null && planned !== 0 && actual != null ? [(actual / planned) * 100] : [];
  });
  const targetCaptureRate = captureValues.length ? round2(captureValues.reduce((sum, value) => sum + value, 0) / captureValues.length) : null;

  const compliant = evidence("Compliant", followed);
  const violated = evidence("Violated", reviewed.filter((outcome) => outcome.tags.length > 0));
  const withJournal = evidence("With journal", outcomes.filter(({ trade }) => trade.hasJournal));
  const withoutJournal = evidence("Without journal", outcomes.filter(({ trade }) => !trade.hasJournal));
  const journaling = {
    withJournal,
    withoutJournal,
    expectancyDelta: withJournal.count && withoutJournal.count ? round2(withJournal.expectancy - withoutJournal.expectancy) : null,
  };
  const setupStats = groupStats(outcomes, ({ trade }) => trade.playbook || trade.strategy || "No linked setup");
  const emotionStats = groupStats(outcomes, ({ trade }) => trade.emotion || "Not tagged");
  const closeReasonStats = groupStats(outcomes, ({ trade }) => trade.closeReason || "Not recorded");
  const weekdayStats = groupStats(outcomes, ({ date }) => {
    const parsed = Date.parse(date);
    return Number.isFinite(parsed) ? WEEKDAYS[new Date(parsed).getUTCDay()] : "Unknown";
  });

  const mistakeGroups = new Map<string, { cost: number; count: number; tradeIds: string[] }>();
  for (const outcome of outcomes.filter(({ pnl }) => pnl < 0)) {
    for (const tag of outcome.tags) {
      const current = mistakeGroups.get(tag) ?? { cost: 0, count: 0, tradeIds: [] };
      mistakeGroups.set(tag, { cost: round2(current.cost + Math.abs(outcome.pnl)), count: current.count + 1, tradeIds: [...current.tradeIds, outcome.trade.id] });
    }
  }
  const mistakeCostByTag = [...mistakeGroups.entries()]
    .map(([tag, stat]) => ({ tag, ...stat }))
    .sort((left, right) => right.cost - left.cost || left.tag.localeCompare(right.tag));

  const dailyMap = new Map<string, DailyReviewOutcome>();
  for (const outcome of outcomes) {
    const date = outcome.date.slice(0, 10);
    if (!date) continue;
    const day = dailyMap.get(date) ?? { date, pnl: 0, count: 0, wins: 0, losses: 0, reviewed: 0 };
    dailyMap.set(date, {
      date,
      pnl: round2(day.pnl + outcome.pnl),
      count: day.count + 1,
      wins: day.wins + (outcome.pnl >= 0 ? 1 : 0),
      losses: day.losses + (outcome.pnl < 0 ? 1 : 0),
      reviewed: day.reviewed + (outcome.reviewed ? 1 : 0),
    });
  }
  const dailyOutcomes = [...dailyMap.values()].sort((left, right) => left.date.localeCompare(right.date));
  const reviewQueue = [...pending].sort((left, right) => right.date.localeCompare(left.date)).slice(0, 12).map((outcome) => ({
    id: outcome.trade.id,
    symbol: outcome.trade.instrument || "—",
    direction: outcome.trade.direction,
    pnl: outcome.pnl,
    realizedR: realizedR(outcome.trade, outcome.pnl),
    exitedAt: outcome.date,
  }));

  const currentPeriod = periodSample(comparisonOutcomes);
  const previousPeriod = periodSample(previousOutcomes);
  const periodComparison = {
    current: currentPeriod,
    previous: previousPeriod,
    pnlDelta: round2(currentPeriod.pnl - previousPeriod.pnl),
    winRateDelta: round2(currentPeriod.winPct - previousPeriod.winPct),
    ruleFollowRateDelta: currentPeriod.ruleFollowRate == null || previousPeriod.ruleFollowRate == null ? null : round2(currentPeriod.ruleFollowRate - previousPeriod.ruleFollowRate),
  };
  const compliance = {
    compliant,
    violated,
    expectancyDelta: compliant.count && violated.count ? round2(compliant.expectancy - violated.expectancy) : null,
    winRateDelta: compliant.count && violated.count ? round2(compliant.winPct - violated.winPct) : null,
  };
  const insights = buildInsights({ compliant, violated, journaling, setupStats, emotionStats });

  let adjustment = "Keep closing the loop: review the trade, tag the mistake, and carry one adjustment forward.";
  if (pending.length) adjustment = `Review ${pending.length} closed trade${pending.length === 1 ? "" : "s"} before taking the next setup.`;
  else if (outcomes.length && targetCoverage < 80) adjustment = "Add planned targets more consistently so planned and realized R stay comparable.";
  else if (checklistCompletionRate != null && checklistCompletionRate < 80) adjustment = "Complete the pre-trade checklist before sizing up; the reviewed sample is below 80%.";
  else if (ruleFollowRate != null && ruleFollowRate < 80) adjustment = "Rule adherence is below 80%. Tighten the pre-trade checklist before sizing up.";
  else if (mistakeCostByTag[0]) adjustment = `Audit ${mistakeCostByTag[0].tag} first; it has the largest tagged loss cost in this sample.`;

  return {
    currency,
    totalClosed: outcomes.length,
    totalPnl: currentPeriod.pnl,
    reviewedCount: reviewed.length,
    pendingReviewCount: pending.length,
    avgExecutionScore,
    ruleFollowRate,
    disciplineScore,
    checklistCompletionRate,
    stopCoverage,
    targetCoverage,
    targetCaptureRate,
    compliance,
    journaling,
    setupStats,
    emotionStats,
    closeReasonStats,
    weekdayStats,
    mistakeCostByTag,
    dailyOutcomes,
    reviewQueue,
    insights,
    adjustment,
    periodComparison,
  };
}
