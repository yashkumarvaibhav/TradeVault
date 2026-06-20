import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username } from "better-auth/plugins";

import type { Database } from "@/db/client";
import { authAccounts, authSessions, authVerifications, users } from "@/db/schema";
import { PASSWORD_MIN_LENGTH, USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH } from "@/lib/auth-policy";

/**
 * Build a Better Auth instance bound to a specific Drizzle database.
 *
 * The `users` table doubles as Better Auth's `user` model (no second user table);
 * `auth_*` tables hold sessions/accounts/verification. Login is username-only — the
 * required `email` is a synthesized, non-user-facing identifier (see `synthesizeAuthEmail`)
 * and email verification is disabled. IDs come from the DB (`generateId: false` → the
 * `uuid` column defaults), matching the existing `users.id`.
 *
 * Extra plugins (e.g. `nextCookies()`) are appended last, as Better Auth requires.
 */
export function createAuth(
  db: Database,
  options: { secret?: string; baseURL?: string; extraPlugins?: BetterAuthOptions["plugins"] } = {},
) {
  return betterAuth({
    secret: options.secret ?? process.env.BETTER_AUTH_SECRET,
    baseURL: options.baseURL ?? process.env.BETTER_AUTH_URL,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: users,
        session: authSessions,
        account: authAccounts,
        verification: authVerifications,
      },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: PASSWORD_MIN_LENGTH,
      requireEmailVerification: false,
      autoSignIn: true,
    },
    advanced: {
      database: { generateId: false },
    },
    plugins: [
      username({ minUsernameLength: USERNAME_MIN_LENGTH, maxUsernameLength: USERNAME_MAX_LENGTH }),
      ...(options.extraPlugins ?? []),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
