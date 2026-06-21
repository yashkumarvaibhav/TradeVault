import { and, eq } from "drizzle-orm";

import type { Database } from "@/db/client";
import { tourProgress } from "@/db/schema";

export type TourStatus = "completed" | "dismissed";

/** Screen-tour keys a user has already seen (welcome card will not auto-open for these). */
export async function getSeenTourKeys(db: Database, userId: string): Promise<string[]> {
  const rows = await db
    .select({ tourKey: tourProgress.tourKey })
    .from(tourProgress)
    .where(eq(tourProgress.userId, userId));
  return rows.map((row) => row.tourKey);
}

/**
 * Record that the user has seen a screen's tour. Idempotent per (user, screen): re-running updates
 * the status/timestamp rather than inserting a duplicate. Once a row exists the welcome card stops
 * auto-opening, so a dismiss can never arrive after a completion in practice.
 */
export async function markTourSeen(
  db: Database,
  userId: string,
  tourKey: string,
  status: TourStatus,
): Promise<void> {
  await db
    .insert(tourProgress)
    .values({ userId, tourKey, status, seenAt: new Date() })
    .onConflictDoUpdate({
      target: [tourProgress.userId, tourProgress.tourKey],
      set: { status, seenAt: new Date() },
    });
}

/** Clear all of a user's tour progress so every screen tour shows again (Settings → replay). */
export async function resetTours(db: Database, userId: string): Promise<void> {
  await db.delete(tourProgress).where(eq(tourProgress.userId, userId));
}

/** Whether a specific screen tour has been seen (used by tests / targeted checks). */
export async function hasSeenTour(db: Database, userId: string, tourKey: string): Promise<boolean> {
  const [row] = await db
    .select({ id: tourProgress.id })
    .from(tourProgress)
    .where(and(eq(tourProgress.userId, userId), eq(tourProgress.tourKey, tourKey)))
    .limit(1);
  return Boolean(row);
}
