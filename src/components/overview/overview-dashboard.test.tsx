import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AppShell } from "@/components/app-shell";
import { OverviewDashboard } from "./overview-dashboard";

describe("overview visual milestone", () => {
  it("keeps money metrics in the selected currency and switches the whole view", async () => {
    const user = userEvent.setup();
    render(<OverviewDashboard />);

    expect(screen.getByText("₹18,420")).toBeVisible();
    expect(screen.getByText(/Money metrics are isolated to/)).toHaveTextContent("INR");

    const currency = screen.getByRole("combobox", { name: "Currency scope" });
    await user.click(currency);
    await user.click(screen.getByRole("option", { name: "USD" }));

    expect(screen.getByText("$486.75")).toBeVisible();
    expect(screen.getByText(/Money metrics are isolated to/)).toHaveTextContent("USD");
    expect(screen.getByRole("img", { name: /USD cumulative net P&L equity curve/i })).toBeVisible();
    expect(screen.queryByText("₹18,420")).not.toBeInTheDocument();
  });

  it("opens an accessible mobile navigation dialog", async () => {
    const user = userEvent.setup();
    render(<AppShell><p>Dashboard body</p></AppShell>);

    await user.click(screen.getByRole("button", { name: "Open navigation" }));
    expect(screen.getByRole("dialog", { name: "TradeVault navigation" })).toBeVisible();
    expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Close navigation" }));
    expect(screen.queryByRole("dialog", { name: "TradeVault navigation" })).not.toBeInTheDocument();
  });
});
