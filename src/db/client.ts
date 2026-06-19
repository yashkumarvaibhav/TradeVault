import { drizzle } from "drizzle-orm/node-postgres";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { Pool, type PoolConfig } from "pg";

import * as schema from "@/db/schema";

export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

export function createDatabase(
  connectionString = process.env.DATABASE_URL,
  poolOptions: Omit<PoolConfig, "connectionString"> = {},
) {
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to create the TradeVault database client.");
  }

  const pool = new Pool({ connectionString, ...poolOptions });
  return {
    db: drizzle(pool, { schema }),
    pool,
  };
}
