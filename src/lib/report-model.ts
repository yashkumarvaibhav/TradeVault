import type { CurrencyAnalytics } from "@/lib/domain/analytics";
import type { Currency } from "@/lib/domain/types";

/**
 * Pure presentation model for the generated PDF report.
 *
 * This module deliberately imports nothing from `@react-pdf/renderer` or the DOM:
 * it shapes a single-currency `CurrencyAnalytics` plus scope metadata into the exact
 * strings and numeric chart points the PDF draws. Keeping it pure lets Vitest act as
 * the oracle for currency isolation, money formatting, and chart-point derivation,
 * and lets the document component stay a thin renderer.
 *
 * Hard invariant: a report model carries exactly one currency. INR and USD are never
 * combined — the caller selects the currency and we only ever read that slice.
 */

export type KpiTone = "profit" | "loss" | "neutral";

export interface ReportKpi {
  label: string;
  value: string;
  detail: string;
  tone: KpiTone;
}

export interface ReportChartPoint {
  label: string;
  value: number;
}

export interface ReportSymbolBar {
  symbol: string;
  pnl: number;
  pnlLabel: string;
  count: number;
  winPctLabel: string;
}

export interface ReportStatRow {
  label: string;
  value: string;
}

export interface ReportModel {
  accountName: string;
  currency: Currency;
  periodLabel: string;
  assetLabel: string;
  generatedLabel: string;
  totalTrades: number;
  sampleNote: string;
  headline: ReportKpi[];
  riskRows: ReportStatRow[];
  equity: ReportChartPoint[];
  monthly: ReportChartPoint[];
  weekday: ReportChartPoint[];
  topSymbols: ReportSymbolBar[];
  isolationNote: string;
}

export interface ReportModelInput {
  analytics: CurrencyAnalytics;
  accountName: string;
  periodLabel: string;
  assetLabel: string;
  /** Pre-formatted, timezone-correct "generated at" label from the caller. */
  generatedLabel: string;
}

/**
 * Money formatter for the PDF. USD keeps the "$" symbol (which embeds and shapes
 * fine), but INR is written as "Rs 4,521" rather than the ₹ glyph: react-pdf's
 * text shaper drops U+20B9 even from fonts that contain it, so "₹" would silently
 * vanish from the report. "Rs" is the standard, unambiguous Indian shorthand and
 * the report is already labelled "INR only".
 */
export function formatReportMoney(currency: Currency, amount: number): string {
  if (currency === "USD") {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(amount);
  }
  const grouped = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(amount);
  return `Rs ${grouped}`;
}

export function reportMoneyFormatter(currency: Currency): { format: (amount: number) => string } {
  return { format: (amount: number) => formatReportMoney(currency, amount) };
}

/**
 * Compact money for PDF chart axes/labels, e.g. "Rs 1.2L" / "-Rs 12K" / "$1.2M".
 * Mirrors {@link formatReportMoney}'s "Rs"-for-INR rule (react-pdf drops ₹) but in
 * compact notation so a chart axis can show its money scale without colliding.
 */
export function formatReportMoneyCompact(currency: Currency, amount: number): string {
  if (currency === "USD") {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(amount);
  }
  const grouped = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(amount);
  return `Rs ${grouped}`;
}

function signedR(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}R`;
}

function pnlTone(value: number): KpiTone {
  if (value > 0) return "profit";
  if (value < 0) return "loss";
  return "neutral";
}

/** Top symbols to surface; beyond this the bar list overflows the A4 column. */
const TOP_SYMBOL_LIMIT = 8;

export function buildReportModel(input: ReportModelInput): ReportModel {
  const { analytics, accountName, periodLabel, assetLabel, generatedLabel } = input;
  const currency = analytics.currency;
  const money = reportMoneyFormatter(currency);

  const headline: ReportKpi[] = [
    {
      label: "Net P&L",
      value: money.format(analytics.netPnl),
      detail: `${currency} · realized, closed trades`,
      tone: pnlTone(analytics.netPnl),
    },
    {
      label: "Win rate",
      value: `${analytics.winPct.toFixed(1)}%`,
      detail: `${analytics.winningTrades} W · ${analytics.losingTrades} L`,
      tone: "neutral",
    },
    {
      label: "Profit factor",
      value: analytics.profitFactor == null ? "—" : analytics.profitFactor.toFixed(2),
      detail: "Gross profit ÷ gross loss",
      tone: "neutral",
    },
    {
      label: "Expectancy",
      value: money.format(analytics.expectancy),
      detail: `${currency} per closed trade`,
      tone: pnlTone(analytics.expectancy),
    },
  ];

  const riskRows: ReportStatRow[] = [
    { label: "Max drawdown", value: money.format(analytics.maxDrawdown) },
    { label: "Avg realized R", value: signedR(analytics.avgRealizedR) },
    { label: "Avg win", value: money.format(analytics.avgWin) },
    { label: "Avg loss", value: money.format(analytics.avgLoss) },
    { label: "Largest win", value: money.format(analytics.largestWin) },
    { label: "Largest loss", value: money.format(analytics.largestLoss) },
    {
      label: "Payoff ratio",
      value: analytics.payoffRatio == null ? "—" : `${analytics.payoffRatio.toFixed(2)}×`,
    },
    { label: "Current streak", value: analytics.currentStreak || "—" },
  ];

  const equity: ReportChartPoint[] = analytics.equityCurve.map((point) => ({
    label: point.date.slice(5),
    value: point.cumulative,
  }));

  const monthly: ReportChartPoint[] = analytics.monthlyPnl.map((point) => ({
    label: point.month.slice(2),
    value: point.pnl,
  }));

  const weekday: ReportChartPoint[] = analytics.weekdayPnl.map((point) => ({
    label: point.weekday.slice(0, 3),
    value: point.pnl,
  }));

  const topSymbols: ReportSymbolBar[] = analytics.symbolLeaderboard
    .slice(0, TOP_SYMBOL_LIMIT)
    .map((row) => ({
      symbol: row.symbol,
      pnl: row.pnl,
      pnlLabel: money.format(row.pnl),
      count: row.count,
      winPctLabel: `${row.winPct.toFixed(0)}%`,
    }));

  return {
    accountName,
    currency,
    periodLabel,
    assetLabel,
    generatedLabel,
    totalTrades: analytics.totalTrades,
    sampleNote: `${analytics.totalTrades} closed ${currency} trade${analytics.totalTrades === 1 ? "" : "s"} in sample`,
    headline,
    riskRows,
    equity,
    monthly,
    weekday,
    topSymbols,
    isolationNote: `This report isolates ${currency}. INR and USD are never summed. Every metric uses closed trades with a computable result in ${accountName} for ${periodLabel} · ${assetLabel}.`,
  };
}
