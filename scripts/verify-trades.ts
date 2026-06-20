import assert from "node:assert/strict";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import type { Database } from "../src/db/client";
import { ensureDefaultTradeLibraries, getTradeEntryLibraries } from "../src/db/repositories/libraries";
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
    await ensureDefaultTradeLibraries(db, alpha.scope);
    await ensureDefaultTradeLibraries(db, beta.scope);
    const alphaLibraries = await getTradeEntryLibraries(db, alpha.scope);
    const betaLibraries = await getTradeEntryLibraries(db, beta.scope);
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
      strategyId: alphaLibraries.strategies[0].id,
      playbookId: alphaLibraries.playbooks[0].id,
      closeReasonId: alphaLibraries.closeReasons[0].id,
      setupChecklist: alphaLibraries.checklistTemplates[0].items.map((item, index) => ({ ...item, completed: index < 3 })),
    });
    assert.equal(created.symbol, "NIFTY");
    assert.equal(created.currency, "INR");
    assert.equal(Number(created.plannedRisk), 10_000);
    assert.equal(Number(created.realizedPnl), 10_000);
    assert.equal(Number(created.realizedR), 1);
    assert.equal(created.strategyId, alphaLibraries.strategies[0].id);
    assert.equal(created.setupChecklist.length, 5);
    const reviewed = await alphaTrades.saveReview({ accountId: alpha.account.id, tradeId: created.id, confidence: 5, emotion: "Calm", ruleViolations: null, notes: "Waited for confirmation.", completedChecklistIds: ["thesis", "invalidation"] });
    assert.ok(reviewed?.reviewedAt);
    assert.equal(reviewed?.confidence, 5);
    assert.equal(reviewed?.setupChecklist.filter((item) => item.completed).length, 2);
    assert.equal(await createTradeRepository(db, beta.scope).saveReview({ accountId: beta.account.id, tradeId: created.id, confidence: 1, emotion: "FOMO", ruleViolations: "foreign", notes: "foreign", completedChecklistIds: [] }), null, "foreign tenant cannot read or review a trade");
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
    assert.equal((await alphaTrades.queryPage({ accountId: alpha.account.id, strategyId: alphaLibraries.strategies[0].id })).total, 1, "library filters are scoped and composable");

    await assert.rejects(
      () => alphaTrades.create({
        accountId: alpha.account.id, symbol: "FOREIGN", assetClass: "Equity", instrumentType: "Cash", direction: "Long", status: "open",
        currency: "INR", entryAt: "2026-06-20T09:30:00.000Z", entryPrice: 100, exitAt: null, exitPrice: null,
        quantity: 1, multiplier: 1, stopLoss: 95, plannedTarget: 110, manualPnl: null, fees: 0, fxToAccount: 1,
        strategyId: betaLibraries.strategies[0].id,
      }),
      /library item is not available/i,
    );

    const crossedScope = tenantScope({ tenantId: alpha.tenant.id, userId: beta.user.id });
    assert.equal((await createTradeRepository(db, crossedScope).list()).length, 0, "crossed membership sees no trades");
    const betaTrades = createTradeRepository(db, beta.scope);
    const betaCreated = await betaTrades.create({
      accountId: beta.account.id, symbol: "AAPL", assetClass: "Equity", instrumentType: "Cash", direction: "Long", status: "open",
      currency: "USD", entryAt: "2026-06-20T09:30:00.000Z", entryPrice: 200, exitAt: null, exitPrice: null,
      quantity: 5, multiplier: 1, stopLoss: 195, plannedTarget: 210, manualPnl: null, fees: 0, fxToAccount: 1,
    });
    assert.equal(await alphaTrades.bulkSetReviewed({ accountId: alpha.account.id, tradeIds: [created.id, betaCreated.id, "not-a-uuid"], reviewed: true }), 1, "bulk review changes only scoped trade ids");
    assert.ok((await alphaTrades.list({ accountId: alpha.account.id, limit: 100 })).find((trade) => trade.id === created.id)?.reviewedAt);
    assert.equal((await betaTrades.list({ accountId: beta.account.id })).find((trade) => trade.id === betaCreated.id)?.reviewedAt, null);
    assert.equal(await alphaTrades.bulkSetReviewed({ accountId: alpha.account.id, tradeIds: [created.id], reviewed: false }), 1);

    // Close lifecycle: recompute realized P&L / R through the tested oracle, never mixing currency, fully tenant/account scoped.
    assert.equal((await alphaTrades.closeTrade({ accountId: alpha.account.id, tradeId: betaCreated.id, exitAt: "2026-06-21T15:00:00.000Z", exitPrice: 215, manualPnl: null, fees: 5, closeReasonId: null })).status, "missing", "a foreign tenant cannot close another tenant's trade");
    const betaClose = await betaTrades.closeTrade({ accountId: beta.account.id, tradeId: betaCreated.id, exitAt: "2026-06-21T15:00:00.000Z", exitPrice: 215, manualPnl: null, fees: 5, closeReasonId: betaLibraries.closeReasons[0].id });
    assert.ok(betaClose.status === "closed");
    assert.equal(betaClose.trade.status, "closed");
    assert.equal(betaClose.trade.currency, "USD", "closing never changes or mixes the trade currency");
    assert.equal(Number(betaClose.trade.realizedPnl), 75, "(215-200) * 5 * 1 = 75 USD");
    assert.equal(Number(betaClose.trade.realizedR), 3, "75 / (|200-195| * 5) = 3R");
    assert.equal(betaClose.trade.closeReasonId, betaLibraries.closeReasons[0].id);
    assert.equal((await betaTrades.closeTrade({ accountId: beta.account.id, tradeId: betaCreated.id, exitAt: "2026-06-21T16:00:00.000Z", exitPrice: 220, manualPnl: null, fees: 0, closeReasonId: null })).status, "already-closed", "a closed trade cannot be re-closed");
    const betaOpen2 = await betaTrades.create({ accountId: beta.account.id, symbol: "MSFT", assetClass: "Equity", instrumentType: "Cash", direction: "Long", status: "open", currency: "USD", entryAt: "2026-06-20T09:30:00.000Z", entryPrice: 300, exitAt: null, exitPrice: null, quantity: 2, multiplier: 1, stopLoss: 290, plannedTarget: 320, manualPnl: null, fees: 0, fxToAccount: 1 });
    await assert.rejects(
      () => betaTrades.closeTrade({ accountId: beta.account.id, tradeId: betaOpen2.id, exitAt: "", exitPrice: null, manualPnl: null, fees: 0, closeReasonId: null }),
      /Close validation failed/i,
      "closing without an exit is rejected by the oracle before any write",
    );
    assert.equal((await betaTrades.getById(beta.account.id, betaOpen2.id))?.status, "open", "a rejected close leaves the trade open");

    // Edit: recompute every derived metric through the same oracle, never mixing currency, tenant/account scoped.
    const updateInput = {
      accountId: alpha.account.id, tradeId: created.id, symbol: "nifty", assetClass: "Index" as const, instrumentType: "Futures" as const,
      direction: "Long" as const, status: "closed" as const, currency: "INR" as const, entryAt: "2026-06-19T09:15:00.000Z",
      entryPrice: 25_000, exitAt: "2026-06-19T12:15:00.000Z", exitPrice: 25_200, quantity: 2, multiplier: 50,
      stopLoss: 24_900, plannedTarget: 25_300, manualPnl: null, fees: 60, fxToAccount: 1, tags: ["breakout"],
    };
    const edited = await alphaTrades.update(updateInput);
    assert.ok(edited, "owner can edit their trade");
    assert.equal(Number(edited.realizedPnl), 20_000, "(25200-25000)*2*50 = 20000 INR after edit");
    assert.equal(Number(edited.realizedR), 2, "20000 / ((25000-24900)*2*50) = 2R after edit");
    assert.equal(edited.currency, "INR", "editing never changes or mixes the trade currency");
    assert.equal(edited.tags.length, 1);
    assert.equal(await createTradeRepository(db, beta.scope).update({ ...updateInput, accountId: beta.account.id }), null, "a foreign tenant cannot edit another tenant's trade");
    await assert.rejects(
      () => alphaTrades.update({ ...updateInput, entryPrice: 0 }),
      /validation failed/i,
      "an invalid edit is rejected by the oracle",
    );

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

    console.log("Trade persistence verified: domain preview, linked libraries/checklist, filters, close lifecycle (oracle P&L/R, currency-safe, isolation), tenant isolation, and currency-tagged records are green.");
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
