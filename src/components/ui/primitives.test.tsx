import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Button } from "./button";
import { Chip } from "./chip";
import { Input } from "./input";
import { Label } from "./label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

describe("TradeVault UI primitives", () => {
  it("keeps native button and disabled semantics", async () => {
    const user = userEvent.setup();
    let presses = 0;
    render(
      <Button disabled onClick={() => (presses += 1)}>
        Add trade
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Add trade" });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(presses).toBe(0);
  });

  it("connects labels and exposes invalid input state", () => {
    render(
      <div>
        <Label htmlFor="symbol">Instrument</Label>
        <Input id="symbol" aria-invalid="true" />
      </div>,
    );

    expect(screen.getByLabelText("Instrument")).toHaveAttribute("aria-invalid", "true");
  });

  it("opens a keyboard-accessible select and chooses a currency", async () => {
    const user = userEvent.setup();
    render(
      <Select defaultValue="INR">
        <SelectTrigger aria-label="Currency">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="INR">INR</SelectItem>
          <SelectItem value="USD">USD</SelectItem>
        </SelectContent>
      </Select>,
    );

    const trigger = screen.getByRole("combobox", { name: "Currency" });
    expect(trigger).toHaveTextContent("INR");
    await user.click(trigger);
    await user.click(screen.getByRole("option", { name: "USD" }));
    expect(trigger).toHaveTextContent("USD");
  });

  it("renders status chips as text, not unlabeled color", () => {
    render(<Chip tone="profit">Profitable</Chip>);
    expect(screen.getByText("Profitable")).toBeVisible();
  });
});
