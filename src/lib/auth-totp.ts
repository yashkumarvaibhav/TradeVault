import { createOTP } from "@better-auth/utils/otp";
import { symmetricDecrypt, symmetricEncrypt, verifyPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";

import type { Database } from "@/db/client";
import { authAccounts, authTwoFactors } from "@/db/schema";

/**
 * Shared TOTP verification against a user's stored two-factor secret.
 *
 * TradeVault makes TOTP enrollment mandatory but keeps it DECOUPLED from Better Auth's
 * login challenge (`users.two_factor_enabled`). "Enrolled" therefore means a *verified*
 * `auth_two_factors` row exists — Better Auth's own source of truth — independent of whether
 * the user has opted into a code at every sign-in.
 *
 * The secret/backup codes are encrypted with `BETTER_AUTH_SECRET` and checked with the same
 * crypto/OTP primitives Better Auth uses, so this works server-side without a Better Auth
 * session (needed for mandatory enrollment confirmation, forgot-password, and the
 * password→TOTP gate on sensitive actions). `db` is injected so it is testable on PGlite.
 */
function authSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is required for TOTP verification.");
  return secret;
}

const normalizeBackupCode = (value: string) => value.replace(/[\s-]/g, "");

/** True once the user has a verified authenticator secret (the mandatory-enrollment signal). */
export async function isTotpEnrolled(db: Database, userId: string): Promise<boolean> {
  const [factor] = await db
    .select({ verified: authTwoFactors.verified })
    .from(authTwoFactors)
    .where(eq(authTwoFactors.userId, userId))
    .limit(1);
  return Boolean(factor?.verified);
}

/**
 * Verify the user's current credential without signing in or minting another session.
 * Better Auth stores the password hash on the credential account, so sensitive-action
 * re-authentication can use the same crypto primitive while keeping the existing session.
 */
export async function verifyUserPassword(db: Database, userId: string, password: string): Promise<boolean> {
  if (!password) return false;
  const [account] = await db
    .select({ password: authAccounts.password })
    .from(authAccounts)
    .where(and(eq(authAccounts.userId, userId), eq(authAccounts.providerId, "credential")))
    .limit(1);
  if (!account?.password) return false;
  try {
    return await verifyPassword({ hash: account.password, password });
  } catch {
    return false;
  }
}

/**
 * Verify a 6-digit TOTP code (or, with `useBackup`, a single-use backup code) against the
 * user's stored secret. Returns false when the user has no secret. A matched backup code is
 * consumed. Does not require (or check) the verified flag, so it also drives enrollment confirm.
 */
export async function verifyUserTotp(
  db: Database,
  userId: string,
  code: string,
  opts: { useBackup?: boolean } = {},
): Promise<boolean> {
  const key = authSecret();
  const trimmed = code.trim();
  if (!trimmed) return false;

  const [factor] = await db.select().from(authTwoFactors).where(eq(authTwoFactors.userId, userId)).limit(1);
  if (!factor) return false;

  if (opts.useBackup) {
    let codes: string[] = [];
    try {
      codes = JSON.parse(await symmetricDecrypt({ key, data: factor.backupCodes })) as string[];
    } catch {
      codes = [];
    }
    const index = codes.findIndex((candidate) => normalizeBackupCode(candidate) === normalizeBackupCode(trimmed));
    if (index < 0) return false;
    codes.splice(index, 1); // a backup code is single-use
    const reEncrypted = await symmetricEncrypt({ key, data: JSON.stringify(codes) });
    await db.update(authTwoFactors).set({ backupCodes: reEncrypted }).where(eq(authTwoFactors.id, factor.id));
    return true;
  }

  if (!/^\d{6}$/.test(trimmed)) return false;
  try {
    const rawSecret = await symmetricDecrypt({ key, data: factor.secret });
    return await createOTP(rawSecret, { period: 30, digits: 6 }).verify(trimmed);
  } catch {
    return false;
  }
}

/**
 * Mark the user's authenticator secret as verified (completes mandatory enrollment) WITHOUT
 * enabling Better Auth's login challenge — login stays password-only unless the user later opts
 * into 2FA. Returns false if there is no secret to mark (enrollment was never started).
 */
export async function markTotpEnrolled(db: Database, userId: string): Promise<boolean> {
  const result = await db
    .update(authTwoFactors)
    .set({ verified: true })
    .where(eq(authTwoFactors.userId, userId))
    .returning({ id: authTwoFactors.id });
  return result.length > 0;
}
