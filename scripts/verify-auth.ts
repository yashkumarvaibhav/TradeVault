import assert from "node:assert/strict";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { createOTP } from "@better-auth/utils/otp";
import { symmetricEncrypt } from "better-auth/crypto";
import { eq, sql } from "drizzle-orm";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";

import { createAuth } from "../src/lib/auth";
import type { Database } from "../src/db/client";
import * as schema from "../src/db/schema";
import { authTwoFactors, users } from "../src/db/schema";
import { ensureWorkspaceForUser, synthesizeAuthEmail } from "../src/db/repositories/workspaces";
import { recoverPasswordWithTotp } from "../src/lib/auth-recovery";
import { isTotpEnrolled, markTotpEnrolled, verifyUserTotp } from "../src/lib/auth-totp";

const ORACLE_SECRET = "verify-auth-oracle-secret-key-0123456789abcdef";
process.env.BETTER_AUTH_SECRET = ORACLE_SECRET;

/**
 * End-to-end oracle for the Better Auth ⇄ username-first schema reconciliation.
 * Runs entirely in-process on PGlite — proves username sign-up/sign-in actually
 * read/write the reconciled `users` + `auth_*` tables. No external services.
 */
async function main() {
  const pglite = new PGlite();
  const db = drizzlePglite(pglite, { schema });

  await migratePglite(db, {
    migrationsFolder: path.join(process.cwd(), "drizzle"),
    migrationsSchema: "drizzle",
    migrationsTable: "__tradevault_migrations",
  });

  const auth = createAuth(db, {
    secret: ORACLE_SECRET,
    baseURL: "http://localhost:3000",
  });

  const username = "TraderJoe";
  const password = "correct-horse-battery-staple";

  const signUp = await auth.api.signUpEmail({
    body: {
      username,
      displayUsername: username,
      name: username,
      email: synthesizeAuthEmail(username),
      password,
    },
  });
  assert.ok(signUp.user, "sign-up returned a user");
  assert.equal(signUp.user.email, "traderjoe@users.tradevault.local");

  const rawQuery = (query: string) => pglite.query(query);

  // The product user row landed in `users` with the synthesized, normalized identity.
  const userRows = await rawQuery("select username, email, name, email_verified from users");
  assert.equal(userRows.rows.length, 1);
  const userRow = userRows.rows[0] as { username: string; email: string; name: string; email_verified: boolean };
  assert.equal(userRow.username, "traderjoe");
  assert.equal(userRow.email, "traderjoe@users.tradevault.local");
  assert.equal(userRow.name, "TraderJoe");
  assert.equal(userRow.email_verified, false);

  // The credential hash is stored in auth_accounts.password — never the plaintext.
  const accountRows = await rawQuery("select provider_id, password from auth_accounts");
  assert.equal(accountRows.rows.length, 1);
  const accountRow = accountRows.rows[0] as { provider_id: string; password: string | null };
  assert.equal(accountRow.provider_id, "credential");
  assert.ok(accountRow.password && accountRow.password.length > 0, "password hash stored");
  assert.ok(!accountRow.password!.includes(password), "stored hash is not the plaintext password");

  // autoSignIn creates a session at sign-up; an explicit username sign-in adds another.
  const countSessions = async () =>
    Number(((await rawQuery("select count(*) from auth_sessions")).rows[0] as { count: string | number }).count);
  const afterSignUp = await countSessions();
  assert.equal(afterSignUp, 1, "auto sign-in created a session at sign-up");

  const signIn = await auth.api.signInUsername({ body: { username, password } });
  assert.ok(signIn && "token" in signIn && signIn.token, "username sign-in issued a token");
  assert.equal(await countSessions(), afterSignUp + 1, "username sign-in issued an additional session");

  // Wrong password is rejected (no new session).
  let rejected = false;
  try {
    await auth.api.signInUsername({ body: { username, password: "wrong-password-entirely" } });
  } catch {
    rejected = true;
  }
  assert.equal(rejected, true, "wrong password rejected");

  // Onboarding: ensureWorkspaceForUser provisions a tenant + default Main account, idempotently.
  const userId = (((await rawQuery("select id from users limit 1")).rows[0]) as { id: string }).id;
  const scope = await ensureWorkspaceForUser(db, { userId, slugBase: username, tenantName: "TraderJoe's vault" });
  assert.ok(scope.tenantId, "workspace scope created");

  const accounts = await rawQuery("select name, is_default, default_currency from trading_accounts");
  assert.equal(accounts.rows.length, 1, "exactly one trading account provisioned");
  const account = accounts.rows[0] as { name: string; is_default: boolean; default_currency: string };
  assert.equal(account.name, "Main");
  assert.equal(account.is_default, true);
  assert.equal(account.default_currency, "INR");

  const scopeAgain = await ensureWorkspaceForUser(db, { userId, slugBase: username, tenantName: "TraderJoe's vault" });
  assert.equal(scopeAgain.tenantId, scope.tenantId, "ensureWorkspaceForUser is idempotent");
  const accountCount = Number(((await rawQuery("select count(*) from trading_accounts")).rows[0] as { count: string | number }).count);
  assert.equal(accountCount, 1, "re-provision did not duplicate the account");

  // Mandatory TOTP, DECOUPLED from the login challenge. Enrollment marks a secret verified but
  // never flips two_factor_enabled; recovery + sensitive actions key off the enrolled secret.
  assert.equal(await isTotpEnrolled(db as unknown as Database, userId), false, "not enrolled before setup");

  const rawTotpSecret = "ORACLEtotpSECRETrawKEY32charsXX0";
  const backupCodes = ["ORCL-AAAA-1111", "ORCL-BBBB-2222"];
  // enableTwoFactor stores the secret with verified=false; mirror that here.
  await db.insert(authTwoFactors).values({
    userId,
    secret: await symmetricEncrypt({ key: ORACLE_SECRET, data: rawTotpSecret }),
    backupCodes: await symmetricEncrypt({ key: ORACLE_SECRET, data: JSON.stringify(backupCodes) }),
    verified: false,
  });
  assert.equal(await isTotpEnrolled(db as unknown as Database, userId), false, "an unverified factor is not yet enrollment");
  assert.equal(
    await verifyUserTotp(db as unknown as Database, userId, await createOTP(rawTotpSecret, { period: 30, digits: 6 }).totp()),
    true,
    "verifyUserTotp accepts a current code",
  );
  assert.equal(await verifyUserTotp(db as unknown as Database, userId, "000000"), false, "verifyUserTotp rejects a wrong code");
  await markTotpEnrolled(db as unknown as Database, userId);
  assert.equal(await isTotpEnrolled(db as unknown as Database, userId), true, "enrolled once the secret is verified");

  // Enrollment must NOT have enabled the login challenge.
  const afterEnroll = (await rawQuery("select two_factor_enabled from users limit 1")).rows[0] as { two_factor_enabled: boolean };
  assert.equal(afterEnroll.two_factor_enabled, false, "enrollment leaves the login challenge off");

  // Email-free recovery works for an enrolled account even with at-login 2FA OFF.
  const newPassword = "reset-via-totp-passphrase-2026";
  const totpCode = await createOTP(rawTotpSecret, { period: 30, digits: 6 }).totp();
  assert.equal(await recoverPasswordWithTotp(db as unknown as Database, { username, code: totpCode, newPassword }), "ok", "TOTP recovery succeeded (enrolled, login-2FA off)");

  const reSignIn = await auth.api.signInUsername({ body: { username, password: newPassword } });
  assert.ok(reSignIn && "token" in reSignIn && reSignIn.token, "new password accepted with a token (login-2FA off → no challenge)");
  let oldRejected = false;
  try {
    await auth.api.signInUsername({ body: { username, password } });
  } catch {
    oldRejected = true;
  }
  assert.equal(oldRejected, true, "old password no longer works after reset");

  // A backup code also resets, and is single-use.
  assert.equal(
    await recoverPasswordWithTotp(db as unknown as Database, { username, code: "ORCL-AAAA-1111", newPassword: "backup-reset-passphrase-2026", useBackup: true }),
    "ok",
    "backup-code recovery succeeded",
  );
  assert.equal(
    await recoverPasswordWithTotp(db as unknown as Database, { username, code: "ORCL-AAAA-1111", newPassword: "should-not-apply-2026", useBackup: true }),
    "invalid",
    "used backup code is rejected on reuse",
  );
  assert.equal(
    await recoverPasswordWithTotp(db as unknown as Database, { username, code: "000000", newPassword: "should-not-apply-2026" }),
    "invalid",
    "wrong TOTP code is rejected",
  );

  // Opting into a code at every sign-in re-introduces the Better Auth login challenge.
  await db.update(users).set({ twoFactorEnabled: true }).where(eq(users.id, userId));
  const challenged = await auth.api.signInUsername({ body: { username, password: "backup-reset-passphrase-2026" } });
  assert.ok(challenged && "twoFactorRedirect" in challenged && challenged.twoFactorRedirect, "with login-2FA on, sign-in is challenged");

  await db.execute(sql`select 1`);
  await pglite.close();
  console.log(
    "Auth runtime verified on PGlite: username sign-up created the reconciled users + auth_accounts (hashed) rows, " +
      "username sign-in issued an auth_sessions row while rejecting a wrong password, and onboarding provisioned a " +
      "single default workspace idempotently.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
