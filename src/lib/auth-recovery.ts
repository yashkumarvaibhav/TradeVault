import { hashPassword } from "better-auth/crypto";
import { and, eq, ne } from "drizzle-orm";

import type { Database } from "@/db/client";
import { authAccounts, authSessions, users } from "@/db/schema";
import { normalizeUsername } from "@/lib/auth-policy";
import { verifyUserPassword, verifyUserTotp } from "@/lib/auth-totp";

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

async function writePassword(db: Database, userId: string, newPassword: string): Promise<void> {
  const hash = await hashPassword(newPassword);
  await db
    .update(authAccounts)
    .set({ password: hash, updatedAt: new Date() })
    .where(and(eq(authAccounts.userId, userId), eq(authAccounts.providerId, "credential")));
}

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

  await writePassword(db, user.id, input.newPassword);
  // A password reset revokes every existing session.
  await db.delete(authSessions).where(eq(authSessions.userId, user.id));
  return "ok";
}

/** Change an authenticated user's password only after current-password then TOTP verification. */
export async function changePasswordWithTotp(
  db: Database,
  input: { userId: string; currentPassword: string; newPassword: string; code: string; currentSessionId: string },
): Promise<RecoveryResult> {
  if (!input.currentPassword || !input.newPassword || !input.code || !input.currentSessionId) return "invalid";
  // Keep the prescribed order explicit: password must succeed before the TOTP is evaluated.
  if (!(await verifyUserPassword(db, input.userId, input.currentPassword))) return "invalid";
  if (!(await verifyUserTotp(db, input.userId, input.code))) return "invalid";

  await writePassword(db, input.userId, input.newPassword);
  // Preserve only the session performing the change; every other device must sign in again.
  await db
    .delete(authSessions)
    .where(and(eq(authSessions.userId, input.userId), ne(authSessions.id, input.currentSessionId)));
  return "ok";
}
