import { eq } from "drizzle-orm";

import type { Database } from "@/db/client";
import { users } from "@/db/schema";
import { DEFAULT_TIME_ZONE, normalizeTimeZone } from "@/lib/date-time";

export async function getUserTimeZone(db: Database, userId: string): Promise<string> {
  const [user] = await db.select({ timeZone: users.timeZone }).from(users).where(eq(users.id, userId)).limit(1);
  return normalizeTimeZone(user?.timeZone ?? DEFAULT_TIME_ZONE);
}

export async function updateUserTimeZone(db: Database, userId: string, timeZone: string): Promise<string | null> {
  const normalized = normalizeTimeZone(timeZone);
  if (normalized !== timeZone) return null;
  const [updated] = await db.update(users).set({ timeZone: normalized, updatedAt: new Date() }).where(eq(users.id, userId)).returning({ timeZone: users.timeZone });
  return updated?.timeZone ?? null;
}
