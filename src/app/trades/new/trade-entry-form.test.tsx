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
    platform: "Zerodha", currency: "INR",
  }],
};

describe("trade entry libraries", () => {
  it("backfills saved instrument defaults and exposes linked setup controls", async () => {
    const user = userEvent.setup();
    render(<TradeEntryForm initialEntryAt="2026-06-20T09:15" libraries={libraries} />);

    await user.type(screen.getByLabelText("Instrument / symbol"), "nifty");

    expect(screen.getByRole("status")).toHaveTextContent("Saved defaults applied for NIFTY");
    expect(screen.getByLabelText("Instrument type")).toHaveValue("Futures");
    expect(screen.getByLabelText("Quantity")).toHaveValue(2);
    expect(screen.getByLabelText("Lot / contract multiplier")).toHaveValue(50);
    expect(screen.getByLabelText("Trading style")).toHaveValue("Intraday");
    expect(screen.getByLabelText("Platform")).toHaveValue("Zerodha");
    expect(screen.getByLabelText("Strategy")).toHaveDisplayValue("Not set");
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
  });
});
