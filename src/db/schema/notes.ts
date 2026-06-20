import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { NOTE_COLLECTIONS, NOTE_TYPES, type RichTextDoc } from "@/lib/domain/notes";

import { tenantMemberships, tenants, tradingAccounts, users } from "./foundations";
import { playbooks, trades } from "./trades";

export type { NoteCollection, NoteType, RichTextDoc } from "@/lib/domain/notes";

// Note "type" doubles as the S9 left-nav Folders axis; collections are the orthogonal axis.
// Canonical value order lives in `@/lib/domain/notes` (the pure oracle) to avoid drift.
export const noteType = pgEnum("note_type", NOTE_TYPES);
export const noteCollection = pgEnum("note_collection", NOTE_COLLECTIONS);

/**
 * Tenant/account/creator-scoped journal note. `bodyText` is the always-present plain
 * projection used for search + excerpts (and the entire content for fast plain notes);
 * `bodyJson` holds the optional rich TipTap document. Existing review/exit/playbook
 * notes are NOT copied here — they are surfaced linked-to-source by the feed builder.
 */
export const notes = pgTable("notes", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  accountId: uuid("account_id").notNull(),
  createdByUserId: uuid("created_by_user_id").notNull(),

  title: text("title").notNull(),
  bodyText: text("body_text").notNull().default(""),
  bodyJson: jsonb("body_json").$type<RichTextDoc>(),

  noteType: noteType("note_type").notNull().default("general"),
  collection: noteCollection("collection").notNull().default("none"),
  isTemplate: boolean("is_template").notNull().default(false),
  pinned: boolean("pinned").notNull().default(false),

  linkedTradeId: uuid("linked_trade_id"),
  linkedPlaybookId: uuid("linked_playbook_id"),

  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({
    name: "notes_tenant_account_fk",
    columns: [table.tenantId, table.accountId],
    foreignColumns: [tradingAccounts.tenantId, tradingAccounts.id],
  }).onDelete("cascade"),
  foreignKey({
    name: "notes_creator_membership_fk",
    columns: [table.tenantId, table.createdByUserId],
    foreignColumns: [tenantMemberships.tenantId, tenantMemberships.userId],
  }),
  foreignKey({
    name: "notes_tenant_trade_fk",
    columns: [table.tenantId, table.linkedTradeId],
    foreignColumns: [trades.tenantId, trades.id],
  }).onDelete("set null"),
  foreignKey({
    name: "notes_tenant_playbook_fk",
    columns: [table.tenantId, table.linkedPlaybookId],
    foreignColumns: [playbooks.tenantId, playbooks.id],
  }).onDelete("set null"),
  unique("notes_tenant_id_unique").on(table.tenantId, table.id),
  index("notes_tenant_account_updated_idx").on(table.tenantId, table.accountId, table.updatedAt),
  index("notes_tenant_trade_idx").on(table.tenantId, table.linkedTradeId),
  check("notes_title_not_blank_check", sql`length(trim(${table.title})) > 0`),
]);

export const notesRelations = relations(notes, ({ one }) => ({
  tenant: one(tenants, { fields: [notes.tenantId], references: [tenants.id] }),
  account: one(tradingAccounts, { fields: [notes.accountId], references: [tradingAccounts.id] }),
  creator: one(users, { fields: [notes.createdByUserId], references: [users.id] }),
  trade: one(trades, { fields: [notes.tenantId, notes.linkedTradeId], references: [trades.tenantId, trades.id] }),
  playbook: one(playbooks, { fields: [notes.tenantId, notes.linkedPlaybookId], references: [playbooks.tenantId, playbooks.id] }),
}));
