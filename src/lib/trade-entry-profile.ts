import type { AssetClass, Currency, InstrumentType } from "@/lib/domain/types";

export type TradeMarketMode = "domestic" | "international";
export type TradeAssetChoice = AssetClass | "Futures" | "Options";

export const domesticAssetChoices: readonly TradeAssetChoice[] = ["Equity", "Index", "Futures", "Options", "Commodity"];
export const internationalAssetChoices: readonly TradeAssetChoice[] = ["Forex", "Equity", "US Index", "Futures", "Options", "Commodity", "Crypto"];

export function marketModeForTrade(currency: Currency): TradeMarketMode {
  return currency === "USD" ? "international" : "domestic";
}

export function currencyForMarketMode(mode: TradeMarketMode): Currency {
  return mode === "international" ? "USD" : "INR";
}

/** Present derivatives as first-class choices while preserving the canonical stored dimensions. */
export function assetChoiceForStored(assetClass: AssetClass, instrumentType: InstrumentType): TradeAssetChoice {
  return instrumentType === "Cash" ? assetClass : instrumentType;
}

export function underlyingChoices(mode: TradeMarketMode): readonly AssetClass[] {
  return mode === "domestic"
    ? ["Index", "Equity", "Commodity"]
    : ["US Index", "Equity", "Commodity", "Forex", "Crypto"];
}

export function classificationForChoice(
  choice: TradeAssetChoice,
  mode: TradeMarketMode,
  preferredUnderlying?: AssetClass,
): { assetClass: AssetClass; instrumentType: InstrumentType; currency: Currency } {
  const currency = currencyForMarketMode(mode);
  if (choice !== "Futures" && choice !== "Options") {
    return { assetClass: choice, instrumentType: "Cash", currency };
  }
  const allowed = underlyingChoices(mode);
  const assetClass = preferredUnderlying && allowed.includes(preferredUnderlying)
    ? preferredUnderlying
    : allowed[0];
  return { assetClass, instrumentType: choice, currency };
}

export interface TradeEntryProfile {
  symbolLabel: string;
  symbolPlaceholder: string;
  quantityLabel: string;
  multiplierLabel: string;
  multiplierHint: string;
  entryPriceLabel: string;
  feesLabel: string;
  subcategoryLabel: string;
  subcategoryPlaceholder: string;
  showMultiplier: boolean;
  showUnderlying: boolean;
  showExpiry: boolean;
  showOptionDetails: boolean;
  showFxConversion: boolean;
}

/** Asset-specific copy/field contract used by Add and Edit Trade. */
export function tradeEntryProfile(choice: TradeAssetChoice, mode: TradeMarketMode): TradeEntryProfile {
  const common = {
    multiplierLabel: "Contract multiplier",
    multiplierHint: "Effective units = quantity × multiplier.",
    entryPriceLabel: "Entry price",
    feesLabel: "Fees / commission",
    showMultiplier: false,
    showUnderlying: false,
    showExpiry: false,
    showOptionDetails: false,
    showFxConversion: false,
  };

  if (choice === "Futures") return {
    ...common,
    symbolLabel: "Futures contract",
    symbolPlaceholder: mode === "domestic" ? "NIFTY JUN26, GOLDM JUL26" : "ESU26, BTC-PERP",
    quantityLabel: "Number of lots / contracts",
    multiplierLabel: "Lot / contract size",
    multiplierHint: "Units or point value carried by one lot or contract.",
    feesLabel: "Brokerage / exchange fees",
    subcategoryLabel: "Contract series",
    subcategoryPlaceholder: "Monthly, weekly, perpetual…",
    showMultiplier: true,
    showUnderlying: true,
    showExpiry: true,
  };
  if (choice === "Options") return {
    ...common,
    symbolLabel: "Options contract",
    symbolPlaceholder: mode === "domestic" ? "NIFTY 25000 CE" : "AAPL 220 CALL",
    quantityLabel: "Number of lots / contracts",
    multiplierLabel: "Lot / contract size",
    multiplierHint: "Units represented by one options contract or lot.",
    entryPriceLabel: "Entry premium",
    feesLabel: "Brokerage / exchange fees",
    subcategoryLabel: "Options strategy",
    subcategoryPlaceholder: "Single leg, vertical spread…",
    showMultiplier: true,
    showUnderlying: true,
    showExpiry: true,
    showOptionDetails: true,
  };
  if (choice === "Forex") return {
    ...common,
    symbolLabel: "Currency pair",
    symbolPlaceholder: "EURUSD, GBPJPY",
    quantityLabel: "Position size (units)",
    multiplierLabel: "Lot multiplier",
    multiplierHint: "Use 1 for units, or the units represented by one lot.",
    feesLabel: "Spread / commission",
    subcategoryLabel: "Pair type",
    subcategoryPlaceholder: "Major, minor, cross…",
    showMultiplier: true,
    showFxConversion: true,
  };
  if (choice === "Crypto") return {
    ...common,
    symbolLabel: "Crypto pair",
    symbolPlaceholder: "BTCUSD, ETHUSD",
    quantityLabel: "Coins / tokens",
    subcategoryLabel: "Market",
    subcategoryPlaceholder: "Spot, exchange, sector…",
  };
  if (choice === "Commodity") return {
    ...common,
    symbolLabel: "Commodity symbol",
    symbolPlaceholder: mode === "domestic" ? "GOLD, CRUDEOIL" : "XAUUSD, WTI",
    quantityLabel: "Units",
    subcategoryLabel: "Commodity group",
    subcategoryPlaceholder: "Metals, energy, agriculture…",
  };
  if (choice === "Index" || choice === "US Index") return {
    ...common,
    symbolLabel: choice === "US Index" ? "International index" : "Index / instrument",
    symbolPlaceholder: choice === "US Index" ? "NASDAQ, S&P 500" : "NIFTY, BANKNIFTY",
    quantityLabel: "Units",
    subcategoryLabel: "Index segment",
    subcategoryPlaceholder: "Broad market, sectoral…",
  };
  return {
    ...common,
    symbolLabel: mode === "international" ? "US stock symbol" : "Stock symbol",
    symbolPlaceholder: mode === "international" ? "AAPL, MSFT" : "RELIANCE, TCS",
    quantityLabel: "Shares",
    subcategoryLabel: "Sector / market cap",
    subcategoryPlaceholder: "Banking, large cap…",
  };
}
