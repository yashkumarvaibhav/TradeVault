import assert from "node:assert/strict";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";

import { createAuth } from "../src/lib/auth";
import * as schema from "../src/db/schema";
import { synthesizeAuthEmail } from "../src/db/repositories/workspaces";

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
    secret: "verify-auth-oracle-secret-key-0123456789abcdef",
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

  await db.execute(sql`select 1`);
  await pglite.close();
  console.log(
    "Auth runtime verified on PGlite: username sign-up created the reconciled users + auth_accounts (hashed) rows, " +
      "and username sign-in issued an auth_sessions row while rejecting a wrong password.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
