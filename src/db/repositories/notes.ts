import { and, desc, eq, isNotNull, isNull, or } from "drizzle-orm";

import type { Database } from "@/db/client";
import { notes, playbooks, trades, type RichTextDoc } from "@/db/schema";
import type { TenantScope } from "@/db/repositories/workspaces";
import type {
  DedicatedNoteInput,
  NoteCollection,
  NoteType,
  PlaybookNoteInput,
  TradeNoteInput,
} from "@/lib/domain/notes";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface CreateNoteInput {
  accountId: string;
  title: string;
  bodyText?: string;
  bodyJson?: RichTextDoc | null;
  noteType?: NoteType;
  collection?: NoteCollection;
  isTemplate?: boolean;
  pinned?: boolean;
  linkedTradeId?: string | null;
  linkedPlaybookId?: string | null;
}

export type UpdateNoteInput = CreateNoteInput & { noteId: string };

function cleanTitle(value: string) {
  const title = value.trim();
  if (!title) throw new Error("A note needs a title.");
  return title.length <= 200 ? title : title.slice(0, 200);
}

/**
 * Tenant/account/creator-scoped notes boundary. Dedicated journal notes are owned here;
 * existing trade/playbook notes are surfaced (read-only) via `listSourceNotes` so the
 * unified index links to source rather than duplicating it.
 */
export function createNoteRepository(db: Database, scope: TenantScope) {
  const ownScope = (accountId: string) => and(
    eq(notes.tenantId, scope.tenantId),
    eq(notes.createdByUserId, scope.userId),
    eq(notes.accountId, accountId),
  );

  /** Reject links to records outside this workspace before the composite FKs run. */
  async function assertLinks(executor: Database, accountId: string, input: { linkedTradeId?: string | null; linkedPlaybookId?: string | null }) {
    if (input.linkedTradeId) {
      const [trade] = await executor.select({ id: trades.id }).from(trades).where(and(
        eq(trades.id, input.linkedTradeId), eq(trades.tenantId, scope.tenantId), eq(trades.createdByUserId, scope.userId), eq(trades.accountId, accountId),
      )).limit(1);
      if (!trade) throw new Error("The linked trade is not available in this workspace.");
    }
    if (input.linkedPlaybookId) {
      const [playbook] = await executor.select({ id: playbooks.id }).from(playbooks).where(and(
        eq(playbooks.id, input.linkedPlaybookId), eq(playbooks.tenantId, scope.tenantId),
      )).limit(1);
      if (!playbook) throw new Error("The linked playbook is not available in this workspace.");
    }
  }

  return {
    getById: async (accountId: string, noteId: string) => {
      if (!UUID.test(noteId)) return null;
      const [note] = await db.select().from(notes).where(and(ownScope(accountId), eq(notes.id, noteId))).limit(1);
      return note ?? null;
    },

    /** Dedicated notes shaped for the feed builder, with resolved linked-record labels. */
    listForFeed: async (accountId: string): Promise<DedicatedNoteInput[]> => {
      const rows = await db.select({
        id: notes.id,
        title: notes.title,
        bodyText: notes.bodyText,
        noteType: notes.noteType,
        collection: notes.collection,
        isTemplate: notes.isTemplate,
        pinned: notes.pinned,
        linkedTradeId: notes.linkedTradeId,
        linkedPlaybookId: notes.linkedPlaybookId,
        updatedAt: notes.updatedAt,
        tradeSymbol: trades.symbol,
        playbookName: playbooks.name,
      })
        .from(notes)
        .leftJoin(trades, and(eq(trades.tenantId, notes.tenantId), eq(trades.id, notes.linkedTradeId)))
        .leftJoin(playbooks, and(eq(playbooks.tenantId, notes.tenantId), eq(playbooks.id, notes.linkedPlaybookId)))
        .where(and(ownScope(accountId), isNull(notes.archivedAt)))
        .orderBy(desc(notes.updatedAt));

      return rows.map((row) => ({
        id: row.id,
        title: row.title,
        bodyText: row.bodyText,
        noteType: row.noteType,
        collection: row.collection,
        isTemplate: row.isTemplate,
        pinned: row.pinned,
        linkedTradeId: row.linkedTradeId,
        linkedPlaybookId: row.linkedPlaybookId,
        linkedTradeLabel: row.tradeSymbol,
        linkedPlaybookLabel: row.playbookName,
        updatedAtIso: row.updatedAt.toISOString(),
      }));
    },

    /** Existing trade entry/review notes + playbook notes (read-only sources for the feed). */
    listSourceNotes: async (accountId: string): Promise<{ tradeNotes: TradeNoteInput[]; playbookNotes: PlaybookNoteInput[] }> => {
      const [tradeRows, playbookRows] = await Promise.all([
        db.select({
          tradeId: trades.id, symbol: trades.symbol, entryAt: trades.entryAt, updatedAt: trades.updatedAt,
          reviewedAt: trades.reviewedAt, entryNote: trades.linkedNote, reviewNote: trades.notes,
        }).from(trades).where(and(
          eq(trades.tenantId, scope.tenantId), eq(trades.createdByUserId, scope.userId), eq(trades.accountId, accountId),
          or(isNotNull(trades.linkedNote), isNotNull(trades.notes)),
        )),
        db.select({ playbookId: playbooks.id, name: playbooks.name, notes: playbooks.notes, updatedAt: playbooks.updatedAt })
          .from(playbooks).where(and(eq(playbooks.tenantId, scope.tenantId), isNull(playbooks.archivedAt), isNotNull(playbooks.notes))),
      ]);

      return {
        tradeNotes: tradeRows.map((row) => ({
          tradeId: row.tradeId, symbol: row.symbol,
          entryAtIso: row.entryAt.toISOString(), updatedAtIso: row.updatedAt.toISOString(),
          reviewedAtIso: row.reviewedAt ? row.reviewedAt.toISOString() : null,
          entryNote: row.entryNote, reviewNote: row.reviewNote,
        })),
        playbookNotes: playbookRows.map((row) => ({
          playbookId: row.playbookId, name: row.name, notes: row.notes, updatedAtIso: row.updatedAt.toISOString(),
        })),
      };
    },

    create: async (input: CreateNoteInput) => {
      const title = cleanTitle(input.title);
      await assertLinks(db, input.accountId, input);
      const [note] = await db.insert(notes).values({
        tenantId: scope.tenantId,
        accountId: input.accountId,
        createdByUserId: scope.userId,
        title,
        bodyText: (input.bodyText ?? "").trim(),
        bodyJson: input.bodyJson ?? null,
        noteType: input.noteType ?? "general",
        collection: input.collection ?? "none",
        isTemplate: input.isTemplate ?? false,
        pinned: input.pinned ?? false,
        linkedTradeId: input.linkedTradeId || null,
        linkedPlaybookId: input.linkedPlaybookId || null,
      }).returning();
      return note;
    },

    update: async (input: UpdateNoteInput) => {
      if (!UUID.test(input.noteId)) return null;
      const title = cleanTitle(input.title);
      const [owned] = await db.select({ id: notes.id }).from(notes).where(and(ownScope(input.accountId), eq(notes.id, input.noteId))).limit(1);
      if (!owned) return null;
      await assertLinks(db, input.accountId, input);
      const [updated] = await db.update(notes).set({
        title,
        bodyText: (input.bodyText ?? "").trim(),
        bodyJson: input.bodyJson ?? null,
        noteType: input.noteType ?? "general",
        collection: input.collection ?? "none",
        isTemplate: input.isTemplate ?? false,
        pinned: input.pinned ?? false,
        linkedTradeId: input.linkedTradeId || null,
        linkedPlaybookId: input.linkedPlaybookId || null,
        updatedAt: new Date(),
      }).where(and(ownScope(input.accountId), eq(notes.id, input.noteId))).returning();
      return updated ?? null;
    },

    setPinned: async (accountId: string, noteId: string, pinned: boolean) => {
      if (!UUID.test(noteId)) return null;
      const [updated] = await db.update(notes).set({ pinned, updatedAt: new Date() })
        .where(and(ownScope(accountId), eq(notes.id, noteId))).returning({ id: notes.id, pinned: notes.pinned });
      return updated ?? null;
    },

    archive: async (accountId: string, noteId: string) => {
      if (!UUID.test(noteId)) return null;
      const [archived] = await db.update(notes).set({ archivedAt: new Date(), updatedAt: new Date() })
        .where(and(ownScope(accountId), eq(notes.id, noteId), isNull(notes.archivedAt))).returning({ id: notes.id });
      return archived?.id ?? null;
    },
  };
}
