import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const currencyCodes = ["INR", "USD"] as const;
export const membershipRoles = ["owner", "member"] as const;
export const assetClasses = ["Equity", "Index", "Forex", "Commodity", "US Index", "Crypto"] as const;
export const instrumentTypes = ["Cash", "Futures", "Options"] as const;
export const tradeDirections = ["Long", "Short"] as const;
export const tradeStatuses = ["open", "closed"] as const;

export const currencyCode = pgEnum("currency_code", currencyCodes);
export const membershipRole = pgEnum("membership_role", membershipRoles);
export const assetClass = pgEnum("asset_class", assetClasses);
export const instrumentType = pgEnum("instrument_type", instrumentTypes);
export const tradeDirection = pgEnum("trade_direction", tradeDirections);
export const tradeStatus = pgEnum("trade_status", tradeStatuses);

/**
 * Reusable storage pair for every persisted amount. Consumers must spread both
 * columns into the same table so a monetary value cannot lose its currency.
 */
export function moneyColumns(prefix: string) {
  return {
    amount: numeric(`${prefix}_amount`, { precision: 20, scale: 6 }).notNull(),
    currency: currencyCode(`${prefix}_currency`).notNull(),
  } as const;
}

/**
 * Product user record. Better Auth core/session tables land in P1 after its
 * generated schema is reconciled with this username-first migration contract.
 */
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  username: text("username").notNull(),
  displayUsername: text("display_username").notNull(),
  displayName: text("display_name"),
  legacyPasswordHash: text("legacy_password_hash"),
  legacyPasswordSalt: text("legacy_password_salt"),
  legacyTotpSecret: text("legacy_totp_secret"),
  totpVerified: boolean("totp_verified").notNull().default(false),
  failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
  accountLocked: boolean("account_locked").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("users_username_unique").on(table.username),
  check("users_username_normalized_check", sql`${table.username} = lower(${table.username})`),
  check("users_username_not_blank_check", sql`length(trim(${table.username})) >= 3`),
  check("users_failed_login_attempts_nonnegative_check", sql`${table.failedLoginAttempts} >= 0`),
]);

export const tenants = pgTable("tenants", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("tenants_slug_unique").on(table.slug),
  check("tenants_slug_normalized_check", sql`${table.slug} = lower(${table.slug})`),
  check("tenants_slug_format_check", sql`${table.slug} ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'`),
  check("tenants_name_not_blank_check", sql`length(trim(${table.name})) > 0`),
]);

export const tenantMemberships = pgTable("tenant_memberships", {
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: membershipRole("role").notNull().default("member"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ name: "tenant_memberships_pk", columns: [table.tenantId, table.userId] }),
  index("tenant_memberships_user_idx").on(table.userId),
]);

export const tradingAccounts = pgTable("trading_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  ownerUserId: uuid("owner_user_id").notNull(),
  name: text("name").notNull().default("Main"),
  defaultCurrency: currencyCode("default_currency").notNull().default("INR"),
  isDefault: boolean("is_default").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
}, (table) => [
  foreignKey({
    name: "trading_accounts_owner_membership_fk",
    columns: [table.tenantId, table.ownerUserId],
    foreignColumns: [tenantMemberships.tenantId, tenantMemberships.userId],
  }).onDelete("cascade"),
  uniqueIndex("trading_accounts_owner_name_unique").on(table.tenantId, table.ownerUserId, table.name),
  uniqueIndex("trading_accounts_one_default_per_owner_unique")
    .on(table.tenantId, table.ownerUserId)
    .where(sql`${table.isDefault} = true`),
  index("trading_accounts_tenant_idx").on(table.tenantId),
  check("trading_accounts_name_not_blank_check", sql`length(trim(${table.name})) > 0`),
  check("trading_accounts_default_not_archived_check", sql`not ${table.isDefault} or ${table.archivedAt} is null`),
]);

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(tenantMemberships),
  tradingAccounts: many(tradingAccounts),
}));

export const tenantsRelations = relations(tenants, ({ many }) => ({
  memberships: many(tenantMemberships),
  tradingAccounts: many(tradingAccounts),
}));

export const tenantMembershipsRelations = relations(tenantMemberships, ({ one }) => ({
  tenant: one(tenants, { fields: [tenantMemberships.tenantId], references: [tenants.id] }),
  user: one(users, { fields: [tenantMemberships.userId], references: [users.id] }),
}));

export const tradingAccountsRelations = relations(tradingAccounts, ({ one }) => ({
  tenant: one(tenants, { fields: [tradingAccounts.tenantId], references: [tenants.id] }),
  owner: one(users, { fields: [tradingAccounts.ownerUserId], references: [users.id] }),
}));
