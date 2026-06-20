"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createTradeRepository } from "@/db/repositories/trades";
import { getDb } from "@/db/server";
import { requireWorkspaceSession } from "@/lib/workspace-session";

import type { TradeFormState } from "../../new/actions";
import { parseTradeDraftFromForm } from "../../trade-form-parse";

export async function updateTradeAction(_previous: TradeFormState, formData: FormData): Promise<TradeFormState> {
  const { scope, account } = await requireWorkspaceSession();
  const tradeId = String(formData.get("tradeId") ?? "").trim();
  const draft = {
    accountId: account.id,
    tradeId,
    ...parseTradeDraftFromForm(formData, account.defaultCurrency),
  };

  let updated: Awaited<ReturnType<ReturnType<typeof createTradeRepository>["update"]>>;
  try {
    updated = await createTradeRepository(getDb(), scope).update(draft);
  } catch (error) {
    const fieldErrors = (error as { fieldErrors?: Record<string, string> }).fieldErrors;
    if (fieldErrors) return { error: "Review the highlighted fields.", fieldErrors };
    console.error("update trade failed", error);
    return { error: "The trade could not be saved. Try again." };
  }

  if (!updated) redirect("/trades?edit=missing");
  revalidatePath("/trades");
  revalidatePath(`/trades/${tradeId}`);
  redirect(`/trades/${tradeId}?updated=1`);
}
