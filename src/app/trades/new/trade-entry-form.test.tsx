import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { TradeEntryLibraries } from "@/db/repositories/libraries";

import { TradeEntryForm } from "./trade-entry-form";

vi.mock("./actions", () => ({ createTradeAction: vi.fn(async () => ({})) }));

const libraries: TradeEntryLibraries = {
  strategies: [{ id: "strategy-1", name: "Breakout", description: "Range expansion" }],
  closeReasons: [{ id: "reason-1", name: "Target hit" }],
  playbooks: [{ id: "playbook-1", name: "Opening range breakout", marketScope: "Intraday", setupRules: [] }],
  checklistTemplates: [{ id: "checklist-1", name: "Core trade discipline", items: [
    { id: "thesis", label: "Thesis written", phase: "entry" },
    { id: "review", label: "Review ready", phase: "exit" },
  ] }],
  instruments: [{
    id: "instrument-1", symbol: "NIFTY", name: null, assetClass: "Index", instrumentType: "Futures",
    subcategory: "Core market", tradingStyle: "Intraday", quantity: "2.000000", multiplier: "50.000000",
    platform: "Zerodha", currency: "INR", expiryDate: "2026-06-25", optionSide: null, strikePrice: null,
  }],
};

describe("trade entry libraries", () => {
  it("backfills saved instrument defaults and exposes linked setup controls", async () => {
    const user = userEvent.setup();
    render(<TradeEntryForm initialEntryAt="2026-06-20T09:15" libraries={libraries} />);

    await user.type(screen.getByLabelText("Stock symbol"), "nifty");

    expect(screen.getByRole("status")).toHaveTextContent("Saved defaults applied for NIFTY");
    expect(screen.getByRole("radio", { name: "Futures" })).toBeChecked();
    expect(screen.queryByLabelText("Instrument type")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Number of lots / contracts")).toHaveValue(2);
    expect(screen.getByLabelText("Lot / contract size")).toHaveValue(50);
    expect(screen.getByLabelText("Contract expiry (optional)")).toHaveValue("2026-06-25");
    expect(screen.getByLabelText("Trading style")).toHaveValue("Intraday");
    expect(screen.getByLabelText("Platform")).toHaveValue("Zerodha");
    expect(screen.getByLabelText("Strategy")).toHaveDisplayValue("Not set");
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
  });

  it("inherits the global market currency and reveals only relevant asset fields", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<TradeEntryForm initialEntryAt="2026-06-20T09:15" initialCurrency="INR" libraries={{ ...libraries, instruments: [] }} />);

    expect(screen.getByLabelText("Trade currency")).toHaveValue("INR");
    expect(screen.getByLabelText("Shares")).toBeInTheDocument();
    expect(screen.queryByLabelText("Instrument type")).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Options" }));
    expect(screen.getByLabelText("Underlying market")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Option type" })).toBeInTheDocument();
    expect(screen.getByLabelText("Strike price (optional)")).toBeInTheDocument();
    expect(screen.getByLabelText("Entry premium")).toBeInTheDocument();

    rerender(<TradeEntryForm key="USD" initialEntryAt="2026-06-20T09:15" initialCurrency="USD" libraries={{ ...libraries, instruments: [] }} />);
    expect(screen.getByLabelText("Trade currency")).toHaveValue("USD");
    expect(screen.getByLabelText("Currency pair")).toBeInTheDocument();
    expect(screen.getByLabelText("Position size (units)")).toBeInTheDocument();
    expect(screen.queryByLabelText("Quote-to-USD conversion")).not.toBeInTheDocument();
    expect(screen.getByText(/automatic risk and price-based P&L assume a USD-quoted pair/i)).toBeVisible();
  });
});
