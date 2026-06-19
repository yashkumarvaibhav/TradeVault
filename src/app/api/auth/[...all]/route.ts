import { toNextJsHandler } from "better-auth/next-js";

import { getAuth } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

// getAuth() is resolved per-request (build-safe) before delegating to Better Auth.
export async function GET(request: Request) {
  return toNextJsHandler(getAuth()).GET(request);
}

export async function POST(request: Request) {
  return toNextJsHandler(getAuth()).POST(request);
}
