/**
 * TradeVault domain types — the currency/asset model shared by the math engine.
 *
 * Money is modeled as a tagged { currency, amount } so that summing across
 * currencies is impossible without going through an explicit helper. INR and
 * USD are NEVER added raw (hard product invariant).
 */

export type Currency = "INR" | "USD";

export type Direction = "Long" | "Short";

export type TradeStatus = "open" | "closed";

/** Underlying market. Instrument type below decides the contract shape. */
export type AssetClass =
  | "Equity"
  | "Index"
  | "Forex"
  | "Commodity"
  | "US Index"
  | "Crypto";

/** Contract structure layered on the asset class. */
export type InstrumentType = "Cash" | "Futures" | "Options";

/** A currency-tagged amount. Never add two of different currencies raw. */
export interface Money {
  currency: Currency;
  amount: number;
}

/**
 * The minimal set of fields the math engine needs. The generalized P&L engine
 * is category-agnostic: it works from `quantity × multiplier` (effective units)
 * rather than branching on asset class. The multiplier carries the lot/contract
 * /point value (1 for spot equity/crypto), so it subsumes v1's lot-size logic.
 */
export interface TradeMath {
  status: TradeStatus;
  direction: Direction;
  currency: Currency;

  entryPrice: number | null;
  stopLoss: number | null;
  plannedTarget?: number | null;
  exitPrice?: number | null;

  /** Position size: shares / coins / contracts / lots / units. */
  quantity: number;
  /** Lot/contract size or point value. Defaults to 1. */
  multiplier?: number;

  /**
   * Forex (or any) manual-P&L override, signed and already in account currency.
   * When set on a closed trade it takes precedence over price-based P&L.
   */
  manualPnl?: number | null;

  /**
   * Quote-currency → account-currency conversion factor. Defaults to 1 (used
   * when the pair's quote currency is the account currency). Cross-pair
   * conversions are supplied by the caller or handled via manualPnl.
   */
  fxToAccount?: number;
}
