/**
 * Per-screen tour content. Each authenticated screen maps to one tour: a short welcome card
 * (title + intro) plus an ordered spotlight walkthrough. Steps may anchor to a CSS selector; a
 * step whose target is absent on the current viewport (e.g. the desktop sidebar on mobile) simply
 * renders its popover centered, so a tour is always coherent.
 *
 * Shared anchors that exist on every authenticated screen:
 *   [data-tour="page-title"]      — the screen heading (PageHeader)
 *   [data-tour="market-switch"]   — the INR/USD workspace switch
 *   [data-tour="add-trade"]       — the header "Add trade" button
 *   #main-content                 — the screen's content region
 *   nav[aria-label="Primary navigation"] — the sidebar (desktop only)
 */
export interface TourStep {
  /** CSS selector to spotlight; omit for a centered, screen-level step. */
  target?: string;
  title: string;
  body: string;
}

export interface ScreenTour {
  key: string;
  /** Welcome-card heading + intro. */
  title: string;
  intro: string;
  steps: TourStep[];
}

const NAV = 'nav[aria-label="Primary navigation"]';
const TITLE = '[data-tour="page-title"]';
const MARKET = '[data-tour="market-switch"]';
const CONTENT = "#main-content";

export const SCREEN_TOURS: Record<string, ScreenTour> = {
  overview: {
    key: "overview",
    title: "Welcome to TradeVault 👋",
    intro:
      "This is your Overview — the at-a-glance pulse of your trading. Take a 30-second tour, or skip and explore on your own.",
    steps: [
      { target: TITLE, title: "Your Overview", body: "A daily snapshot of how your trading is going — updated as you log and close trades." },
      { target: MARKET, title: "INR / USD, never mixed", body: "Everything is shown per currency. Flip this switch to move between your Indian (INR) and International (USD) workspaces." },
      { target: CONTENT, title: "KPIs, equity & notes", body: "Your headline numbers, equity curve, and most recent notes all live here so you can scan your state in seconds." },
      { target: NAV, title: "Get around", body: "Jump to My Trades, Analytics, Risk Studio, Review, Calendar, Notes and Reports from the sidebar." },
    ],
  },
  trades: {
    key: "trades",
    title: "My Trades",
    intro: "Every position you've logged lives here. Quick tour of how to work the log?",
    steps: [
      { target: TITLE, title: "Your trade log", body: "The full record of your trades for the active currency — filter, sort, and open any one for a closer look." },
      { target: MARKET, title: "Active currency only", body: "This list shows the workspace you're in. Switch INR/USD to see the other set of trades." },
      { target: '[data-tour="add-trade"]', title: "Log a new trade", body: "Add a trade anytime from here — the entry form adapts to what you're trading." },
    ],
  },
  "trade-new": {
    key: "trade-new",
    title: "Add a Trade",
    intro: "The entry form changes to match what you trade. Here's the gist.",
    steps: [
      { target: MARKET, title: "Pick your workspace first", body: "Set INR or USD before you start — currency is owned by the workspace so a single entry can't drift between them." },
      { target: CONTENT, title: "Asset-aware fields", body: "Choose the asset class (equity, F&O, forex, and more) and the fields adapt. Record the stop, target and risk you actually planned." },
      { target: TITLE, title: "Save and review later", body: "Save the trade and it joins your log, ready to close and review when the time comes." },
    ],
  },
  analytics: {
    key: "analytics",
    title: "Analytics",
    intro: "Honest, per-currency performance — every metric with its definition and sample.",
    steps: [
      { target: TITLE, title: "Performance, honestly", body: "Net P&L, win rate, profit factor, expectancy, payoff, drawdown and your R-multiple distribution." },
      { target: CONTENT, title: "Definitions, not vanity", body: "Each metric states its definition, unit, scope and sample size — no numbers without context." },
      { target: MARKET, title: "Per currency", body: "INR and USD are never combined into a meaningless total — switch the currency you're viewing instead." },
    ],
  },
  risk: {
    key: "risk",
    title: "Risk Studio",
    intro: "Stress-test your edge with reproducible, R-based simulations.",
    steps: [
      { target: TITLE, title: "Simulate your edge", body: "Seeded Monte Carlo, risk of ruin, Kelly sizing and position-size stress — all based on your real R-multiples." },
      { target: CONTENT, title: "What-If, safely", body: "Scenarios are recomputed from your actual trades and never mutate your data. Opt-in, with a minimum sample." },
    ],
  },
  review: {
    key: "review",
    title: "Review Center",
    intro: "Turn closed trades into lessons you can act on.",
    steps: [
      { target: TITLE, title: "Review with discipline", body: "Closed trades queue here so nothing slips by unexamined." },
      { target: CONTENT, title: "Tag what it cost", body: "Tag mistakes, see what they actually cost per currency, and get one concrete adjustment backed by the trades that justify it." },
    ],
  },
  calendar: {
    key: "calendar",
    title: "Calendar",
    intro: "See your outcomes by day, month and year.",
    steps: [
      { target: TITLE, title: "Outcomes by date", body: "Recent, month and year views place realized results on their real exit date." },
      { target: CONTENT, title: "Honest days", body: "No-trade days stay distinct from break-even days, and INR/USD stay separate." },
    ],
  },
  notes: {
    key: "notes",
    title: "Notes & Journal",
    intro: "Keep your thinking linked to the trades it's about.",
    steps: [
      { target: TITLE, title: "Your journal", body: "Pre- and post-trade notes, organized by folders and collections." },
      { target: CONTENT, title: "Linked, not lost", body: "Rich-text notes with templates, linked to trades and playbooks so context is always one click away." },
    ],
  },
  reports: {
    key: "reports",
    title: "Reports & Data",
    intro: "Your vault is yours — report on it and take it with you.",
    steps: [
      { target: TITLE, title: "Share-ready reports", body: "Generate a deterministic, professional A4 PDF that looks the same on every device and theme." },
      { target: CONTENT, title: "Export & import", body: "Export everything as versioned JSON — trades, instruments, strategies, playbooks and notes — anytime." },
    ],
  },
  settings: {
    key: "settings",
    title: "Settings",
    intro: "Manage your account and how TradeVault works for you.",
    steps: [
      { target: TITLE, title: "Your account", body: "Profile, appearance, time zone, two-factor authentication and your password all live here." },
      { target: CONTENT, title: "Replay tours", body: "Changed your mind? You can replay every screen's guided tour from this page whenever you like." },
    ],
  },
};

/** Map an app pathname to its screen-tour key (exact matches only). */
export function tourKeyForPath(pathname: string): string | null {
  switch (pathname) {
    case "/":
      return "overview";
    case "/trades":
      return "trades";
    case "/trades/new":
      return "trade-new";
    case "/analytics":
      return "analytics";
    case "/risk":
      return "risk";
    case "/review":
      return "review";
    case "/calendar":
      return "calendar";
    case "/notes":
      return "notes";
    case "/reports":
      return "reports";
    case "/settings":
      return "settings";
    default:
      return null;
  }
}
