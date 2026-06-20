import assert from "node:assert/strict";
import path from "node:path";

import { eq } from "drizzle-orm";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import type { Database } from "../src/db/client";
import { ensureDefaultTradeLibraries, getTradeEntryLibraries } from "../src/db/repositories/libraries";
import { createNoteRepository } from "../src/db/repositories/notes";
import { createTradeRepository } from "../src/db/repositories/trades";
import { provisionWorkspace, tenantScope } from "../src/db/repositories/workspaces";
import { buildNotesFeed } from "../src/lib/domain/notes";
import * as schema from "../src/db/schema";
import { playbooks } from "../src/db/schema";

async function main() {
  const client = new PGlite();
  const db = drizzlePglite(client, { schema }) as unknown as Database;
  await migrate(db as never, {
    migrationsFolder: path.join(process.cwd(), "drizzle"),
    migrationsSchema: "drizzle",
    migrationsTable: "__tradevault_migrations",
  });

  try {
    const a = await provisionWorkspace(db, { username: "alpha_notes", tenantSlug: "alpha-notes", tenantName: "Alpha Notes", defaultCurrency: "INR" });
    const b = await provisionWorkspace(db, { username: "beta_notes", tenantSlug: "beta-notes", tenantName: "Beta Notes", defaultCurrency: "USD" });
    await ensureDefaultTradeLibraries(db, a.scope);
    await ensureDefaultTradeLibraries(db, b.scope);
    const aLibs = await getTradeEntryLibraries(db, a.scope);
    const bLibs = await getTradeEntryLibraries(db, b.scope);

    const aNotes = createNoteRepository(db, a.scope);
    const bNotes = createNoteRepository(db, b.scope);
    const aTrades = createTradeRepository(db, a.scope);
    const bTrades = createTradeRepository(db, b.scope);

    // Owner can create a dedicated note; it surfaces in their feed list.
    const note = await aNotes.create({ accountId: a.account.id, title: "Risk rule: one trade at a time", bodyText: "Never stack correlated risk.", collection: "risk-rules", noteType: "general" });
    assert.equal(note.title, "Risk rule: one trade at a time");
    assert.equal(note.collection, "risk-rules");
    assert.equal((await aNotes.listForFeed(a.account.id)).length, 1);

    // Blank titles are rejected before any write.
    await assert.rejects(() => aNotes.create({ accountId: a.account.id, title: "   " }), /needs a title/i);

    // A trade with an entry note + a review note surfaces two read-only, linked source items.
    const aTrade = await aTrades.create({
      accountId: a.account.id, symbol: "INFY", assetClass: "Equity", instrumentType: "Cash", direction: "Long", status: "closed",
      currency: "INR", entryAt: "2026-06-10T03:45:00.000Z", entryPrice: 1500, exitAt: "2026-06-10T06:00:00.000Z", exitPrice: 1540,
      quantity: 10, multiplier: 1, stopLoss: 1480, plannedTarget: 1560, manualPnl: null, fees: 10, fxToAccount: 1,
      linkedNote: "Plan: wait for the opening range to resolve.", notes: "Took partial profit too soon.",
    });
    // Give a playbook a note so the playbook source path is covered.
    await db.update(playbooks).set({ notes: "Only trade with volume confirmation." }).where(eq(playbooks.id, aLibs.playbooks[0].id));

    const aSources = await aNotes.listSourceNotes(a.account.id);
    assert.equal(aSources.tradeNotes.length, 1, "one trade carries notes");
    assert.equal(aSources.tradeNotes[0].entryNote, "Plan: wait for the opening range to resolve.");
    assert.equal(aSources.tradeNotes[0].reviewNote, "Took partial profit too soon.");
    assert.ok(aSources.playbookNotes.some((p) => p.playbookId === aLibs.playbooks[0].id));

    // Repo + oracle integration: dedicated note + 2 trade source items + 1 playbook source item.
    const feed = buildNotesFeed({ notes: await aNotes.listForFeed(a.account.id), ...aSources });
    assert.equal(feed.counts.all, 4, "1 dedicated + 2 trade-derived + 1 playbook-derived");
    assert.equal(feed.items.filter((i) => i.editable).length, 1, "only the dedicated note is editable");
    assert.ok(feed.items.find((i) => i.id === `trade-entry:${aTrade.id}`));
    assert.ok(feed.items.find((i) => i.id === `trade-review:${aTrade.id}`));

    // Pin + archive lifecycle (owner).
    assert.equal((await aNotes.setPinned(a.account.id, note.id, true))?.pinned, true);
    assert.ok((await aNotes.listForFeed(a.account.id)).find((n) => n.id === note.id)?.pinned);

    // Cross-tenant isolation: beta cannot read/edit/pin/archive alpha's note.
    assert.equal(await bNotes.getById(b.account.id, note.id), null, "foreign tenant cannot read the note");
    assert.equal((await bNotes.listForFeed(b.account.id)).length, 0, "foreign feed excludes the note");
    assert.equal(await bNotes.update({ accountId: b.account.id, noteId: note.id, title: "hijacked" }), null, "foreign tenant cannot edit");
    assert.equal(await bNotes.setPinned(b.account.id, note.id, false), null, "foreign tenant cannot pin");
    assert.equal(await bNotes.archive(b.account.id, note.id), null, "foreign tenant cannot archive");
    assert.ok((await aNotes.getById(a.account.id, note.id))?.pinned, "the note is untouched by foreign writes");
    assert.equal((await bNotes.listSourceNotes(b.account.id)).tradeNotes.length, 0, "source notes are tenant scoped");

    const crossed = tenantScope({ tenantId: a.tenant.id, userId: b.user.id });
    assert.equal((await createNoteRepository(db, crossed).listForFeed(a.account.id)).length, 0, "crossed membership sees no notes");

    // Links to foreign records are rejected before the composite FKs run.
    const bTrade = await bTrades.create({
      accountId: b.account.id, symbol: "AAPL", assetClass: "Equity", instrumentType: "Cash", direction: "Long", status: "open",
      currency: "USD", entryAt: "2026-06-11T13:30:00.000Z", entryPrice: 200, exitAt: null, exitPrice: null,
      quantity: 5, multiplier: 1, stopLoss: 195, plannedTarget: 210, manualPnl: null, fees: 0, fxToAccount: 1,
    });
    await assert.rejects(() => aNotes.create({ accountId: a.account.id, title: "link foreign trade", linkedTradeId: bTrade.id }), /linked trade is not available/i);
    await assert.rejects(() => aNotes.create({ accountId: a.account.id, title: "link foreign playbook", linkedPlaybookId: bLibs.playbooks[0].id }), /linked playbook is not available/i);

    // Owner can link their own records.
    const linked = await aNotes.create({ accountId: a.account.id, title: "Why I held INFY", linkedTradeId: aTrade.id, noteType: "post-trade" });
    assert.equal(linked.linkedTradeId, aTrade.id);
    const linkedFeed = await aNotes.listForFeed(a.account.id);
    assert.equal(linkedFeed.find((n) => n.id === linked.id)?.linkedTradeLabel, "INFY", "linked trade label resolves to its symbol");

    // Archive removes a note from the feed.
    assert.equal(await aNotes.archive(a.account.id, linked.id), linked.id);
    assert.equal((await aNotes.listForFeed(a.account.id)).find((n) => n.id === linked.id), undefined, "archived notes leave the feed");

    console.log("Notes persistence verified: dedicated CRUD + pin/archive, linked-record validation, source-note surfacing, oracle merge, and strict tenant isolation are green.");
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
