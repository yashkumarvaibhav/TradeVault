import assert from "node:assert/strict";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import type { Database } from "../src/db/client";
import { ensureDefaultTradeLibraries } from "../src/db/repositories/libraries";
import { createNoteRepository } from "../src/db/repositories/notes";
import { createVaultSearchRepository } from "../src/db/repositories/search";
import { createTradeRepository } from "../src/db/repositories/trades";
import { provisionWorkspace } from "../src/db/repositories/workspaces";
import { instruments } from "../src/db/schema";
import * as schema from "../src/db/schema";

async function main() {
  const client = new PGlite();
  const db = drizzlePglite(client, { schema }) as unknown as Database;
  await migrate(db as never, {
    migrationsFolder: path.join(process.cwd(), "drizzle"),
    migrationsSchema: "drizzle",
    migrationsTable: "__tradevault_migrations",
  });

  try {
    const alpha = await provisionWorkspace(db, { username: "alpha_search", tenantSlug: "alpha-search", tenantName: "Alpha Search", defaultCurrency: "INR" });
    const beta = await provisionWorkspace(db, { username: "beta_search", tenantSlug: "beta-search", tenantName: "Beta Search", defaultCurrency: "USD" });
    await ensureDefaultTradeLibraries(db, alpha.scope);
    await ensureDefaultTradeLibraries(db, beta.scope);

    const alphaTrades = createTradeRepository(db, alpha.scope);
    const alphaTrade = await alphaTrades.create({
      accountId: alpha.account.id, symbol: "SEARCHINR", assetClass: "Equity", instrumentType: "Cash", direction: "Long", status: "closed",
      currency: "INR", entryAt: "2026-06-10T03:45:00.000Z", entryPrice: 100, exitAt: "2026-06-10T05:00:00.000Z", exitPrice: 112,
      quantity: 10, multiplier: 1, stopLoss: 95, plannedTarget: 115, manualPnl: null, fees: 20, fxToAccount: 1,
      tags: ["alpha-only", "clean-execution"], linkedNote: "Wait for teal level confirmation.",
    });
    await createTradeRepository(db, beta.scope).create({
      accountId: beta.account.id, symbol: "FOREIGNUSD", assetClass: "Equity", instrumentType: "Cash", direction: "Short", status: "closed",
      currency: "USD", entryAt: "2026-06-11T13:30:00.000Z", entryPrice: 200, exitAt: "2026-06-11T14:30:00.000Z", exitPrice: 190,
      quantity: 2, multiplier: 1, stopLoss: 205, plannedTarget: 185, manualPnl: null, fees: 2, fxToAccount: 1,
      tags: ["beta-secret"],
    });

    await db.insert(instruments).values({
      tenantId: alpha.tenant.id, symbol: "VAULTINDEX", name: "Vault Index Future", assetClass: "Index",
      instrumentType: "Futures", defaultCurrency: "INR", subcategory: "Index derivative",
    });
    const note = await createNoteRepository(db, alpha.scope).create({
      accountId: alpha.account.id, title: "Patience checklist", bodyText: "Wait for the lighthouse confirmation before entry.",
      noteType: "pre-trade", collection: "risk-rules", pinned: true,
    });

    const search = createVaultSearchRepository(db, alpha.scope);
    const defaults = await search.search(alpha.account.id, "", 15);
    assert.deepEqual(new Set(defaults.map((item) => item.kind)), new Set(["trade", "instrument", "strategy", "playbook", "note"]));

    const tradeResult = await search.search(alpha.account.id, "SEARCHINR");
    assert.equal(tradeResult[0]?.id, alphaTrade.id);
    assert.equal(tradeResult[0]?.currency, "INR");
    assert.equal(tradeResult[0]?.href, `/trades/${alphaTrade.id}`);
    assert.equal(typeof tradeResult[0]?.amount, "number");

    const hiddenBodyResult = await search.search(alpha.account.id, "lighthouse confirmation");
    assert.equal(hiddenBodyResult[0]?.id, note.id, "note body participates in server-side search");
    assert.equal(hiddenBodyResult[0]?.href, `/notes/${note.id}`);
    assert.deepEqual(Object.keys(hiddenBodyResult[0]).sort(), ["amount", "currency", "direction", "href", "id", "kind", "meta", "status", "title"].sort(), "only the public DTO crosses the boundary");
    assert.ok(!JSON.stringify(hiddenBodyResult).includes("lighthouse"), "matching note body is not returned to the client");

    assert.equal((await search.search(alpha.account.id, "FOREIGNUSD")).length, 0, "foreign trade is excluded");
    assert.equal((await search.search(alpha.account.id, "beta-secret")).length, 0, "foreign tags are excluded");
    assert.equal((await createVaultSearchRepository(db, beta.scope).search(beta.account.id, "SEARCHINR")).length, 0, "reverse tenant isolation holds");

    console.log("Vault search verified: all five record kinds, hidden-text matching, safe DTOs, exact links, per-currency trade metadata, and strict tenant/account isolation are green.");
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
