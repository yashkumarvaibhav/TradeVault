"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db/server";
import { markTourSeen, resetTours, type TourStatus } from "@/db/repositories/tours";
import { getAuth } from "@/lib/auth-server";

/**
 * Persist that the signed-in user has seen a screen's tour. Fire-and-forget from the client;
 * fails closed (no-op) if there is no session so it can never throw into the UI.
 */
export async function markTourSeenAction(tourKey: string, status: TourStatus): Promise<void> {
  if (!tourKey || (status !== "completed" && status !== "dismissed")) return;
  const session = await getAuth().api.getSession({ headers: await headers() }).catch(() => null);
  if (!session) return;
  await markTourSeen(getDb(), session.user.id, tourKey, status);
}

/** Clear all of the signed-in user's tour progress so every screen tour shows again. */
export async function resetToursAction(): Promise<void> {
  const session = await getAuth().api.getSession({ headers: await headers() }).catch(() => null);
  if (!session) return;
  await resetTours(getDb(), session.user.id);
  revalidatePath("/", "layout");
}
