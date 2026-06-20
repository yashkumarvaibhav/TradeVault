import { createOTP } from "@better-auth/utils/otp";
import { hashPassword, symmetricDecrypt, symmetricEncrypt } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";

import type { Database } from "@/db/client";
import { authAccounts, authSessions, authTwoFactors, users } from "@/db/schema";
import { normalizeUsername } from "@/lib/auth-policy";

/**
 * Email-free password recovery. Better Auth has no native TOTP-based reset (its reset is
 * email-link based, and verify-totp/verify-backup-code need a session or the 2FA sign-in
 * cookie). So we verify the code directly against the user's stored two-factor secret —
 * decrypted with the same `BETTER_AUTH_SECRET` and checked with the same OTP/crypto
 * primitives Better Auth uses — then hash + set a new password and revoke existing sessions.
 *
 * `db` is injected so this is testable on PGlite (see `scripts/verify-auth.ts`).
 */
export type RecoveryResult = "ok" | "invalid";

function recoverySecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is required for password recovery.");
  return secret;
}

const normalizeBackupCode = (value: string) => value.replace(/[\s-]/g, "");

export async function recoverPasswordWithTotp(
  db: Database,
  input: { username: string; code: string; newPassword: string; useBackup?: boolean },
): Promise<RecoveryResult> {
  const key = recoverySecret();
  const username = normalizeUsername(input.username);
  const code = input.code.trim();
  if (!username || !code || !input.newPassword) return "invalid";

  const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
  // Recovery is only possible for accounts that set up two-factor. Keep the failure generic.
  if (!user || !user.twoFactorEnabled) return "invalid";

  const [factor] = await db.select().from(authTwoFactors).where(eq(authTwoFactors.userId, user.id)).limit(1);
  if (!factor) return "invalid";

  let valid = false;
  if (input.useBackup) {
    let codes: string[] = [];
    try {
      codes = JSON.parse(await symmetricDecrypt({ key, data: factor.backupCodes })) as string[];
    } catch {
      codes = [];
    }
    const index = codes.findIndex((candidate) => normalizeBackupCode(candidate) === normalizeBackupCode(code));
    if (index >= 0) {
      valid = true;
      codes.splice(index, 1); // a backup code is single-use
      const reEncrypted = await symmetricEncrypt({ key, data: JSON.stringify(codes) });
      await db.update(authTwoFactors).set({ backupCodes: reEncrypted }).where(eq(authTwoFactors.id, factor.id));
    }
  } else if (/^\d{6}$/.test(code)) {
    try {
      const rawSecret = await symmetricDecrypt({ key, data: factor.secret });
      valid = await createOTP(rawSecret, { period: 30, digits: 6 }).verify(code);
    } catch {
      valid = false;
    }
  }
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
