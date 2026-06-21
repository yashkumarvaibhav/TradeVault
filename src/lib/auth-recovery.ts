import { hashPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";

import type { Database } from "@/db/client";
import { authAccounts, authSessions, users } from "@/db/schema";
import { normalizeUsername } from "@/lib/auth-policy";
import { verifyUserTotp } from "@/lib/auth-totp";

/**
 * Email-free password recovery. Better Auth has no native TOTP-based reset (its reset is
 * email-link based, and verify-totp/verify-backup-code need a session or the 2FA sign-in
 * cookie). So we verify the code directly against the user's stored two-factor secret (see
 * `verifyUserTotp`), then hash + set a new password and revoke existing sessions.
 *
 * Since TOTP enrollment is mandatory and decoupled from the login challenge, recovery keys off
 * the *enrolled secret* (`verifyUserTotp` returns false when there is none) rather than
 * `users.two_factor_enabled` — every account has an authenticator to recover with.
 *
 * `db` is injected so this is testable on PGlite (see `scripts/verify-auth.ts`).
 */
export type RecoveryResult = "ok" | "invalid";

export async function recoverPasswordWithTotp(
  db: Database,
  input: { username: string; code: string; newPassword: string; useBackup?: boolean },
): Promise<RecoveryResult> {
  const username = normalizeUsername(input.username);
  const code = input.code.trim();
  if (!username || !code || !input.newPassword) return "invalid";

  const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
  // Keep the failure generic (no account enumeration).
  if (!user) return "invalid";

  const valid = await verifyUserTotp(db, user.id, code, { useBackup: input.useBackup });
  if (!valid) return "invalid";

  const hash = await hashPassword(input.newPassword);
  await db
    .update(authAccounts)
    .set({ password: hash, updatedAt: new Date() })
    .where(and(eq(authAccounts.userId, user.id), eq(authAccounts.providerId, "credential")));
  // A password reset revokes every existing session.
  await db.delete(authSessions).where(eq(authSessions.userId, user.id));
  return "ok";
}
