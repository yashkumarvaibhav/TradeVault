import { createDataTransferRepository } from "@/db/repositories/data-transfer";
import { getDb } from "@/db/server";
import { requireWorkspaceSession } from "@/lib/workspace-session";
import { hasSensitiveActionAuthorization, sensitiveActionDeniedResponse } from "@/lib/sensitive-reauth";

export const dynamic = "force-dynamic";

function safeFilename(value: string) {
  return value.trim().replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "").slice(0, 80) || "account";
}

export async function GET() {
  const { session, scope, account } = await requireWorkspaceSession();
  if (!(await hasSensitiveActionAuthorization({ userId: session.user.id, sessionId: session.session.id }))) {
    return sensitiveActionDeniedResponse();
  }
  const payload = await createDataTransferRepository(getDb(), scope).exportAccount(account.id);
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="tradevault_${safeFilename(account.name)}_${stamp}.json"`,
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
