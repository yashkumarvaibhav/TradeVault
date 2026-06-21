import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { AppShell } from "@/components/app-shell";
import { OverviewDashboard, type PreviewData } from "./overview-dashboard";

const base = (netPnl: number): PreviewData => ({
  netPnl, winRate: 50, totalTrades: 2, expectancy: netPnl / 2, openRisk: 100, openPositions: 1, unreviewed: 1,
  reviewedCount: 0, ruleFollowRate: null, oldestPendingDays: 2,
  equity: [{ label: "1 Jun", value: netPnl }], monthlyPnl: [{ label: "Jun", value: netPnl }],
  returnDistribution: [{ range: "0% to 2%", count: 2 }], directions: [{ label: "Long", value: 2 }],
  strategies: [{ name: "Swing", trades: 2, winRate: 50, expectancy: netPnl / 2 }],
  trades: [{ id: "trade-1", symbol: "TEST", side: "Long", result: netPnl, r: 1, when: "1 Jun" }],
  openTrades: [{ id: "open-1", symbol: "OPENPOS", side: "Long", risk: 100, when: "2 Jun" }], calendar: { 1: netPnl },
  profitFactor: 2, avgR: 1, topSymbol: "TEST",
});
const dataByCurrency = { INR: base(18420), USD: base(486.75) };
const scope = { period: "all", asset: "Overall", month: "2026-06" } as const;

describe("overview visual milestone", () => {
  it("keeps money metrics in the selected currency and switches the whole view", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<OverviewDashboard dataByCurrency={dataByCurrency} currency="INR" displayName="Yash" asOf="20 June 2026" scope={scope} />);

    expect(screen.getAllByText("₹18,420")[0]).toBeVisible();
    expect(screen.getByText(/Money metrics are isolated to/)).toHaveTextContent("INR");

    await user.click(screen.getByRole("radio", { name: "Drawdown" }));
    expect(screen.getByRole("img", { name: /INR underwater drawdown curve/i })).toBeVisible();
    await user.click(screen.getByRole("radio", { name: "Equity" }));

    await user.click(screen.getByRole("tab", { name: "Return distribution" }));
    expect(screen.getByRole("img", { name: /Return distribution histogram/i })).toBeVisible();
    expect(screen.getByRole("img", { name: /Long vs Short donut chart/i })).toBeVisible();

    await user.click(screen.getByRole("tab", { name: "Outcome intensity" }));
    expect(screen.getByRole("img", { name: /Daily outcome intensity heatmap/i })).toBeVisible();

    rerender(<OverviewDashboard dataByCurrency={dataByCurrency} currency="USD" displayName="Yash" asOf="20 June 2026" scope={scope} />);

    expect(screen.getAllByText("$486.75")[0]).toBeVisible();
    expect(screen.getByText(/Money metrics are isolated to/)).toHaveTextContent("USD");
    expect(screen.getByRole("img", { name: /USD cumulative net P&L equity curve/i })).toBeVisible();
    expect(screen.queryByText("₹18,420")).not.toBeInTheDocument();
  });

  it("deep-links recent trades and open positions and reflects active scope", () => {
    render(<OverviewDashboard dataByCurrency={dataByCurrency} currency="INR" displayName="Yash" asOf="20 June 2026" scope={{ period: "30d", asset: "Forex", month: "2026-06" }} />);
    expect(screen.getByRole("link", { name: /TEST/ })).toHaveAttribute("href", "/trades/trade-1");
    expect(screen.getByRole("link", { name: /OPENPOS/ })).toHaveAttribute("href", "/trades/open-1");
    expect(screen.getByRole("link", { name: "Review closed trades" })).toHaveAttribute("href", "/review#review-queue");
    expect(screen.getByRole("link", { name: "Open calendar" })).toHaveAttribute("href", "/calendar?mode=month&month=2026-06");
    expect(screen.getAllByText("Last 30 days").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Forex").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Reset scope" })).toHaveAttribute("href", "/");
  });

  it("opens an accessible mobile navigation dialog", async () => {
    const user = userEvent.setup();
    render(<AppShell user={{ displayName: "TraderJoe", username: "traderjoe" }}><p>Dashboard body</p></AppShell>);

    await user.click(screen.getByRole("button", { name: "Open navigation" }));
    expect(screen.getByRole("dialog", { name: "TradeVault navigation" })).toBeVisible();
    expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Close navigation" }));
    expect(screen.queryByRole("dialog", { name: "TradeVault navigation" })).not.toBeInTheDocument();
  });
});
