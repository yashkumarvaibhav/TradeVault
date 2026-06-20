import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { CalendarDataByAsset } from "@/lib/calendar-data";
import type { CalendarAnalytics } from "@/lib/domain/calendar";
import { ASSET_OPTIONS } from "@/lib/trade-scope";
import { CalendarDashboard } from "./calendar-dashboard";

const inr: CalendarAnalytics = {
  currency: "INR", totalClosed: 1, totalReviews: 1, years: [2026],
  days: [{
    date: "2026-06-10", pnl: 100, realizedR: 1, count: 1, wins: 1, losses: 0, reviewCount: 1,
    reviewedTradeIds: ["trade-1"],
    trades: [{ id: "trade-1", symbol: "TESTINR", direction: "Long", entryAt: "2026-06-09T09:00:00Z", exitAt: "2026-06-10T10:00:00Z", entryPrice: 100, quantity: 1, pnl: 100, realizedR: 1, reviewed: true }],
  }],
};
const usd: CalendarAnalytics = {
  currency: "USD", totalClosed: 1, totalReviews: 0, years: [2026],
  days: [{
    date: "2026-06-11", pnl: -5, realizedR: -0.5, count: 1, wins: 0, losses: 1, reviewCount: 0, reviewedTradeIds: [],
    trades: [{ id: "trade-2", symbol: "TESTUSD", direction: "Short", entryAt: "2026-06-10T09:00:00Z", exitAt: "2026-06-11T10:00:00Z", entryPrice: 100, quantity: 1, pnl: -5, realizedR: -0.5, reviewed: false }],
  }],
};
const dataByAsset = Object.fromEntries(ASSET_OPTIONS.map((asset) => [asset, { INR: inr, USD: usd }])) as CalendarDataByAsset;

describe("CalendarDashboard", () => {
  it("shows selected-day evidence, switches modes, and keeps currencies isolated", async () => {
    const user = userEvent.setup();
    render(<CalendarDashboard dataByAsset={dataByAsset} nowIso="2026-06-20T12:00:00Z" initialMonth="2026-06" initialYear={2026} initialDay="2026-06-10" />);

    expect(screen.getByRole("heading", { name: "Calendar", level: 1 })).toBeVisible();
    expect(screen.getByRole("link", { name: "View TESTINR trade detail" })).toHaveAttribute("href", "/trades/trade-1");
    expect(screen.queryByText("TESTUSD")).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Year" }));
    expect(screen.getByRole("heading", { name: "2026 intensity" })).toBeVisible();

    await user.click(screen.getByRole("combobox", { name: "Currency scope" }));
    await user.click(screen.getByRole("option", { name: "USD" }));
    expect(screen.getByRole("link", { name: "View TESTUSD trade detail" })).toBeVisible();
    expect(screen.queryByText("TESTINR")).not.toBeInTheDocument();
    expect(screen.getByText(/Money cells are isolated to/)).toHaveTextContent("USD");

    await user.click(screen.getByRole("radio", { name: "Custom" }));
    expect(screen.getByRole("heading", { name: "Custom date range" })).toBeVisible();
    expect(screen.getByLabelText("From")).toBeVisible();
    expect(screen.getByLabelText("To")).toBeVisible();
  });
});
