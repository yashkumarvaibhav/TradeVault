import type { Currency, Direction, TradeStatus } from "./types";

export interface CalendarTradeInput {
  id: string;
  status: TradeStatus;
  currency: Currency;
  symbol: string;
  direction: Direction;
  entryAt: string;
  exitAt: string | null;
  entryPrice: number;
  quantity: number;
  realizedPnl: number | null;
  realizedR: number | null;
  reviewedAt: string | null;
}

export interface CalendarTradeCard {
  id: string;
  symbol: string;
  direction: Direction;
  entryAt: string;
  exitAt: string;
  entryPrice: number;
  quantity: number;
  pnl: number;
  realizedR: number | null;
  reviewed: boolean;
}

export interface CalendarDay {
  date: string;
  /** null means no outcome on this day; zero is a real flat trading day. */
  pnl: number | null;
  realizedR: number | null;
  count: number;
  wins: number;
  losses: number;
  reviewCount: number;
  trades: CalendarTradeCard[];
  reviewedTradeIds: string[];
}

export interface CalendarAnalytics {
  currency: Currency;
  totalClosed: number;
  totalReviews: number;
  days: CalendarDay[];
  years: number[];
}

const round2 = (value: number) => {
  const rounded = Number(value.toFixed(2));
  return Object.is(rounded, -0) ? 0 : rounded;
};

function emptyDay(date: string): CalendarDay {
  return { date, pnl: null, realizedR: null, count: 0, wins: 0, losses: 0, reviewCount: 0, trades: [], reviewedTradeIds: [] };
}

/**
 * Build one currency's exit-day outcomes and actual review-day events. The
 * returned shape cannot carry a cross-currency money total.
 */
export function buildCalendarAnalytics(trades: readonly CalendarTradeInput[], currency: Currency): CalendarAnalytics {
  const days = new Map<string, CalendarDay>();
  let totalClosed = 0;
  let totalReviews = 0;

  for (const trade of trades) {
    if (trade.currency !== currency) continue;

    if (trade.status === "closed" && trade.realizedPnl != null && trade.exitAt) {
      const date = trade.exitAt.slice(0, 10);
      const day = days.get(date) ?? emptyDay(date);
      const pnl = round2(trade.realizedPnl);
      day.pnl = round2((day.pnl ?? 0) + pnl);
      day.realizedR = trade.realizedR == null ? day.realizedR : round2((day.realizedR ?? 0) + trade.realizedR);
      day.count += 1;
      day.wins += pnl >= 0 ? 1 : 0;
      day.losses += pnl < 0 ? 1 : 0;
      day.trades.push({
        id: trade.id,
        symbol: trade.symbol,
        direction: trade.direction,
        entryAt: trade.entryAt,
        exitAt: trade.exitAt,
        entryPrice: trade.entryPrice,
        quantity: trade.quantity,
        pnl,
        realizedR: trade.realizedR,
        reviewed: Boolean(trade.reviewedAt),
      });
      days.set(date, day);
      totalClosed += 1;
    }

    if (trade.reviewedAt) {
      const date = trade.reviewedAt.slice(0, 10);
      const day = days.get(date) ?? emptyDay(date);
      day.reviewCount += 1;
      day.reviewedTradeIds.push(trade.id);
      days.set(date, day);
      totalReviews += 1;
    }
  }

  const orderedDays = [...days.values()].sort((left, right) => left.date.localeCompare(right.date));
  const years = [...new Set(orderedDays.map(({ date }) => Number(date.slice(0, 4))))].sort((left, right) => right - left);
  return { currency, totalClosed, totalReviews, days: orderedDays, years };
}
