import { NextResponse } from "next/server";

import { createVaultSearchRepository } from "@/db/repositories/search";
import { getDb } from "@/db/server";
import { requireWorkspaceSession } from "@/lib/workspace-session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { scope, account } = await requireWorkspaceSession();
  const query = new URL(request.url).searchParams.get("q") ?? "";
  const results = await createVaultSearchRepository(getDb(), scope).search(account.id, query, 15);
  return NextResponse.json({ results }, { headers: { "Cache-Control": "private, no-store" } });
}
