import { relations, sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import {
  assetClass,
  currencyCode,
  instrumentType,
  tenantMemberships,
  tenants,
  tradeDirection,
  tradeStatus,
  tradingAccounts,
  users,
} from "./foundations";

export type SetupChecklistItem = {
  id: string;
  label: string;
  phase: "entry" | "exit";
  completed: boolean;
};

export type SetupChecklistTemplateItem = Omit<SetupChecklistItem, "completed">;

export const instruments = pgTable("instruments", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  symbol: text("symbol").notNull(),
  name: text("name"),
  assetClass: assetClass("asset_class").notNull(),
  instrumentType: instrumentType("instrument_type").notNull(),
  subcategory: text("subcategory"),
  defaultTradingStyle: text("default_trading_style"),
  defaultQuantity: numeric("default_quantity", { precision: 20, scale: 6 }),
  defaultMultiplier: numeric("default_multiplier", { precision: 20, scale: 6 }),
  defaultPlatform: text("default_platform"),
  defaultCurrency: currencyCode("default_currency").notNull(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("instruments_tenant_symbol_type_unique").on(table.tenantId, table.symbol, table.instrumentType),
  unique("instruments_tenant_id_unique").on(table.tenantId, table.id),
  index("instruments_tenant_symbol_idx").on(table.tenantId, table.symbol),
  check("instruments_symbol_not_blank_check", sql`length(trim(${table.symbol})) > 0`),
  check("instruments_default_quantity_positive_check", sql`${table.defaultQuantity} is null or ${table.defaultQuantity} > 0`),
  check("instruments_default_multiplier_positive_check", sql`${table.defaultMultiplier} is null or ${table.defaultMultiplier} > 0`),
]);

export const strategies = pgTable("strategies", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("strategies_tenant_name_unique").on(table.tenantId, table.name),
  unique("strategies_tenant_id_unique").on(table.tenantId, table.id),
  check("strategies_name_not_blank_check", sql`length(trim(${table.name})) > 0`),
]);

export const closeReasons = pgTable("close_reasons", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("close_reasons_tenant_name_unique").on(table.tenantId, table.name),
  unique("close_reasons_tenant_id_unique").on(table.tenantId, table.id),
  check("close_reasons_name_not_blank_check", sql`length(trim(${table.name})) > 0`),
]);

export const playbooks = pgTable("playbooks", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  marketScope: text("market_scope"),
  setupRules: jsonb("setup_rules").$type<string[]>().notNull().default([]),
  notes: text("notes"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("playbooks_tenant_name_unique").on(table.tenantId, table.name),
  unique("playbooks_tenant_id_unique").on(table.tenantId, table.id),
  check("playbooks_name_not_blank_check", sql`length(trim(${table.name})) > 0`),
]);

export const checklistTemplates = pgTable("checklist_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  items: jsonb("items").$type<SetupChecklistTemplateItem[]>().notNull().default([]),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("checklist_templates_tenant_name_unique").on(table.tenantId, table.name),
  unique("checklist_templates_tenant_id_unique").on(table.tenantId, table.id),
  check("checklist_templates_name_not_blank_check", sql`length(trim(${table.name})) > 0`),
]);

export const trades = pgTable("trades", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  accountId: uuid("account_id").notNull(),
  createdByUserId: uuid("created_by_user_id").notNull(),
  instrumentId: uuid("instrument_id"),
  strategyId: uuid("strategy_id"),
  playbookId: uuid("playbook_id"),
  closeReasonId: uuid("close_reason_id"),

  symbol: text("symbol").notNull(),
  assetClass: assetClass("asset_class").notNull(),
  instrumentType: instrumentType("instrument_type").notNull(),
  subcategory: text("subcategory"),
  tradingStyle: text("trading_style"),
  platform: text("platform"),
  direction: tradeDirection("direction").notNull(),
  status: tradeStatus("status").notNull().default("open"),
  currency: currencyCode("currency").notNull(),

  entryAt: timestamp("entry_at", { withTimezone: true }).notNull(),
  entryPrice: numeric("entry_price", { precision: 20, scale: 6 }).notNull(),
  exitAt: timestamp("exit_at", { withTimezone: true }),
  exitPrice: numeric("exit_price", { precision: 20, scale: 6 }),
  quantity: numeric("quantity", { precision: 20, scale: 6 }).notNull(),
  multiplier: numeric("multiplier", { precision: 20, scale: 6 }).notNull().default("1"),
  stopLoss: numeric("stop_loss", { precision: 20, scale: 6 }),
  plannedTarget: numeric("planned_target", { precision: 20, scale: 6 }),
  manualPnl: numeric("manual_pnl", { precision: 20, scale: 6 }),
  fees: numeric("fees", { precision: 20, scale: 6 }).notNull().default("0"),
  fxToAccount: numeric("fx_to_account", { precision: 20, scale: 8 }).notNull().default("1"),

  plannedRisk: numeric("planned_risk", { precision: 20, scale: 6 }),
  plannedRewardRisk: numeric("planned_reward_risk", { precision: 16, scale: 6 }),
  realizedPnl: numeric("realized_pnl", { precision: 20, scale: 6 }),
  realizedR: numeric("realized_r", { precision: 16, scale: 6 }),

  confidence: integer("confidence"),
  emotion: text("emotion"),
  setupChecklist: jsonb("setup_checklist").$type<SetupChecklistItem[]>().notNull().default([]),
  tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
  ruleViolations: text("rule_violations"),
  linkedNote: text("linked_note"),
  notes: text("notes"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({
    name: "trades_tenant_account_fk",
    columns: [table.tenantId, table.accountId],
    foreignColumns: [tradingAccounts.tenantId, tradingAccounts.id],
  }).onDelete("cascade"),
  foreignKey({
    name: "trades_creator_membership_fk",
    columns: [table.tenantId, table.createdByUserId],
    foreignColumns: [tenantMemberships.tenantId, tenantMemberships.userId],
  }),
  foreignKey({
    name: "trades_tenant_instrument_fk",
    columns: [table.tenantId, table.instrumentId],
    foreignColumns: [instruments.tenantId, instruments.id],
  }).onDelete("set null"),
  foreignKey({
    name: "trades_tenant_strategy_fk",
    columns: [table.tenantId, table.strategyId],
    foreignColumns: [strategies.tenantId, strategies.id],
  }).onDelete("set null"),
  foreignKey({
    name: "trades_tenant_playbook_fk",
    columns: [table.tenantId, table.playbookId],
    foreignColumns: [playbooks.tenantId, playbooks.id],
  }).onDelete("set null"),
  foreignKey({
    name: "trades_tenant_close_reason_fk",
    columns: [table.tenantId, table.closeReasonId],
    foreignColumns: [closeReasons.tenantId, closeReasons.id],
  }).onDelete("set null"),
  index("trades_tenant_account_entry_idx").on(table.tenantId, table.accountId, table.entryAt),
  index("trades_tenant_symbol_idx").on(table.tenantId, table.symbol),
  index("trades_tenant_status_idx").on(table.tenantId, table.status),
  unique("trades_tenant_id_unique").on(table.tenantId, table.id),
  check("trades_symbol_not_blank_check", sql`length(trim(${table.symbol})) > 0`),
  check("trades_entry_price_positive_check", sql`${table.entryPrice} > 0`),
  check("trades_quantity_positive_check", sql`${table.quantity} > 0`),
  check("trades_multiplier_positive_check", sql`${table.multiplier} > 0`),
  check("trades_fees_nonnegative_check", sql`${table.fees} >= 0`),
  check("trades_fx_positive_check", sql`${table.fxToAccount} > 0`),
  check("trades_confidence_range_check", sql`${table.confidence} is null or ${table.confidence} between 1 and 5`),
  check("trades_exit_after_entry_check", sql`${table.exitAt} is null or ${table.exitAt} >= ${table.entryAt}`),
  check("trades_closed_has_result_check", sql`${table.status} = 'open' or (${table.exitAt} is not null and (${table.exitPrice} is not null or ${table.manualPnl} is not null))`),
  check("trades_directional_stop_check", sql`${table.stopLoss} is null or (${table.direction} = 'Long' and ${table.stopLoss} < ${table.entryPrice}) or (${table.direction} = 'Short' and ${table.stopLoss} > ${table.entryPrice})`),
  check("trades_directional_target_check", sql`${table.plannedTarget} is null or (${table.direction} = 'Long' and ${table.plannedTarget} > ${table.entryPrice}) or (${table.direction} = 'Short' and ${table.plannedTarget} < ${table.entryPrice})`),
]);

export const tradesRelations = relations(trades, ({ one }) => ({
  tenant: one(tenants, { fields: [trades.tenantId], references: [tenants.id] }),
  account: one(tradingAccounts, { fields: [trades.accountId], references: [tradingAccounts.id] }),
  creator: one(users, { fields: [trades.createdByUserId], references: [users.id] }),
  instrument: one(instruments, { fields: [trades.tenantId, trades.instrumentId], references: [instruments.tenantId, instruments.id] }),
  strategy: one(strategies, { fields: [trades.tenantId, trades.strategyId], references: [strategies.tenantId, strategies.id] }),
  playbook: one(playbooks, { fields: [trades.tenantId, trades.playbookId], references: [playbooks.tenantId, playbooks.id] }),
  closeReason: one(closeReasons, { fields: [trades.tenantId, trades.closeReasonId], references: [closeReasons.tenantId, closeReasons.id] }),
}));

/** Allowed attachment content types and the per-file size cap (kept in sync with DB checks). */
export const ATTACHMENT_CONTENT_TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"] as const;
export const ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;

export const tradeAttachments = pgTable("trade_attachments", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  accountId: uuid("account_id").notNull(),
  tradeId: uuid("trade_id").notNull(),
  createdByUserId: uuid("created_by_user_id").notNull(),
  storageKey: text("storage_key").notNull(),
  originalName: text("original_name").notNull(),
  contentType: text("content_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  caption: text("caption"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({
    name: "trade_attachments_tenant_account_fk",
    columns: [table.tenantId, table.accountId],
    foreignColumns: [tradingAccounts.tenantId, tradingAccounts.id],
  }).onDelete("cascade"),
  foreignKey({
    name: "trade_attachments_tenant_trade_fk",
    columns: [table.tenantId, table.tradeId],
    foreignColumns: [trades.tenantId, trades.id],
  }).onDelete("cascade"),
  foreignKey({
    name: "trade_attachments_creator_membership_fk",
    columns: [table.tenantId, table.createdByUserId],
    foreignColumns: [tenantMemberships.tenantId, tenantMemberships.userId],
  }),
  uniqueIndex("trade_attachments_storage_key_unique").on(table.storageKey),
  index("trade_attachments_tenant_trade_idx").on(table.tenantId, table.tradeId, table.createdAt),
  check("trade_attachments_size_check", sql`${table.sizeBytes} > 0 and ${table.sizeBytes} <= 5242880`),
  check("trade_attachments_content_type_check", sql`${table.contentType} in ('image/png', 'image/jpeg', 'image/webp', 'application/pdf')`),
]);

export const tradeAttachmentsRelations = relations(tradeAttachments, ({ one }) => ({
  tenant: one(tenants, { fields: [tradeAttachments.tenantId], references: [tenants.id] }),
  account: one(tradingAccounts, { fields: [tradeAttachments.accountId], references: [tradingAccounts.id] }),
  trade: one(trades, { fields: [tradeAttachments.tenantId, tradeAttachments.tradeId], references: [trades.tenantId, trades.id] }),
}));
