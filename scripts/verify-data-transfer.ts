import assert from "node:assert/strict";
import path from "node:path";

import { and, count, eq } from "drizzle-orm";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import type { Database } from "../src/db/client";
import { createDataTransferRepository } from "../src/db/repositories/data-transfer";
import { ensureDefaultTradeLibraries, getTradeEntryLibraries } from "../src/db/repositories/libraries";
import { createNoteRepository } from "../src/db/repositories/notes";
import { createTradeRepository } from "../src/db/repositories/trades";
import { provisionWorkspace } from "../src/db/repositories/workspaces";
import * as schema from "../src/db/schema";
import { notes, tradeAttachments, trades } from "../src/db/schema";

function serialized(value: unknown) {
  return JSON.stringify(value);
}

async function main() {
  const client = new PGlite();
  const db = drizzlePglite(client, { schema }) as unknown as Database;
  await migrate(db as never, {
    migrationsFolder: path.join(process.cwd(), "drizzle"),
    migrationsSchema: "drizzle",
    migrationsTable: "__tradevault_migrations",
  });

  try {
    const source = await provisionWorkspace(db, { username: "transfer_source", tenantSlug: "transfer-source", tenantName: "Transfer Source", defaultCurrency: "INR" });
    const target = await provisionWorkspace(db, { username: "transfer_target", tenantSlug: "transfer-target", tenantName: "Transfer Target", defaultCurrency: "USD" });
    await ensureDefaultTradeLibraries(db, source.scope);
    const libraries = await getTradeEntryLibraries(db, source.scope);
    const sourceTrades = createTradeRepository(db, source.scope);
    const sourceNotes = createNoteRepository(db, source.scope);

    const trade = await sourceTrades.create({
      accountId: source.account.id,
      symbol: "NIFTY",
      assetClass: "Index",
      instrumentType: "Futures",
      expiryDate: "2026-06-25",
      direction: "Long",
      status: "closed",
      currency: "INR",
      entryAt: "2026-06-20T03:45:00.000Z",
      entryPrice: 25_000,
      exitAt: "2026-06-20T04:45:00.000Z",
      exitPrice: 25_100,
      quantity: 2,
      multiplier: 50,
      stopLoss: 24_900,
      plannedTarget: 25_300,
      manualPnl: null,
      mfePrice: 25_200,
      maePrice: 24_950,
      fees: 25,
      fxToAccount: 1,
      strategyId: libraries.strategies[0].id,
      playbookId: libraries.playbooks[0].id,
      closeReasonId: libraries.closeReasons[0].id,
      confidence: 4,
      tags: ["patient"],
      linkedNote: "Waited for confirmation.",
      notes: "Execution stayed within plan.",
      setupChecklist: [{ id: "risk", label: "Risk sized", phase: "entry", completed: true }],
    });
    const note = await sourceNotes.create({
      accountId: source.account.id,
      title: "Linked review",
      bodyText: "Carry patience forward.",
      noteType: "post-trade",
      collection: "setups",
      linkedTradeId: trade.id,
      linkedPlaybookId: libraries.playbooks[0].id,
      pinned: true,
    });
    const storageKey = `${source.tenant.id}/${source.account.id}/${trade.id}/private-chart.png`;
    await db.insert(tradeAttachments).values({
      tenantId: source.tenant.id,
      accountId: source.account.id,
      tradeId: trade.id,
      createdByUserId: source.user.id,
      storageKey,
      originalName: "broker-account-chart.png",
      contentType: "image/png",
      sizeBytes: 1_024,
    });

    const sourceTransfer = createDataTransferRepository(db, source.scope);
    const exported = await sourceTransfer.exportAccount(source.account.id, new Date("2026-06-20T12:00:00.000Z"));
    const json = serialized(exported);
    assert.equal(exported.format, "tradevault_export_v3");
    assert.equal(exported.attachments.included, false);
    assert.equal(exported.attachments.count, 1);
    assert.equal(exported.trades[0].attachment_count, 1);
    assert.equal(exported.trades[0].expiry_date, "2026-06-25");
    for (const secret of [source.user.id, source.tenant.id, source.account.id, trade.id, note.id, source.user.username, source.user.email, storageKey, "broker-account-chart.png"]) {
      assert.equal(json.includes(secret), false, `export must not contain ${secret}`);
    }
    for (const unsafeKey of ["password", "totp", "storage_key", "created_by_user_id", "tenant_id", "user_id"]) {
      assert.equal(json.toLocaleLowerCase().includes(`\"${unsafeKey}\"`), false, `export must not contain ${unsafeKey}`);
    }

    const targetTransfer = createDataTransferRepository(db, target.scope);
    const first = await targetTransfer.importAccount(target.account.id, exported, "Asia/Kolkata");
    assert.equal(first.trades.imported, 1);
    assert.equal(first.notes.imported, 1);
    const [targetTrade] = await db.select().from(trades).where(and(
      eq(trades.tenantId, target.tenant.id), eq(trades.accountId, target.account.id), eq(trades.createdByUserId, target.user.id),
    ));
    const [targetNote] = await db.select().from(notes).where(and(
      eq(notes.tenantId, target.tenant.id), eq(notes.accountId, target.account.id), eq(notes.createdByUserId, target.user.id),
    ));
    assert.equal(targetTrade.symbol, "NIFTY");
    assert.equal(Number(targetTrade.realizedPnl), 10_000, "derived P&L is recomputed through the domain oracle");
    assert.equal(Number(targetTrade.mfePrice), 25_200, "raw favorable excursion survives backup and restore");
    assert.equal(Number(targetTrade.maePrice), 24_950, "raw adverse excursion survives backup and restore");
    assert.equal(targetTrade.expiryDate, "2026-06-25", "derivative expiry survives backup and restore");
    assert.equal(Number(targetTrade.mfeR), 2, "restored excursion metrics are recomputed through the domain oracle");
    assert.equal(Number(targetTrade.capturedMovePct), 50, "restored capture is recomputed instead of trusted from JSON");
    assert.equal(targetNote.linkedTradeId, targetTrade.id, "export ref resolves to the new tenant-local trade");
    assert.notEqual(targetTrade.id, trade.id);
    assert.notEqual(targetNote.linkedPlaybookId, note.linkedPlaybookId);

    const second = await targetTransfer.importAccount(target.account.id, exported, "Asia/Kolkata");
    assert.deepEqual(second.trades, { imported: 0, skipped: 1 });
    assert.deepEqual(second.notes, { imported: 0, skipped: 1 });
    const [{ tradeCount }] = await db.select({ tradeCount: count() }).from(trades).where(eq(trades.tenantId, target.tenant.id));
    assert.equal(tradeCount, 1, "repeat import is idempotent");

    const invalid = structuredClone(exported) as typeof exported;
    invalid.trades[0].entry_price = -1;
    await assert.rejects(() => targetTransfer.importAccount(target.account.id, invalid, "Asia/Kolkata"), (error: Error & { importErrors?: string[] }) => {
      assert.match(error.message, /validation failed/i);
      assert.ok(error.importErrors?.some((message) => /entry price/i.test(message)));
      return true;
    });
    const [{ afterInvalid }] = await db.select({ afterInvalid: count() }).from(trades).where(eq(trades.tenantId, target.tenant.id));
    assert.equal(afterInvalid, 1, "invalid payload does not mutate the target");

    await assert.rejects(() => targetTransfer.exportAccount(source.account.id), /not available/i, "foreign account export is denied");
    await assert.rejects(() => targetTransfer.importAccount(source.account.id, exported, "UTC"), /not available/i, "foreign account import is denied");

    console.log("Data transfer verified: secret-free v3 export, attachment counts only, atomic validation, tenant-local links, oracle math, and idempotent import are green.");
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
