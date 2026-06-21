import { BarChart3, CalendarDays, ClipboardCheck, Dices, FileText, NotebookPen, type LucideIcon } from "lucide-react";

export interface MarketingFeature {
  icon: LucideIcon;
  title: string;
  /** One-line summary used on the home grid. */
  blurb: string;
  /** Longer supporting points used on the /features page. */
  points: string[];
}

export const FEATURES: MarketingFeature[] = [
  {
    icon: NotebookPen,
    title: "A disciplined journal",
    blurb: "Log every trade with the risk you actually planned — entry, stop, target, R, and fees.",
    points: [
      "Asset-specific entry for equities, indices, forex, commodities, crypto, futures, and options.",
      "Per-instrument defaults — multiplier, lot size and currency are remembered and backfilled.",
      "Planned and realized R captured the same, direction-aware way for longs and shorts.",
    ],
  },
  {
    icon: BarChart3,
    title: "Honest analytics",
    blurb: "Net P&L, win rate, profit factor, expectancy, payoff, drawdown and an R-multiple distribution.",
    points: [
      "Every metric states its definition, unit, scope and sample — no vanity numbers.",
      "INR and USD are never combined; you switch currency, you never get a meaningless total.",
      "Equity and drawdown curves, monthly and weekday breakdowns, and a symbol leaderboard.",
    ],
  },
  {
    icon: Dices,
    title: "Risk Studio",
    blurb: "Seeded Monte Carlo, risk of ruin, Kelly sizing and a transparent What-If — all R-based.",
    points: [
      "Bootstrap your realized-R sample into equity paths with risk of ruin and drawdown bands.",
      "Kelly and position-size stress show where edge turns into over-betting.",
      "What-If recomputes scenarios from your real trades without ever mutating them.",
    ],
  },
  {
    icon: ClipboardCheck,
    title: "Post-trade review",
    blurb: "A review queue, discipline scoring, mistake cost and evidence-led adjustments.",
    points: [
      "Closed trades queue for review so nothing slips by unexamined.",
      "Tag mistakes and see what they actually cost you, per currency.",
      "Each insight links back to the trades that justify it, with one concrete adjustment.",
    ],
  },
  {
    icon: CalendarDays,
    title: "Calendar & notes",
    blurb: "See outcomes by day, and keep pre/post-trade notes and journals linked to trades.",
    points: [
      "Recent, month and year views show realized outcomes by their real exit date.",
      "Rich-text notes with templates, folders and collections — linked to trades and playbooks.",
      "No-trade days stay distinct from break-even days; INR and USD stay separate.",
    ],
  },
  {
    icon: FileText,
    title: "Reports & export",
    blurb: "A professional PDF report, plus your data exportable any time.",
    points: [
      "A deterministic A4 PDF report — consistent across device and theme.",
      "Versioned JSON export covers trades, instruments, strategies, playbooks and notes.",
      "Your workspace is yours: take your data with you whenever you like.",
    ],
  },
];
