import { relations } from "drizzle-orm";
import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { users } from "./foundations";

/**
 * Better Auth runtime tables (session / account / verification), reconciled with the
 * username-first `users` model in `foundations.ts`.
 *
 * Contract notes (Better Auth 1.6 + `@better-auth/drizzle-adapter`):
 *  - Object **property keys** below must equal Better Auth's camelCase field names
 *    (`userId`, `expiresAt`, `ipAddress`, …); the adapter resolves columns by those keys.
 *    DB column names stay snake_case via the column builders.
 *  - `id` is a DB-generated `uuid` (config sets `advanced.database.generateId: false`),
 *    matching `users.id`; `userId` columns are `uuid` FKs onto `users.id`.
 *  - `account.password` stores the credential hash for username+password sign-in.
 */
export const authSessions = pgTable("auth_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("auth_sessions_token_unique").on(table.token),
  index("auth_sessions_user_idx").on(table.userId),
]);

export const authAccounts = pgTable("auth_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("auth_accounts_user_idx").on(table.userId),
  uniqueIndex("auth_accounts_provider_account_unique").on(table.providerId, table.accountId),
]);

export const authVerifications = pgTable("auth_verifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("auth_verifications_identifier_idx").on(table.identifier),
]);

// Better Auth twoFactor plugin table (mapped via adapter schema key `twoFactor`).
// `secret`/`backupCodes` are encrypted by Better Auth; never returned to the client.
export const authTwoFactors = pgTable("auth_two_factors", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  secret: text("secret").notNull(),
  backupCodes: text("backup_codes").notNull(),
  verified: boolean("verified").notNull().default(true),
}, (table) => [
  index("auth_two_factors_user_idx").on(table.userId),
]);

export const authTwoFactorsRelations = relations(authTwoFactors, ({ one }) => ({
  user: one(users, { fields: [authTwoFactors.userId], references: [users.id] }),
}));

export const authSessionsRelations = relations(authSessions, ({ one }) => ({
  user: one(users, { fields: [authSessions.userId], references: [users.id] }),
}));

export const authAccountsRelations = relations(authAccounts, ({ one }) => ({
  user: one(users, { fields: [authAccounts.userId], references: [users.id] }),
}));
