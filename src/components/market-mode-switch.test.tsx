import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MarketModeSwitch } from "./market-mode-switch";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

describe("MarketModeSwitch", () => {
  beforeEach(() => {
    refresh.mockClear();
    document.cookie = "tradevault_market_currency=; Max-Age=0; Path=/";
  });

  it("persists the reverse market and refreshes server-scoped screens", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<MarketModeSwitch currency="INR" />);

    await user.click(screen.getByRole("button", { name: "Switch to International/USD Trades" }));

    expect(document.cookie).toContain("tradevault_market_currency=USD");
    expect(refresh).toHaveBeenCalledOnce();
    rerender(<MarketModeSwitch currency="USD" />);
    expect(screen.getByText("International / USD trades")).toBeVisible();
  });
});
