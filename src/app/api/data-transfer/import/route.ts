import { NextResponse } from "next/server";

import { createDataTransferRepository } from "@/db/repositories/data-transfer";
import { getDb } from "@/db/server";
import { requireWorkspaceSession } from "@/lib/workspace-session";

export const dynamic = "force-dynamic";
const MAX_JSON_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const { scope, account, timeZone } = await requireWorkspaceSession();
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) return NextResponse.json({ error: "Choose a TradeVault JSON export." }, { status: 415 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !file.name.toLocaleLowerCase().endsWith(".json")) {
    return NextResponse.json({ error: "Choose a .json TradeVault export." }, { status: 400 });
  }
  if (file.size <= 0 || file.size > MAX_JSON_BYTES) {
    return NextResponse.json({ error: "The JSON export must be between 1 byte and 10 MB." }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(await file.text());
  } catch {
    return NextResponse.json({ error: "The selected file is not valid JSON." }, { status: 400 });
  }

  try {
    const summary = await createDataTransferRepository(getDb(), scope).importAccount(account.id, payload, timeZone);
    return NextResponse.json({ summary }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const importErrors = error instanceof Error && "importErrors" in error && Array.isArray(error.importErrors)
      ? error.importErrors.filter((item): item is string => typeof item === "string").slice(0, 20)
      : [];
    if (importErrors.length) return NextResponse.json({ error: "Import validation failed.", details: importErrors }, { status: 400 });
    throw error;
  }
}
