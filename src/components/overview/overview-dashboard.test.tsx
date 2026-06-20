import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AppShell } from "@/components/app-shell";
import { OverviewDashboard, type PreviewData } from "./overview-dashboard";

const base = (netPnl: number): PreviewData => ({
  netPnl, winRate: 50, totalTrades: 2, expectancy: netPnl / 2, openRisk: 100, openPositions: 1, unreviewed: 1,
  reviewedCount: 0, ruleFollowRate: null, oldestPendingDays: 2,
  equity: [{ label: "1 Jun", value: netPnl }], monthlyPnl: [{ label: "Jun", value: netPnl }],
  returnDistribution: [{ range: "0% to 2%", count: 2 }], directions: [{ label: "Long", value: 2 }],
  strategies: [{ name: "Swing", trades: 2, winRate: 50, expectancy: netPnl / 2 }],
  trades: [{ symbol: "TEST", side: "Long", result: netPnl, r: 1, when: "1 Jun" }], calendar: { 1: netPnl },
  profitFactor: 2, avgR: 1, topSymbol: "TEST",
});
const dataByCurrency = { INR: base(18420), USD: base(486.75) };

describe("overview visual milestone", () => {
  it("keeps money metrics in the selected currency and switches the whole view", async () => {
    const user = userEvent.setup();
    render(<OverviewDashboard dataByCurrency={dataByCurrency} displayName="Yash" asOf="20 June 2026" />);

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

    const currency = screen.getByRole("combobox", { name: "Currency scope" });
    await user.click(currency);
    await user.click(screen.getByRole("option", { name: "USD" }));

    expect(screen.getAllByText("$486.75")[0]).toBeVisible();
    expect(screen.getByText(/Money metrics are isolated to/)).toHaveTextContent("USD");
    expect(screen.getByRole("img", { name: /USD cumulative net P&L equity curve/i })).toBeVisible();
    expect(screen.queryByText("₹18,420")).not.toBeInTheDocument();
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
