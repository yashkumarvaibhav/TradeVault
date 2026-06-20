"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createTradeRepository } from "@/db/repositories/trades";
import { getDb } from "@/db/server";
import { requireWorkspaceSession } from "@/lib/workspace-session";

const value = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

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
  revalidatePath(`/trades/${tradeId}`);
  redirect(`/trades/${tradeId}?reviewed=1`);
}
