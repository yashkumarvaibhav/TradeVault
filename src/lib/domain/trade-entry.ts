import { effectiveUnits, plannedRisk, plannedRR, realizedPnl, realizedR } from "./pnl";
import type { AssetClass, Currency, Direction, InstrumentType, TradeMath, TradeStatus } from "./types";

export interface TradeEntryDraft {
  symbol: string;
  assetClass: AssetClass;
  instrumentType: InstrumentType;
  direction: Direction;
  status: TradeStatus;
  currency: Currency;
  entryAt: string;
  entryPrice: number;
  exitAt: string | null;
  exitPrice: number | null;
  quantity: number;
  multiplier: number;
  stopLoss: number | null;
  plannedTarget: number | null;
  manualPnl: number | null;
  fees: number;
  fxToAccount: number;
  confidence?: number | null;
}

export type TradeEntryField = keyof TradeEntryDraft;
export type TradeEntryErrors = Partial<Record<TradeEntryField, string>>;

export interface TradeEntryPreview {
  effectiveUnits: number | null;
  positionValue: number | null;
  plannedRisk: number | null;
  plannedRewardRisk: number | null;
  realizedPnl: number | null;
  realizedR: number | null;
}

function positive(value: number) {
  return Number.isFinite(value) && value > 0;
}

function optionalFinite(value: number | null) {
  return value == null || Number.isFinite(value);
}

export function evaluateTradeEntry(draft: TradeEntryDraft): {
  errors: TradeEntryErrors;
  preview: TradeEntryPreview;
} {
  const errors: TradeEntryErrors = {};
  const symbol = draft.symbol.trim();
  if (!symbol) errors.symbol = "Enter an instrument or symbol.";
  if (!draft.entryAt || !Number.isFinite(Date.parse(draft.entryAt))) errors.entryAt = "Enter a valid entry date and time.";
  if (!positive(draft.entryPrice)) errors.entryPrice = "Entry price must be greater than zero.";
  if (!positive(draft.quantity)) errors.quantity = "Quantity must be greater than zero.";
  if (!positive(draft.multiplier)) errors.multiplier = "Multiplier must be greater than zero.";
  if (!Number.isFinite(draft.fees) || draft.fees < 0) errors.fees = "Fees cannot be negative.";
  if (!positive(draft.fxToAccount)) errors.fxToAccount = "FX conversion must be greater than zero.";
  if (!optionalFinite(draft.stopLoss)) errors.stopLoss = "Enter a valid stop price.";
  if (!optionalFinite(draft.plannedTarget)) errors.plannedTarget = "Enter a valid target price.";
  if (draft.confidence != null && (!Number.isInteger(draft.confidence) || draft.confidence < 1 || draft.confidence > 5)) {
    errors.confidence = "Confidence must be between 1 and 5.";
  }

  if (positive(draft.entryPrice) && draft.stopLoss != null && Number.isFinite(draft.stopLoss)) {
    if (draft.direction === "Long" && draft.stopLoss >= draft.entryPrice) errors.stopLoss = "A Long stop must be below entry.";
    if (draft.direction === "Short" && draft.stopLoss <= draft.entryPrice) errors.stopLoss = "A Short stop must be above entry.";
  }
  if (positive(draft.entryPrice) && draft.plannedTarget != null && Number.isFinite(draft.plannedTarget)) {
    if (draft.direction === "Long" && draft.plannedTarget <= draft.entryPrice) errors.plannedTarget = "A Long target must be above entry.";
    if (draft.direction === "Short" && draft.plannedTarget >= draft.entryPrice) errors.plannedTarget = "A Short target must be below entry.";
  }

  if (draft.status === "closed") {
    if (!draft.exitAt || !Number.isFinite(Date.parse(draft.exitAt))) {
      errors.exitAt = "Closed trades need an exit date and time.";
    } else if (draft.entryAt && Number.isFinite(Date.parse(draft.entryAt)) && Date.parse(draft.exitAt) < Date.parse(draft.entryAt)) {
      errors.exitAt = "Exit must be at or after entry.";
    }
    if (draft.exitPrice == null && draft.manualPnl == null) {
      errors.exitPrice = draft.assetClass === "Forex"
        ? "Enter an exit price or manual P&L."
        : "Closed trades need an exit price.";
    }
    if (draft.exitPrice != null && !positive(draft.exitPrice)) errors.exitPrice = "Exit price must be greater than zero.";
    if (draft.manualPnl != null && !Number.isFinite(draft.manualPnl)) errors.manualPnl = "Enter a valid manual P&L.";
  }

  const math: TradeMath = {
    status: draft.status,
    direction: draft.direction,
    currency: draft.currency,
    entryPrice: draft.entryPrice,
    stopLoss: draft.stopLoss,
    plannedTarget: draft.plannedTarget,
    exitPrice: draft.exitPrice,
    quantity: draft.quantity,
    multiplier: draft.multiplier,
    manualPnl: draft.manualPnl,
    fxToAccount: draft.fxToAccount,
  };
  const units = effectiveUnits(math);
  const validSizing = positive(draft.entryPrice) && positive(draft.quantity) && positive(draft.multiplier) && positive(draft.fxToAccount);
  const pnl = realizedPnl(math);

  return {
    errors,
    preview: {
      effectiveUnits: validSizing ? units : null,
      positionValue: validSizing ? draft.entryPrice * units * draft.fxToAccount : null,
      plannedRisk: plannedRisk(math),
      plannedRewardRisk: plannedRR(math),
      realizedPnl: pnl,
      realizedR: realizedR(math, pnl),
    },
  };
}
