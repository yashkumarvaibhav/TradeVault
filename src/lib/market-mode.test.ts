import { describe, expect, it } from "vitest";

import { marketSwitchLabel, marketWorkspaceName, otherMarketCurrency, parseMarketCurrency } from "./market-mode";

describe("global market mode", () => {
  it("accepts only the exposed INR and USD scopes", () => {
    expect(parseMarketCurrency("USD")).toBe("USD");
    expect(parseMarketCurrency("EUR", "INR")).toBe("INR");
    expect(parseMarketCurrency(undefined, "USD")).toBe("USD");
  });

  it("maps each workspace to one explicit reverse action", () => {
    expect(marketWorkspaceName("INR")).toBe("Indian / INR trades");
    expect(marketSwitchLabel("INR")).toBe("Switch to International/USD Trades");
    expect(otherMarketCurrency("INR")).toBe("USD");
    expect(marketSwitchLabel("USD")).toBe("Switch to Indian/INR Trades");
  });
});
