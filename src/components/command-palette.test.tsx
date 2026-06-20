import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CommandPalette } from "./command-palette";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

function Harness({ onOpenChange }: { onOpenChange?: (open: boolean) => void } = {}) {
  const [open, setOpen] = React.useState(true);
  return (
    <CommandPalette
      open={open}
      navigate={pushMock}
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
  });

  afterEach(() => {
    document.documentElement.removeAttribute("data-theme");
  });

  it("exposes an accessible palette with grouped commands and a keyboard footer", () => {
    render(<Harness />);
    const dialog = screen.getByRole("dialog", { name: "Command palette" });
    expect(within(dialog).getByPlaceholderText(/Search views, actions, records/i)).toBeVisible();
    expect(within(dialog).getByRole("group", { name: /Navigate/i })).toBeInTheDocument();
    expect(within(dialog).getByRole("group", { name: /Actions/i })).toBeInTheDocument();
    expect(within(dialog).getByRole("group", { name: /Sample records/i })).toBeInTheDocument();
    // "Navigate" is both a group heading and a footer hint; Select/Close are footer-only.
    expect(within(dialog).getAllByText("Navigate").length).toBeGreaterThanOrEqual(2);
    expect(within(dialog).getByText("Select")).toBeVisible();
    expect(within(dialog).getByText("Close")).toBeVisible();
  });

  it("keeps INR and USD record metadata separated, never combined", () => {
    render(<Harness />);
    expect(screen.getByText(/Long · \+₹4,200 · INR/)).toBeVisible();
    expect(screen.getByText(/Short · −\$118\.40 · USD/)).toBeVisible();
    expect(screen.getAllByText("Trades").length).toBeGreaterThan(0);
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
