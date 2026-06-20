"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createTradeRepository } from "@/db/repositories/trades";
import { getDb } from "@/db/server";
import { requireWorkspaceSession } from "@/lib/workspace-session";

import { parseTradeDraftFromForm } from "../trade-form-parse";

export interface TradeFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function createTradeAction(_previous: TradeFormState, formData: FormData): Promise<TradeFormState> {
  const { scope, account, timeZone } = await requireWorkspaceSession();
  const draft = {
    accountId: account.id,
    ...parseTradeDraftFromForm(formData, account.defaultCurrency, timeZone),
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
