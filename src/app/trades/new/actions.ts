"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createTradeRepository } from "@/db/repositories/trades";
import { getDb } from "@/db/server";
import { assetClasses, currencyCodes, instrumentTypes, tradeDirections, tradeStatuses } from "@/db/schema";
import type { SetupChecklistItem } from "@/db/schema";
import type { AssetClass, Currency, Direction, InstrumentType, TradeStatus } from "@/lib/domain/types";
import { requireWorkspaceSession } from "@/lib/workspace-session";

export interface TradeFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

function value(form: FormData, name: string) { return String(form.get(name) ?? "").trim(); }
function optionalNumber(form: FormData, name: string) {
  const raw = value(form, name);
  return raw === "" ? null : Number(raw);
}
function enumValue<T extends readonly string[]>(raw: string, allowed: T, fallback: T[number]): T[number] {
  return allowed.includes(raw as T[number]) ? raw as T[number] : fallback;
}

function checklist(form: FormData): SetupChecklistItem[] {
  try {
    const parsed = JSON.parse(value(form, "setupChecklist")) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item): SetupChecklistItem[] => {
      if (!item || typeof item !== "object") return [];
      const candidate = item as Partial<SetupChecklistItem>;
      if (typeof candidate.id !== "string" || typeof candidate.label !== "string" || !["entry", "exit"].includes(candidate.phase ?? "")) return [];
      return [{ id: candidate.id.slice(0, 80), label: candidate.label.trim().slice(0, 180), phase: candidate.phase as "entry" | "exit", completed: candidate.completed === true }];
    }).filter((item) => item.label);
  } catch {
    return [];
  }
}

export async function createTradeAction(_previous: TradeFormState, formData: FormData): Promise<TradeFormState> {
  const { scope, account } = await requireWorkspaceSession();
  const draft = {
    accountId: account.id,
    strategyId: value(formData, "strategyId") || null,
    playbookId: value(formData, "playbookId") || null,
    closeReasonId: value(formData, "closeReasonId") || null,
    symbol: value(formData, "symbol"),
    assetClass: enumValue(value(formData, "assetClass"), assetClasses, "Equity") as AssetClass,
    instrumentType: enumValue(value(formData, "instrumentType"), instrumentTypes, "Cash") as InstrumentType,
    direction: enumValue(value(formData, "direction"), tradeDirections, "Long") as Direction,
    status: enumValue(value(formData, "status"), tradeStatuses, "open") as TradeStatus,
    currency: enumValue(value(formData, "currency"), currencyCodes, account.defaultCurrency) as Currency,
    entryAt: value(formData, "entryAt"),
    entryPrice: Number(value(formData, "entryPrice")),
    exitAt: value(formData, "exitAt") || null,
    exitPrice: optionalNumber(formData, "exitPrice"),
    quantity: Number(value(formData, "quantity")),
    multiplier: Number(value(formData, "multiplier") || "1"),
    stopLoss: optionalNumber(formData, "stopLoss"),
    plannedTarget: optionalNumber(formData, "plannedTarget"),
    manualPnl: optionalNumber(formData, "manualPnl"),
    fees: Number(value(formData, "fees") || "0"),
    fxToAccount: Number(value(formData, "fxToAccount") || "1"),
    subcategory: value(formData, "subcategory"),
    tradingStyle: value(formData, "tradingStyle"),
    platform: value(formData, "platform"),
    confidence: optionalNumber(formData, "confidence"),
    emotion: value(formData, "emotion"),
    tags: value(formData, "tags").split(","),
    ruleViolations: value(formData, "ruleViolations"),
    linkedNote: value(formData, "linkedNote"),
    notes: value(formData, "notes"),
    setupChecklist: checklist(formData),
  };

  try {
    await createTradeRepository(getDb(), scope).create(draft);
  } catch (error) {
    const fieldErrors = (error as { fieldErrors?: Record<string, string> }).fieldErrors;
    if (fieldErrors) return { error: "Review the highlighted fields.", fieldErrors };
    console.error("create trade failed", error);
    return { error: "The trade could not be saved. Try again." };
  }

  revalidatePath("/trades");
  redirect(formData.get("intent") === "another" ? "/trades/new?saved=1" : "/trades?created=1");
}
