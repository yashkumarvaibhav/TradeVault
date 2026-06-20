"use server";

import { revalidatePath } from "next/cache";

import { createAttachmentRepository } from "@/db/repositories/attachments";
import { getDb } from "@/db/server";
import { ATTACHMENT_CONTENT_TYPES, ATTACHMENT_MAX_BYTES } from "@/db/schema";
import { buildStorageKey, getStorage } from "@/lib/storage";
import { requireWorkspaceSession } from "@/lib/workspace-session";

export interface AttachmentState {
  error?: string;
  ok?: boolean;
}

const isAllowedType = (type: string): boolean => (ATTACHMENT_CONTENT_TYPES as readonly string[]).includes(type);

export async function uploadAttachmentAction(_prev: AttachmentState, formData: FormData): Promise<AttachmentState> {
  const { scope, account } = await requireWorkspaceSession();
  const tradeId = String(formData.get("tradeId") ?? "").trim();
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file to upload." };
  if (!isAllowedType(file.type)) return { error: "Only PNG, JPEG, WebP, or PDF files are allowed." };
  if (file.size > ATTACHMENT_MAX_BYTES) return { error: "Files must be 5 MB or smaller." };

  const buffer = Buffer.from(await file.arrayBuffer());
  const storageKey = buildStorageKey(scope.tenantId, tradeId, file.type);
  const captionRaw = String(formData.get("caption") ?? "").slice(0, 300);

  // Save the bytes first, then record the row. If the trade is not in this workspace
  // (create returns null), remove the orphaned file so storage never leaks.
  await getStorage().save(storageKey, buffer);
  const row = await createAttachmentRepository(getDb(), scope).create({
    accountId: account.id,
    tradeId,
    storageKey,
    originalName: (file.name || "attachment").slice(0, 180),
    contentType: file.type,
    sizeBytes: file.size,
    caption: captionRaw || null,
  });
  if (!row) {
    await getStorage().delete(storageKey);
    return { error: "That trade is not available in your workspace." };
  }

  revalidatePath(`/trades/${tradeId}`);
  return { ok: true };
}

export async function updateAttachmentCaptionAction(formData: FormData) {
  const { scope, account } = await requireWorkspaceSession();
  const tradeId = String(formData.get("tradeId") ?? "").trim();
  await createAttachmentRepository(getDb(), scope).updateCaption(
    account.id,
    String(formData.get("attachmentId") ?? "").trim(),
    String(formData.get("caption") ?? "").slice(0, 300),
  );
  revalidatePath(`/trades/${tradeId}`);
}

export async function deleteAttachmentAction(formData: FormData) {
  const { scope, account } = await requireWorkspaceSession();
  const tradeId = String(formData.get("tradeId") ?? "").trim();
  const storageKey = await createAttachmentRepository(getDb(), scope).remove(
    account.id,
    String(formData.get("attachmentId") ?? "").trim(),
  );
  if (storageKey) await getStorage().delete(storageKey);
  revalidatePath(`/trades/${tradeId}`);
}
