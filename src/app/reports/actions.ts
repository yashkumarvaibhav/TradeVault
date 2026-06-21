"use server";

import { headers } from "next/headers";

import { getDb } from "@/db/server";
import { getAuth } from "@/lib/auth-server";
import { verifyUserPassword, verifyUserTotp } from "@/lib/auth-totp";
import { grantSensitiveActionAuthorization } from "@/lib/sensitive-reauth";

export type SensitiveActionAuthorizationResult = { ok: true } | { ok: false; error: string };

/** Issue a two-minute, session-bound authorization after password then TOTP verification. */
export async function authorizeSensitiveAction(
  password: string,
  code: string,
): Promise<SensitiveActionAuthorizationResult> {
  const session = await getAuth().api.getSession({ headers: await headers() }).catch(() => null);
  if (!session) return { ok: false, error: "Your session expired. Please sign in again." };
  if (!password) return { ok: false, error: "Enter your current password." };
  if (!/^\d{6}$/.test(code.trim())) return { ok: false, error: "Enter the 6-digit code from your authenticator app." };

  const db = getDb();
  // Deliberately sequential: a valid password is required before TOTP is evaluated.
  if (!(await verifyUserPassword(db, session.user.id, password))) {
    return { ok: false, error: "Your password or authenticator code didn't match." };
  }
  if (!(await verifyUserTotp(db, session.user.id, code.trim()))) {
    return { ok: false, error: "Your password or authenticator code didn't match." };
  }

  await grantSensitiveActionAuthorization({ userId: session.user.id, sessionId: session.session.id });
  return { ok: true };
}
