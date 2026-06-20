import { and, asc, eq } from "drizzle-orm";

import type { Database } from "@/db/client";
import type { TenantScope } from "@/db/repositories/workspaces";
import { tradeAttachments, trades } from "@/db/schema";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface CreateAttachmentInput {
  accountId: string;
  tradeId: string;
  storageKey: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  caption?: string | null;
}

/**
 * Tenant/owner/account-scoped boundary for trade attachments. Every read and write
 * carries the scope; creation re-checks trade ownership before the composite FKs run.
 */
export function createAttachmentRepository(db: Database, scope: TenantScope) {
  const scoped = (accountId: string) => and(
    eq(tradeAttachments.tenantId, scope.tenantId),
    eq(tradeAttachments.createdByUserId, scope.userId),
    eq(tradeAttachments.accountId, accountId),
  );

  const ownsTrade = async (accountId: string, tradeId: string) => {
    if (!UUID.test(tradeId)) return false;
    const [row] = await db.select({ id: trades.id }).from(trades).where(and(
      eq(trades.id, tradeId), eq(trades.tenantId, scope.tenantId), eq(trades.createdByUserId, scope.userId), eq(trades.accountId, accountId),
    )).limit(1);
    return Boolean(row);
  };

  return {
    listForTrade: (accountId: string, tradeId: string) =>
      db.select().from(tradeAttachments)
        .where(and(scoped(accountId), eq(tradeAttachments.tradeId, tradeId)))
        .orderBy(asc(tradeAttachments.createdAt)),

    getById: async (accountId: string, attachmentId: string) => {
      if (!UUID.test(attachmentId)) return null;
      const [row] = await db.select().from(tradeAttachments)
        .where(and(scoped(accountId), eq(tradeAttachments.id, attachmentId))).limit(1);
      return row ?? null;
    },

    create: async (input: CreateAttachmentInput) => {
      if (!(await ownsTrade(input.accountId, input.tradeId))) return null;
      const [row] = await db.insert(tradeAttachments).values({
        tenantId: scope.tenantId,
        accountId: input.accountId,
        tradeId: input.tradeId,
        createdByUserId: scope.userId,
        storageKey: input.storageKey,
        originalName: input.originalName,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        caption: input.caption?.trim() || null,
      }).returning();
      return row ?? null;
    },

    updateCaption: async (accountId: string, attachmentId: string, caption: string) => {
      if (!UUID.test(attachmentId)) return null;
      const [row] = await db.update(tradeAttachments)
        .set({ caption: caption.trim() || null, updatedAt: new Date() })
        .where(and(scoped(accountId), eq(tradeAttachments.id, attachmentId)))
        .returning();
      return row ?? null;
    },

    /** Delete a scoped attachment, returning its storage key so the file can be removed. */
    remove: async (accountId: string, attachmentId: string) => {
      if (!UUID.test(attachmentId)) return null;
      const [row] = await db.delete(tradeAttachments)
        .where(and(scoped(accountId), eq(tradeAttachments.id, attachmentId)))
        .returning({ storageKey: tradeAttachments.storageKey });
      return row?.storageKey ?? null;
    },
  };
}
