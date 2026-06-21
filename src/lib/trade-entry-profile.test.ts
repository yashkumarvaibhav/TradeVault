import { describe, expect, it } from "vitest";

import {
  assetChoiceForStored,
  classificationForChoice,
  currencyForMarketMode,
  tradeEntryProfile,
  underlyingChoices,
} from "./trade-entry-profile";

describe("adaptive trade-entry classification", () => {
  it("promotes stored derivative contracts to visible Futures/Options choices", () => {
    expect(assetChoiceForStored("Index", "Futures")).toBe("Futures");
    expect(assetChoiceForStored("Equity", "Options")).toBe("Options");
    expect(assetChoiceForStored("Forex", "Cash")).toBe("Forex");
  });

  it("keeps market currency and stored dimensions deterministic", () => {
    expect(currencyForMarketMode("domestic")).toBe("INR");
    expect(currencyForMarketMode("international")).toBe("USD");
    expect(classificationForChoice("Equity", "domestic")).toEqual({ assetClass: "Equity", instrumentType: "Cash", currency: "INR" });
    expect(classificationForChoice("Options", "international", "Equity")).toEqual({ assetClass: "Equity", instrumentType: "Options", currency: "USD" });
    expect(classificationForChoice("Futures", "domestic", "US Index")).toEqual({ assetClass: "Index", instrumentType: "Futures", currency: "INR" });
  });

  it("offers market-appropriate derivative underlyings and fields", () => {
    expect(underlyingChoices("domestic")).not.toContain("US Index");
    expect(underlyingChoices("international")).toContain("US Index");
    expect(tradeEntryProfile("Options", "domestic")).toMatchObject({
      entryPriceLabel: "Entry premium",
      quantityLabel: "Number of lots / contracts",
      showUnderlying: true,
      showExpiry: true,
      showOptionDetails: true,
    });
    expect(tradeEntryProfile("Forex", "international")).toMatchObject({
      symbolLabel: "Currency pair",
      symbolPlaceholder: "EURUSD, GBPUSD, AUDUSD",
      showMultiplier: true,
    });
    expect(tradeEntryProfile("Equity", "domestic")).toMatchObject({ quantityLabel: "Shares", showMultiplier: false });
  });
});
