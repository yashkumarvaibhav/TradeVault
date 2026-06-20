import "server-only";

import { createDatabase, type Database } from "./client";

let database: Database | null = null;

/** Lazy process-wide database handle (single pool), shared by auth + server actions. */
export function getDb(): Database {
  if (!database) {
    database = createDatabase().db;
  }
  return database;
}
