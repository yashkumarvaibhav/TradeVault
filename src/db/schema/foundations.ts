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
  unique,
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
 * Product user record — also Better Auth's `user` model (mapped via `user.modelName`).
 * Property keys mirror Better Auth field names (camelCase) so the Drizzle adapter resolves
 * columns; DB columns stay snake_case. `email` is a synthesized, non-user-facing identifier
 * (`<username>@users.tradevault.local`) — login stays username-only; email is never shown or
 * used for verification. See `auth.ts` for the session/account/verification tables.
 */
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  username: text("username").notNull(),
  displayUsername: text("display_username").notNull(),
  // Better Auth core fields. `name` defaults to the display username at sign-up.
  name: text("name").notNull(),
  email: text("email").notNull(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  // Better Auth twoFactor plugin: flipped true only after a TOTP code is verified.
  twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
  // IANA timezone used for display, date bucketing, range boundaries, and local datetime entry.
  timeZone: text("time_zone").notNull().default("Asia/Kolkata"),
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
  uniqueIndex("users_email_unique").on(table.email),
  check("users_username_normalized_check", sql`${table.username} = lower(${table.username})`),
  check("users_username_not_blank_check", sql`length(trim(${table.username})) >= 3`),
  check("users_email_not_blank_check", sql`length(trim(${table.email})) > 0`),
  check("users_time_zone_not_blank_check", sql`length(trim(${table.timeZone})) > 0`),
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
  unique("trading_accounts_tenant_id_unique").on(table.tenantId, table.id),
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
