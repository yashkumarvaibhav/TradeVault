import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { WhatIfWorkspace } from "./what-if-workspace";

const samples = Array.from({ length: 36 }, (_, index) => ({
  r: index % 3 === 0 ? -2 : index % 3 === 1 ? 1 : 2,
  currency: "USD" as const,
  quality: index % 2 ? 3 : 5,
  playbook: index % 2 ? "Reversal" : "Breakout",
  ruleFollowed: index % 4 !== 0,
}));

describe("WhatIfWorkspace", () => {
  it("applies a named preset, exposes the comparison, and resets", async () => {
    const user = userEvent.setup();
    render(<WhatIfWorkspace samples={samples} currency="USD" />);

    expect(screen.getByRole("heading", { name: "Build a transparent scenario" })).toBeVisible();
    expect(screen.getByRole("img", { name: /Baseline and What-If cumulative R for USD/ })).toBeVisible();
    expect(screen.getByText("+0.0R delta")).toBeVisible();

    await user.click(screen.getByRole("button", { name: /Cut losses/ }));
    expect(screen.getByText("+12.0R delta")).toBeVisible();
    expect(screen.getByText(/capping losses at −1.00R/)).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByText("+0.0R delta")).toBeVisible();
  });

  it("announces when evidence filters leave too little data", async () => {
    const user = userEvent.setup();
    render(<WhatIfWorkspace samples={samples} currency="USD" />);
    await user.click(screen.getByRole("button", { name: /Clean setups/ }));
    expect(screen.getByText(/filters leave 9 USD trades/i)).toBeVisible();
    expect(screen.getByText(/Widen the scenario to at least 30/)).toBeVisible();
  });
});
