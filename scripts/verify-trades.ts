import assert from "node:assert/strict";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import type { Database } from "../src/db/client";
import { createTradeRepository } from "../src/db/repositories/trades";
import { provisionWorkspace, tenantScope } from "../src/db/repositories/workspaces";
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
    const alpha = await provisionWorkspace(db, {
      username: "alpha_trader",
      tenantSlug: "alpha-vault",
      tenantName: "Alpha Vault",
      defaultCurrency: "INR",
    });
    const beta = await provisionWorkspace(db, {
      username: "beta_trader",
      tenantSlug: "beta-vault",
      tenantName: "Beta Vault",
      defaultCurrency: "USD",
    });

    const alphaTrades = createTradeRepository(db, alpha.scope);
    const created = await alphaTrades.create({
      accountId: alpha.account.id,
      symbol: "nifty",
      assetClass: "Index",
      instrumentType: "Futures",
      direction: "Long",
      status: "closed",
      currency: "INR",
      entryAt: "2026-06-19T09:15:00.000Z",
      entryPrice: 25_000,
      exitAt: "2026-06-19T11:15:00.000Z",
      exitPrice: 25_100,
      quantity: 2,
      multiplier: 50,
      stopLoss: 24_900,
      plannedTarget: 25_300,
      manualPnl: null,
      fees: 40,
      fxToAccount: 1,
      confidence: 4,
      emotion: "Focused",
      tags: ["breakout", "morning"],
    });
    assert.equal(created.symbol, "NIFTY");
    assert.equal(created.currency, "INR");
    assert.equal(Number(created.plannedRisk), 10_000);
    assert.equal(Number(created.realizedPnl), 10_000);
    assert.equal(Number(created.realizedR), 1);
    assert.equal((await alphaTrades.list()).length, 1);

    for (let index = 0; index < 27; index += 1) {
      await alphaTrades.create({
        accountId: alpha.account.id, symbol: `PAGE${String(index).padStart(2, "0")}`, assetClass: "Equity", instrumentType: "Cash",
        direction: "Long", status: "open", currency: "INR", entryAt: new Date(Date.UTC(2026, 4, index + 1)).toISOString(),
        entryPrice: 100 + index, exitAt: null, exitPrice: null, quantity: 1, multiplier: 1, stopLoss: 90,
        plannedTarget: 120 + index, manualPnl: null, fees: 0, fxToAccount: 1, emotion: index % 2 ? "Calm" : "Focused",
      });
    }
    const firstPage = await alphaTrades.queryPage({ accountId: alpha.account.id, page: 1, pageSize: 25, sort: "entry-desc" });
    const secondPage = await alphaTrades.queryPage({ accountId: alpha.account.id, page: 2, pageSize: 25, sort: "entry-desc" });
    assert.equal(firstPage.total, 28);
    assert.equal(firstPage.rows.length, 25);
    assert.equal(secondPage.rows.length, 3);
    const filtered = await alphaTrades.queryPage({ accountId: alpha.account.id, page: 1, pageSize: 25, search: "PAGE0", emotion: "Calm" });
    assert.equal(filtered.total, 5, "search and advanced emotion filters compose");

    const crossedScope = tenantScope({ tenantId: alpha.tenant.id, userId: beta.user.id });
    assert.equal((await createTradeRepository(db, crossedScope).list()).length, 0, "crossed membership sees no trades");
    await assert.rejects(
      () => createTradeRepository(db, beta.scope).create({
        accountId: alpha.account.id,
        symbol: "AAPL",
        assetClass: "Equity",
        instrumentType: "Cash",
        direction: "Long",
        status: "open",
        currency: "USD",
        entryAt: "2026-06-20T09:30:00.000Z",
        entryPrice: 200,
        exitAt: null,
        exitPrice: null,
        quantity: 5,
        multiplier: 1,
        stopLoss: 195,
        plannedTarget: 210,
        manualPnl: null,
        fees: 0,
        fxToAccount: 1,
      }),
      /not available in this workspace/i,
    );

    console.log("Trade persistence verified: migrations, domain preview, tenant/account isolation, and currency-tagged records are green.");
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
