import assert from "node:assert/strict";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import { getTradeEntryLibraries, ensureDefaultTradeLibraries } from "../src/db/repositories/libraries";
import { provisionWorkspace } from "../src/db/repositories/workspaces";
import * as schema from "../src/db/schema";

async function main() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  try {
    await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle"), migrationsSchema: "drizzle", migrationsTable: "__tradevault_migrations" });
    const alpha = await provisionWorkspace(db, { username: "alpha", tenantSlug: "alpha", tenantName: "Alpha" });
    const beta = await provisionWorkspace(db, { username: "beta", tenantSlug: "beta", tenantName: "Beta" });

    await ensureDefaultTradeLibraries(db, alpha.scope);
    await ensureDefaultTradeLibraries(db, alpha.scope);
    await ensureDefaultTradeLibraries(db, beta.scope);

    const alphaLibraries = await getTradeEntryLibraries(db, alpha.scope);
    const betaLibraries = await getTradeEntryLibraries(db, beta.scope);
    assert.equal(alphaLibraries.strategies.length, 3, "defaults stay idempotent");
    assert.equal(alphaLibraries.closeReasons.length, 5);
    assert.equal(alphaLibraries.playbooks.length, 2);
    assert.equal(alphaLibraries.checklistTemplates.length, 1);
    assert.equal(alphaLibraries.instruments.length, 0);
    assert.notEqual(alphaLibraries.strategies[0].id, betaLibraries.strategies[0].id, "libraries are tenant-owned");
    assert.deepEqual(alphaLibraries.strategies.map(({ name }) => name), betaLibraries.strategies.map(({ name }) => name));
    console.log("Trade libraries verified: idempotent defaults, checklist template, and tenant isolation are green.");
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
