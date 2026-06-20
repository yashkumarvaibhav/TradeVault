"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createTradeRepository } from "@/db/repositories/trades";
import { getDb } from "@/db/server";
import type { TradeEntryErrors } from "@/lib/domain/trade-entry";
import { requireWorkspaceSession } from "@/lib/workspace-session";

const value = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();
const numberOrNull = (formData: FormData, name: string) => {
  const raw = value(formData, name);
  if (raw === "") return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

export interface CloseTradeState {
  error?: string;
  fieldErrors?: TradeEntryErrors;
}

export async function closeTradeAction(_prev: CloseTradeState, formData: FormData): Promise<CloseTradeState> {
  const { scope, account } = await requireWorkspaceSession();
  const tradeId = value(formData, "tradeId");
  const exitAtRaw = value(formData, "exitAt");
  const feesRaw = numberOrNull(formData, "fees");

  let result: Awaited<ReturnType<ReturnType<typeof createTradeRepository>["closeTrade"]>>;
  try {
    result = await createTradeRepository(getDb(), scope).closeTrade({
      accountId: account.id,
      tradeId,
      exitAt: exitAtRaw,
      exitPrice: numberOrNull(formData, "exitPrice"),
      manualPnl: numberOrNull(formData, "manualPnl"),
      fees: feesRaw == null ? 0 : feesRaw,
      closeReasonId: value(formData, "closeReasonId") || null,
      notes: formData.has("notes") ? value(formData, "notes") : undefined,
    });
  } catch (error) {
    const fieldErrors = (error as { fieldErrors?: TradeEntryErrors }).fieldErrors;
    if (fieldErrors) return { error: "Some close details need attention.", fieldErrors };
    return { error: "Could not close this trade. Try again." };
  }

  if (result.status === "missing") redirect("/trades?close=missing");
  if (result.status === "already-closed") redirect(`/trades/${tradeId}?close=already`);
  revalidatePath("/trades");
  revalidatePath("/review");
  revalidatePath("/");
  revalidatePath(`/trades/${tradeId}`);
  redirect(`/trades/${tradeId}?closed=1`);
}

export async function saveTradeReviewAction(formData: FormData) {
  const { scope, account } = await requireWorkspaceSession();
  const tradeId = value(formData, "tradeId");
  const confidence = Number(value(formData, "confidence"));
  const reviewed = await createTradeRepository(getDb(), scope).saveReview({
    accountId: account.id,
    tradeId,
    confidence: Number.isInteger(confidence) && confidence >= 1 && confidence <= 5 ? confidence : null,
    emotion: value(formData, "emotion"),
    ruleViolations: value(formData, "ruleViolations"),
    notes: value(formData, "notes"),
    completedChecklistIds: formData.getAll("checklistCompleted").map(String),
  });
  if (!reviewed) redirect("/trades?review=missing");
  revalidatePath("/trades");
  revalidatePath("/review");
  revalidatePath("/");
  revalidatePath(`/trades/${tradeId}`);
  redirect(`/trades/${tradeId}?reviewed=1`);
}
