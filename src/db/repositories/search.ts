import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";

import type { Database } from "@/db/client";
import { instruments, notes, playbooks, strategies, trades } from "@/db/schema";
import type { TenantScope } from "@/db/repositories/workspaces";
import {
  rankVaultSearchCandidates,
  type VaultSearchCandidate,
  type VaultSearchItem,
} from "@/lib/domain/vault-search";

const CANDIDATE_LIMIT = 40;

function compact(parts: Array<string | null | undefined>) {
  return parts.filter((part): part is string => Boolean(part?.trim())).join(" · ");
}

function titleCase(value: string) {
  return value.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/**
 * Read-only search boundary. Trades/notes carry tenant + creator + account scope;
 * shared libraries carry tenant scope. The returned DTO deliberately excludes note
 * bodies, auth fields, attachment storage keys, and every other internal file path.
 */
export function createVaultSearchRepository(db: Database, scope: TenantScope) {
  return {
    search: async (accountId: string, query: string, limit = 15): Promise<VaultSearchItem[]> => {
      const cleanQuery = query.trim().slice(0, 100);
      // SQL narrows on the first real term; the pure oracle applies exact all-term matching.
      const firstTerm = cleanQuery.split(/\s+/).find(Boolean)?.replace(/[%_]/g, "") ?? "";
      const pattern = firstTerm ? `%${firstTerm}%` : null;

      const [tradeRows, instrumentRows, strategyRows, playbookRows, noteRows] = await Promise.all([
        db.select({
          id: trades.id, symbol: trades.symbol, assetClass: trades.assetClass, instrumentType: trades.instrumentType,
          subcategory: trades.subcategory, tradingStyle: trades.tradingStyle, platform: trades.platform,
          direction: trades.direction, status: trades.status, currency: trades.currency, realizedPnl: trades.realizedPnl,
          tags: trades.tags, linkedNote: trades.linkedNote, reviewNotes: trades.notes, entryAt: trades.entryAt, updatedAt: trades.updatedAt,
        }).from(trades).where(and(
          eq(trades.tenantId, scope.tenantId), eq(trades.createdByUserId, scope.userId), eq(trades.accountId, accountId),
          pattern ? or(
            ilike(trades.symbol, pattern), ilike(trades.subcategory, pattern), ilike(trades.tradingStyle, pattern),
            ilike(trades.platform, pattern), ilike(trades.linkedNote, pattern), ilike(trades.notes, pattern),
            sql`${trades.assetClass}::text ilike ${pattern}`, sql`${trades.instrumentType}::text ilike ${pattern}`,
            sql`${trades.direction}::text ilike ${pattern}`, sql`${trades.status}::text ilike ${pattern}`,
            sql`${trades.currency}::text ilike ${pattern}`, sql`array_to_string(${trades.tags}, ' ') ilike ${pattern}`,
          ) : undefined,
        )).orderBy(desc(trades.updatedAt)).limit(CANDIDATE_LIMIT),

        db.select().from(instruments).where(and(
          eq(instruments.tenantId, scope.tenantId), isNull(instruments.archivedAt),
          pattern ? or(
            ilike(instruments.symbol, pattern), ilike(instruments.name, pattern), ilike(instruments.subcategory, pattern),
            ilike(instruments.defaultTradingStyle, pattern), ilike(instruments.defaultPlatform, pattern),
            sql`${instruments.assetClass}::text ilike ${pattern}`, sql`${instruments.instrumentType}::text ilike ${pattern}`,
            sql`${instruments.defaultCurrency}::text ilike ${pattern}`,
          ) : undefined,
        )).orderBy(desc(instruments.updatedAt)).limit(CANDIDATE_LIMIT),

        db.select().from(strategies).where(and(
          eq(strategies.tenantId, scope.tenantId), isNull(strategies.archivedAt),
          pattern ? or(ilike(strategies.name, pattern), ilike(strategies.description, pattern)) : undefined,
        )).orderBy(desc(strategies.updatedAt)).limit(CANDIDATE_LIMIT),

        db.select().from(playbooks).where(and(
          eq(playbooks.tenantId, scope.tenantId), isNull(playbooks.archivedAt),
          pattern ? or(
            ilike(playbooks.name, pattern), ilike(playbooks.marketScope, pattern), ilike(playbooks.notes, pattern),
            sql`${playbooks.setupRules}::text ilike ${pattern}`,
          ) : undefined,
        )).orderBy(desc(playbooks.updatedAt)).limit(CANDIDATE_LIMIT),

        db.select().from(notes).where(and(
          eq(notes.tenantId, scope.tenantId), eq(notes.createdByUserId, scope.userId), eq(notes.accountId, accountId), isNull(notes.archivedAt),
          pattern ? or(
            ilike(notes.title, pattern), ilike(notes.bodyText, pattern),
            sql`${notes.noteType}::text ilike ${pattern}`, sql`${notes.collection}::text ilike ${pattern}`,
          ) : undefined,
        )).orderBy(desc(notes.updatedAt)).limit(CANDIDATE_LIMIT),
      ]);

      const candidates: VaultSearchCandidate[] = [
        ...tradeRows.map((row): VaultSearchCandidate => ({
          id: row.id,
          kind: "trade",
          title: row.symbol,
          meta: compact([row.direction, titleCase(row.status), row.assetClass]),
          href: `/trades/${row.id}`,
          currency: row.currency,
          amount: row.realizedPnl == null ? null : Number(row.realizedPnl),
          direction: row.direction,
          status: row.status,
          searchText: compact([
            row.symbol, row.assetClass, row.instrumentType, row.subcategory, row.tradingStyle, row.platform,
            row.direction, row.status, row.currency, row.tags.join(" "), row.linkedNote, row.reviewNotes,
          ]),
          sortAtIso: row.updatedAt.toISOString(),
        })),
        ...instrumentRows.map((row): VaultSearchCandidate => ({
          id: row.id,
          kind: "instrument",
          title: row.symbol,
          meta: compact([row.name, row.assetClass, row.instrumentType, row.defaultCurrency]),
          href: `/trades?symbol=${encodeURIComponent(row.symbol)}`,
          currency: row.defaultCurrency,
          searchText: compact([
            row.symbol, row.name, row.assetClass, row.instrumentType, row.subcategory,
            row.defaultTradingStyle, row.defaultPlatform, row.defaultCurrency,
          ]),
          sortAtIso: row.updatedAt.toISOString(),
        })),
        ...strategyRows.map((row): VaultSearchCandidate => ({
          id: row.id,
          kind: "strategy",
          title: row.name,
          meta: compact(["Strategy", row.description]),
          href: `/trades?strategyId=${row.id}`,
          searchText: compact([row.name, row.description]),
          sortAtIso: row.updatedAt.toISOString(),
        })),
        ...playbookRows.map((row): VaultSearchCandidate => ({
          id: row.id,
          kind: "playbook",
          title: row.name,
          meta: compact([row.marketScope, `${row.setupRules.length} setup ${row.setupRules.length === 1 ? "rule" : "rules"}`]),
          href: `/trades?playbookId=${row.id}`,
          searchText: compact([row.name, row.marketScope, row.setupRules.join(" "), row.notes]),
          sortAtIso: row.updatedAt.toISOString(),
        })),
        ...noteRows.map((row): VaultSearchCandidate => ({
          id: row.id,
          kind: "note",
          title: row.title,
          meta: compact([titleCase(row.noteType), row.collection === "none" ? null : titleCase(row.collection), row.pinned ? "Pinned" : null, row.isTemplate ? "Template" : null]),
          href: `/notes/${row.id}`,
          searchText: compact([row.title, row.bodyText, row.noteType, row.collection, row.pinned ? "pinned" : null, row.isTemplate ? "template" : null]),
          sortAtIso: row.updatedAt.toISOString(),
        })),
      ];

      return rankVaultSearchCandidates(candidates, cleanQuery, limit);
    },
  };
}
