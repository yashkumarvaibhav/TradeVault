import { NextResponse } from "next/server";

import { readServerEnvironment } from "@/lib/env";
import { checkReadiness } from "@/lib/health/readiness";

export const dynamic = "force-dynamic";

export async function GET() {
  const { databaseUrl } = readServerEnvironment();
  const result = await checkReadiness({ databaseUrl });
  return NextResponse.json({
    status: result.ready ? "ready" : "not_ready",
    service: "tradevault-v2",
    dependencies: { database: result.database },
  }, {
    status: result.ready ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
