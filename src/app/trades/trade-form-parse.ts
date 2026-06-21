import { assetClasses, currencyCodes, instrumentTypes, tradeDirections, tradeStatuses } from "@/db/schema";
import type { SetupChecklistItem } from "@/db/schema";
import type { AssetClass, Currency, Direction, InstrumentType, TradeStatus } from "@/lib/domain/types";
import { zonedDateTimeToIso } from "@/lib/date-time";

function value(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim();
}
function optionalNumber(form: FormData, name: string) {
  const raw = value(form, name);
  return raw === "" ? null : Number(raw);
}
function enumValue<T extends readonly string[]>(raw: string, allowed: T, fallback: T[number]): T[number] {
  return allowed.includes(raw as T[number]) ? (raw as T[number]) : fallback;
}

function checklist(form: FormData): SetupChecklistItem[] {
  try {
    const parsed = JSON.parse(value(form, "setupChecklist")) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .flatMap((item): SetupChecklistItem[] => {
        if (!item || typeof item !== "object") return [];
        const candidate = item as Partial<SetupChecklistItem>;
        if (typeof candidate.id !== "string" || typeof candidate.label !== "string" || !["entry", "exit"].includes(candidate.phase ?? "")) return [];
        return [{ id: candidate.id.slice(0, 80), label: candidate.label.trim().slice(0, 180), phase: candidate.phase as "entry" | "exit", completed: candidate.completed === true }];
      })
      .filter((item) => item.label);
  } catch {
    return [];
  }
}

/** Shared parser for the trade entry form, used by both create and edit. */
export function parseTradeDraftFromForm(form: FormData, defaultCurrency: Currency, timeZone: string) {
  const entryAt = value(form, "entryAt");
  const exitAt = value(form, "exitAt");
  return {
    strategyId: value(form, "strategyId") || null,
    playbookId: value(form, "playbookId") || null,
    closeReasonId: value(form, "closeReasonId") || null,
    symbol: value(form, "symbol"),
    assetClass: enumValue(value(form, "assetClass"), assetClasses, "Equity") as AssetClass,
    instrumentType: enumValue(value(form, "instrumentType"), instrumentTypes, "Cash") as InstrumentType,
    direction: enumValue(value(form, "direction"), tradeDirections, "Long") as Direction,
    status: enumValue(value(form, "status"), tradeStatuses, "open") as TradeStatus,
    currency: enumValue(value(form, "currency"), currencyCodes, defaultCurrency) as Currency,
    entryAt: zonedDateTimeToIso(entryAt, timeZone) ?? entryAt,
    entryPrice: Number(value(form, "entryPrice")),
    exitAt: exitAt ? (zonedDateTimeToIso(exitAt, timeZone) ?? exitAt) : null,
    exitPrice: optionalNumber(form, "exitPrice"),
    quantity: Number(value(form, "quantity")),
    multiplier: Number(value(form, "multiplier") || "1"),
    stopLoss: optionalNumber(form, "stopLoss"),
    plannedTarget: optionalNumber(form, "plannedTarget"),
    manualPnl: optionalNumber(form, "manualPnl"),
    fees: Number(value(form, "fees") || "0"),
    fxToAccount: Number(value(form, "fxToAccount") || "1"),
    mfePrice: optionalNumber(form, "mfePrice"),
    maePrice: optionalNumber(form, "maePrice"),
    subcategory: value(form, "subcategory"),
    expiryDate: value(form, "expiryDate") || null,
    optionSide: (value(form, "optionSide") === "Call" || value(form, "optionSide") === "Put")
      ? value(form, "optionSide") as "Call" | "Put"
      : null,
    strikePrice: optionalNumber(form, "strikePrice"),
    tradingStyle: value(form, "tradingStyle"),
    platform: value(form, "platform"),
    confidence: optionalNumber(form, "confidence"),
    emotion: value(form, "emotion"),
    tags: value(form, "tags").split(","),
    ruleViolations: value(form, "ruleViolations"),
    linkedNote: value(form, "linkedNote"),
    notes: value(form, "notes"),
    setupChecklist: checklist(form),
  };
}
