"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createTradeRepository } from "@/db/repositories/trades";
import { getDb } from "@/db/server";
import { requireWorkspaceSession } from "@/lib/workspace-session";

function safeReturnTo(formData: FormData) {
  const value = String(formData.get("returnTo") ?? "");
  return value === "/trades" || value.startsWith("/trades?") ? value : "/trades";
}

function withResult(path: string, result: string, count: number) {
  const [pathname, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  params.set("bulk", result);
  params.set("changed", String(count));
  return `${pathname}?${params}`;
}

export async function bulkTradeAction(formData: FormData) {
  const { scope, account } = await requireWorkspaceSession();
  const intent = String(formData.get("intent") ?? "");
  const reviewed = intent === "reviewed";
  const result = reviewed ? "reviewed" : intent === "unreviewed" ? "unreviewed" : "none";
  const count = result === "none" ? 0 : await createTradeRepository(getDb(), scope).bulkSetReviewed({
    accountId: account.id,
    tradeIds: formData.getAll("tradeId").map(String),
    reviewed,
  });

  revalidatePath("/trades");
  redirect(withResult(safeReturnTo(formData), count ? result : "none", count));
}
