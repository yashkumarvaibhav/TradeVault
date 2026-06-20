import { createAttachmentRepository } from "@/db/repositories/attachments";
import { getDb } from "@/db/server";
import { getStorage } from "@/lib/storage";
import { requireWorkspaceSession } from "@/lib/workspace-session";

export const dynamic = "force-dynamic";

/**
 * Auth-gated, tenant/account-scoped attachment serving. Private trade media is never
 * publicly readable: the request must carry the owner's session and the attachment
 * must belong to their workspace, or this 404s.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ attachmentId: string }> }) {
  const { scope, account } = await requireWorkspaceSession();
  const { attachmentId } = await params;
  const attachment = await createAttachmentRepository(getDb(), scope).getById(account.id, attachmentId);
  if (!attachment) return new Response("Not found", { status: 404 });

  let data: Buffer;
  try {
    data = await getStorage().read(attachment.storageKey);
  } catch {
    return new Response("Not found", { status: 404 });
  }

  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": attachment.contentType,
      "Content-Length": String(attachment.sizeBytes),
      "Content-Disposition": `inline; filename="${encodeURIComponent(attachment.originalName)}"`,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
