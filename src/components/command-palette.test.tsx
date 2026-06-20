import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CommandPalette } from "./command-palette";
import type { VaultSearchItem } from "@/lib/domain/vault-search";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

const records: VaultSearchItem[] = [
  { id: "trade-inr", kind: "trade", title: "RELIANCE", meta: "Long · Closed · Equity", href: "/trades/trade-inr", direction: "Long", status: "closed", currency: "INR", amount: 4200 },
  { id: "trade-usd", kind: "trade", title: "AAPL", meta: "Short · Closed · Equity", href: "/trades/trade-usd", direction: "Short", status: "closed", currency: "USD", amount: -118.4 },
  { id: "instrument", kind: "instrument", title: "NIFTY", meta: "Index · Futures · INR", href: "/trades?symbol=NIFTY", currency: "INR" },
  { id: "strategy", kind: "strategy", title: "Breakout", meta: "Strategy · Price expansion", href: "/trades?strategyId=strategy" },
  { id: "playbook", kind: "playbook", title: "Opening range", meta: "Intraday · 3 setup rules", href: "/trades?playbookId=playbook" },
  { id: "note", kind: "note", title: "Weekly intent", meta: "Daily Journal · Pinned", href: "/notes/note" },
];

const searchRecordsMock = vi.fn(async (query: string) => {
  const clean = query.toLowerCase().trim();
  if (clean === "private phrase") return records.filter((record) => record.kind === "note");
  return clean ? records.filter((record) => `${record.title} ${record.meta}`.toLowerCase().includes(clean)) : records;
});

function Harness({ onOpenChange }: { onOpenChange?: (open: boolean) => void } = {}) {
  const [open, setOpen] = React.useState(true);
  return (
    <CommandPalette
      open={open}
      navigate={pushMock}
      searchRecords={searchRecordsMock}
      onOpenChange={(next) => {
        onOpenChange?.(next);
        setOpen(next);
      }}
    />
  );
}

describe("command palette", () => {
  beforeEach(() => {
    document.documentElement.setAttribute("data-theme", "light");
    pushMock.mockReset();
    searchRecordsMock.mockClear();
  });

  afterEach(() => {
    document.documentElement.removeAttribute("data-theme");
  });

  it("exposes an accessible palette with live record groups and a keyboard footer", async () => {
    render(<Harness />);
    const dialog = screen.getByRole("dialog", { name: "Command palette" });
    expect(within(dialog).getByPlaceholderText(/Search views, actions, records/i)).toBeVisible();
    expect(within(dialog).getByRole("group", { name: /Navigate/i })).toBeInTheDocument();
    expect(within(dialog).getByRole("group", { name: /Actions/i })).toBeInTheDocument();
    expect(await within(dialog).findByRole("group", { name: /Recent records/i })).toBeInTheDocument();
    // "Navigate" is both a group heading and a footer hint; Select/Close are footer-only.
    expect(within(dialog).getAllByText("Navigate").length).toBeGreaterThanOrEqual(2);
    expect(within(dialog).getByText("Select")).toBeVisible();
    expect(within(dialog).getByText("Close")).toBeVisible();
  });

  it("keeps INR and USD record metadata separated, never combined", async () => {
    render(<Harness />);
    expect(await screen.findByText(/Long · Closed · Equity · \+₹4,200 · INR/)).toBeVisible();
    expect(screen.getByText(/Short · Closed · Equity · −\$118\.40 · USD/)).toBeVisible();
    expect(screen.getAllByText("Trades").length).toBeGreaterThan(0);
  });

  it("searches real record DTOs and follows their exact deep link", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByPlaceholderText(/Search views/i);

    await user.type(input, "Weekly intent");
    await vi.waitFor(() => expect(searchRecordsMock).toHaveBeenLastCalledWith("Weekly intent", expect.any(AbortSignal)));
    await user.click(await screen.findByText("Weekly intent"));

    expect(pushMock).toHaveBeenCalledWith("/notes/note");
  });

  it("shows a safe record DTO when only server-side private text matched", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByPlaceholderText(/Search views/i), "private phrase");

    expect(await screen.findByText("Weekly intent")).toBeVisible();
    expect(screen.queryByText("private phrase", { selector: "[cmdk-item] *" })).not.toBeInTheDocument();
  });

  it("filters to the theme action and toggles the theme on select", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Harness onOpenChange={onOpenChange} />);

    await user.type(screen.getByPlaceholderText(/Search views/i), "toggle theme");
    await user.click(screen.getByText("Toggle light / dark theme"));

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("navigates to a live view and closes the palette", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByPlaceholderText(/Search views/i), "Overview");
    await user.click(screen.getByText("Overview"));

    expect(pushMock).toHaveBeenCalledWith("/");
    expect(screen.queryByRole("dialog", { name: "Command palette" })).not.toBeInTheDocument();
  });
});
