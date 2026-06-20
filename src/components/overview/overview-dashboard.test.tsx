import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AppShell } from "@/components/app-shell";
import { OverviewDashboard } from "./overview-dashboard";

describe("overview visual milestone", () => {
  it("keeps money metrics in the selected currency and switches the whole view", async () => {
    const user = userEvent.setup();
    render(<OverviewDashboard />);

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
