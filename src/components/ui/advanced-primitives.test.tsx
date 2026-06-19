import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { describe, expect, it } from "vitest";

import { Combobox } from "./combobox";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "./dialog";
import { SegmentedControl, SegmentedControlItem } from "./segmented-control";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "./table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

describe("advanced TradeVault primitives", () => {
  it("focus-traps an explicitly labelled dialog and closes it", async () => {
    const user = userEvent.setup();
    render(
      <Dialog>
        <DialogTrigger>More filters</DialogTrigger>
        <DialogContent>
          <DialogTitle>Filter trades</DialogTitle>
          <DialogDescription>Narrow the current sample.</DialogDescription>
        </DialogContent>
      </Dialog>,
    );

    await user.click(screen.getByRole("button", { name: "More filters" }));
    expect(screen.getByRole("dialog", { name: "Filter trades" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Close dialog" }));
    expect(screen.queryByRole("dialog", { name: "Filter trades" })).not.toBeInTheDocument();
  });

  it("searches and selects a combobox option", async () => {
    const user = userEvent.setup();

    function Demo() {
      const [value, setValue] = React.useState("");
      return (
        <Combobox
          ariaLabel="Instrument"
          options={[
            { value: "nifty", label: "NIFTY FUT", keywords: ["index"] },
            { value: "reliance", label: "RELIANCE", keywords: ["equity"] },
          ]}
          value={value}
          onValueChange={setValue}
          placeholder="All instruments"
        />
      );
    }

    render(<Demo />);
    const trigger = screen.getByRole("combobox", { name: "Instrument" });
    await user.click(trigger);
    await user.type(screen.getByPlaceholderText("Search…"), "nifty");
    await user.click(screen.getByText("NIFTY FUT"));
    expect(trigger).toHaveTextContent("NIFTY FUT");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("switches tabs with native tab semantics", async () => {
    const user = userEvent.setup();
    render(
      <Tabs defaultValue="monthly">
        <TabsList aria-label="Performance diagnostic">
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
          <TabsTrigger value="returns">Returns</TabsTrigger>
        </TabsList>
        <TabsContent value="monthly">Monthly chart</TabsContent>
        <TabsContent value="returns">Return histogram</TabsContent>
      </Tabs>,
    );

    expect(screen.getByRole("tabpanel")).toHaveTextContent("Monthly chart");
    await user.click(screen.getByRole("tab", { name: "Returns" }));
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Return histogram");
  });

  it("exposes segmented selection without relying on color", async () => {
    const user = userEvent.setup();
    render(
      <SegmentedControl type="single" defaultValue="equity" aria-label="Chart mode">
        <SegmentedControlItem value="equity">Equity</SegmentedControlItem>
        <SegmentedControlItem value="drawdown">Drawdown</SegmentedControlItem>
      </SegmentedControl>,
    );

    const drawdown = screen.getByRole("radio", { name: "Drawdown" });
    await user.click(drawdown);
    expect(drawdown).toHaveAttribute("data-state", "on");
  });

  it("renders proper table and caption semantics", () => {
    render(
      <Table>
        <TableCaption>INR strategy results · preview sample</TableCaption>
        <TableHeader><TableRow><TableHead>Strategy</TableHead><TableHead>Net P&amp;L</TableHead></TableRow></TableHeader>
        <TableBody><TableRow><TableCell>Breakout</TableCell><TableCell>₹4,200</TableCell></TableRow></TableBody>
      </Table>,
    );

    expect(screen.getByRole("table", { name: /INR strategy results/i })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "Net P&L" })).toBeVisible();
  });
});
