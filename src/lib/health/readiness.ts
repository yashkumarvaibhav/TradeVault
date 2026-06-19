import { sql } from "drizzle-orm";

import { createDatabase } from "@/db/client";

export type ReadinessResult =
  | { ready: true; database: "reachable" }
  | { ready: false; database: "not_configured" | "unreachable" };

async function queryDatabase(databaseUrl: string) {
  const { db, pool } = createDatabase(databaseUrl, {
    connectionTimeoutMillis: 2_000,
    idleTimeoutMillis: 2_000,
    max: 1,
  });
  try {
    await db.execute(sql`select 1`);
  } finally {
    await pool.end();
  }
}

export async function checkReadiness({
  databaseUrl,
  checkDatabase = queryDatabase,
}: {
  databaseUrl: string | null;
  checkDatabase?: (databaseUrl: string) => Promise<void>;
}): Promise<ReadinessResult> {
  if (!databaseUrl) return { ready: false, database: "not_configured" };
  try {
    await checkDatabase(databaseUrl);
    return { ready: true, database: "reachable" };
  } catch {
    return { ready: false, database: "unreachable" };
  }
}
