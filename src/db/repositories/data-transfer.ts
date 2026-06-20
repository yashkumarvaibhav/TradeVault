import { and, asc, eq, isNull } from "drizzle-orm";

import type { Database } from "@/db/client";
import {
  closeReasons,
  instruments,
  notes,
  playbooks,
  strategies,
  tradeAttachments,
  trades,
  tradingAccounts,
} from "@/db/schema";
import type { TenantScope } from "@/db/repositories/workspaces";
import {
  parseTradeVaultImport,
  TRADEVAULT_EXPORT_FORMAT,
  tradeImportSignature,
  type NormalizedImportNote,
} from "@/lib/domain/data-transfer";
import { evaluateTradeEntry } from "@/lib/domain/trade-entry";

const clean = (value: string | null | undefined) => value?.trim() || null;
const numeric = (value: number | null | undefined) => value == null ? null : String(value);
const key = (value: string) => value.trim().toLocaleLowerCase();

export interface DataImportSummary {
  trades: { imported: number; skipped: number };
  instruments: { imported: number; updated: number };
  strategies: { imported: number; existing: number };
  closeReasons: { imported: number; existing: number };
  playbooks: { imported: number; existing: number };
  notes: { imported: number; skipped: number };
}

/** Tenant-safe JSON export/import boundary. No auth identity, DB IDs, or attachment paths leave it. */
export function createDataTransferRepository(db: Database, scope: TenantScope) {
  const ownAccount = (accountId: string) => and(
    eq(tradingAccounts.id, accountId),
    eq(tradingAccounts.tenantId, scope.tenantId),
    eq(tradingAccounts.ownerUserId, scope.userId),
  );

  async function requireAccount(accountId: string) {
    const [account] = await db.select({ name: tradingAccounts.name, defaultCurrency: tradingAccounts.defaultCurrency })
      .from(tradingAccounts).where(ownAccount(accountId)).limit(1);
    if (!account) throw new Error("Trading account is not available in this workspace.");
    return account;
  }

  return {
    exportAccount: async (accountId: string, exportedAt = new Date()) => {
      const account = await requireAccount(accountId);
      const [tradeRows, instrumentRows, strategyRows, reasonRows, playbookRows, attachmentRows, noteRows] = await Promise.all([
        db.select({
          trade: trades,
          strategyName: strategies.name,
          playbookName: playbooks.name,
          closeReasonName: closeReasons.name,
        }).from(trades)
          .leftJoin(strategies, and(eq(strategies.tenantId, trades.tenantId), eq(strategies.id, trades.strategyId)))
          .leftJoin(playbooks, and(eq(playbooks.tenantId, trades.tenantId), eq(playbooks.id, trades.playbookId)))
          .leftJoin(closeReasons, and(eq(closeReasons.tenantId, trades.tenantId), eq(closeReasons.id, trades.closeReasonId)))
          .where(and(eq(trades.tenantId, scope.tenantId), eq(trades.createdByUserId, scope.userId), eq(trades.accountId, accountId)))
          .orderBy(asc(trades.entryAt), asc(trades.createdAt)),
        db.select().from(instruments).where(and(eq(instruments.tenantId, scope.tenantId), isNull(instruments.archivedAt))).orderBy(asc(instruments.symbol)),
        db.select().from(strategies).where(and(eq(strategies.tenantId, scope.tenantId), isNull(strategies.archivedAt))).orderBy(asc(strategies.name)),
        db.select().from(closeReasons).where(and(eq(closeReasons.tenantId, scope.tenantId), isNull(closeReasons.archivedAt))).orderBy(asc(closeReasons.name)),
        db.select().from(playbooks).where(and(eq(playbooks.tenantId, scope.tenantId), isNull(playbooks.archivedAt))).orderBy(asc(playbooks.name)),
        db.select({ tradeId: tradeAttachments.tradeId }).from(tradeAttachments).where(and(
          eq(tradeAttachments.tenantId, scope.tenantId), eq(tradeAttachments.createdByUserId, scope.userId), eq(tradeAttachments.accountId, accountId),
        )),
        db.select().from(notes).where(and(
          eq(notes.tenantId, scope.tenantId), eq(notes.createdByUserId, scope.userId), eq(notes.accountId, accountId), isNull(notes.archivedAt),
        )).orderBy(asc(notes.createdAt)),
      ]);

      const attachmentCounts = new Map<string, number>();
      for (const row of attachmentRows) attachmentCounts.set(row.tradeId, (attachmentCounts.get(row.tradeId) ?? 0) + 1);
      const tradeRefs = new Map(tradeRows.map((row, index) => [row.trade.id, `trade-${index + 1}`]));
      const playbookNames = new Map(playbookRows.map((row) => [row.id, row.name]));

      return {
        format: TRADEVAULT_EXPORT_FORMAT,
        exported_at: exportedAt.toISOString(),
        account: { name: account.name, default_currency: account.defaultCurrency },
        attachments: {
          included: false,
          note: "Attachment files are stored separately and are not embedded in JSON exports.",
          count: attachmentRows.length,
        },
        trades: tradeRows.map(({ trade, strategyName, playbookName, closeReasonName }, index) => ({
          export_ref: `trade-${index + 1}`,
          asset_category: trade.assetClass,
          subcategory: trade.subcategory,
          trading_style: trade.tradingStyle,
          instrument: trade.symbol,
          direction: trade.direction,
          instrument_type: trade.instrumentType,
          lot_size: Number(trade.multiplier),
          platform: trade.platform,
          currency: trade.currency,
          entry_price: Number(trade.entryPrice),
          entry_datetime: trade.entryAt.toISOString(),
          stop_loss: trade.stopLoss == null ? null : Number(trade.stopLoss),
          planned_target: trade.plannedTarget == null ? null : Number(trade.plannedTarget),
          position_size: Number(trade.quantity),
          entry_notes: trade.linkedNote,
          exit_price: trade.exitPrice == null ? null : Number(trade.exitPrice),
          exit_datetime: trade.exitAt?.toISOString() ?? null,
          exit_notes: trade.notes,
          close_reason: closeReasonName,
          psychology: trade.emotion,
          psychology_detail: null,
          manual_pnl: trade.manualPnl == null ? null : Number(trade.manualPnl),
          execution_score: trade.confidence,
          rule_followed: trade.ruleViolations ? false : null,
          mistake_tags: trade.tags.join(", "),
          setup_quality: null,
          review_notes: trade.notes,
          reviewed_at: trade.reviewedAt?.toISOString() ?? null,
          strategy: strategyName,
          playbook_name: playbookName,
          status: trade.status,
          attachment_count: attachmentCounts.get(trade.id) ?? 0,
          fees: Number(trade.fees),
          fx_to_account: Number(trade.fxToAccount),
          rule_violations: trade.ruleViolations,
          tags: trade.tags,
          setup_checklist: trade.setupChecklist,
        })),
        instruments: instrumentRows.map((instrument) => ({
          name: instrument.symbol,
          display_name: instrument.name,
          asset_category: instrument.assetClass,
          subcategory: instrument.subcategory,
          trading_style: instrument.defaultTradingStyle,
          instrument_type: instrument.instrumentType,
          lot_size: instrument.defaultMultiplier == null ? null : Number(instrument.defaultMultiplier),
          quantity: instrument.defaultQuantity == null ? null : Number(instrument.defaultQuantity),
          platform: instrument.defaultPlatform,
          default_currency: instrument.defaultCurrency,
        })),
        close_reasons: reasonRows.map((reason) => ({ reason: reason.name })),
        strategies: strategyRows.map((strategy) => ({ name: strategy.name, description: strategy.description })),
        playbooks: playbookRows.map((playbook) => ({
          name: playbook.name,
          market_scope: playbook.marketScope,
          setup_rules: playbook.setupRules.join("\n"),
          checklist: "",
          notes: playbook.notes,
          active: 1,
        })),
        notes: noteRows.map((note, index) => ({
          export_ref: `note-${index + 1}`,
          title: note.title,
          body_text: note.bodyText,
          body_json: note.bodyJson,
          note_type: note.noteType,
          collection: note.collection,
          is_template: note.isTemplate,
          pinned: note.pinned,
          linked_trade_ref: note.linkedTradeId ? tradeRefs.get(note.linkedTradeId) ?? null : null,
          linked_playbook_name: note.linkedPlaybookId ? playbookNames.get(note.linkedPlaybookId) ?? null : null,
          updated_at: note.updatedAt.toISOString(),
        })),
      };
    },

    /** Fully parses first, then applies the valid payload atomically and idempotently. */
    importAccount: async (accountId: string, payload: unknown, timeZone: string): Promise<DataImportSummary> => {
      const parsed = parseTradeVaultImport(payload, timeZone);
      if (!parsed.ok) {
        const error = new Error("Import validation failed.");
        Object.assign(error, { importErrors: parsed.errors });
        throw error;
      }
      await requireAccount(accountId);

      return db.transaction(async (tx) => {
        const source = parsed.value;
        const referencedStrategies = source.trades.map((trade) => trade.strategyName).filter((name): name is string => Boolean(name));
        const referencedReasons = source.trades.map((trade) => trade.closeReasonName).filter((name): name is string => Boolean(name));
        const referencedPlaybooks = source.trades.map((trade) => trade.playbookName).filter((name): name is string => Boolean(name));
        const strategyInputs = [...new Map([...source.strategies, ...referencedStrategies.map((name) => ({ name, description: null }))].map((item) => [key(item.name), item])).values()];
        const reasonInputs = [...new Map([...source.closeReasons, ...referencedReasons.map((name) => ({ name, description: null }))].map((item) => [key(item.name), item])).values()];
        const playbookInputs = [...new Map([...source.playbooks, ...referencedPlaybooks.map((name) => ({ name, marketScope: null, setupRules: [], notes: null }))].map((item) => [key(item.name), item])).values()];

        const [beforeStrategies, beforeReasons, beforePlaybooks] = await Promise.all([
          tx.select({ name: strategies.name }).from(strategies).where(eq(strategies.tenantId, scope.tenantId)),
          tx.select({ name: closeReasons.name }).from(closeReasons).where(eq(closeReasons.tenantId, scope.tenantId)),
          tx.select({ name: playbooks.name }).from(playbooks).where(eq(playbooks.tenantId, scope.tenantId)),
        ]);
        const existingStrategyKeys = new Set(beforeStrategies.map((item) => key(item.name)));
        const existingReasonKeys = new Set(beforeReasons.map((item) => key(item.name)));
        const existingPlaybookKeys = new Set(beforePlaybooks.map((item) => key(item.name)));

        if (strategyInputs.length) await tx.insert(strategies).values(strategyInputs.map((item) => ({ tenantId: scope.tenantId, name: item.name, description: item.description ?? null })))
          .onConflictDoUpdate({ target: [strategies.tenantId, strategies.name], set: { archivedAt: null, updatedAt: new Date() } });
        if (reasonInputs.length) await tx.insert(closeReasons).values(reasonInputs.map((item) => ({ tenantId: scope.tenantId, name: item.name })))
          .onConflictDoNothing({ target: [closeReasons.tenantId, closeReasons.name] });
        if (playbookInputs.length) {
          for (const item of playbookInputs) {
            await tx.insert(playbooks).values({ tenantId: scope.tenantId, name: item.name, marketScope: item.marketScope, setupRules: item.setupRules, notes: item.notes })
              .onConflictDoUpdate({ target: [playbooks.tenantId, playbooks.name], set: { archivedAt: null, updatedAt: new Date() } });
          }
        }

        let instrumentImported = 0;
        let instrumentUpdated = 0;
        const existingInstruments = await tx.select({ symbol: instruments.symbol, instrumentType: instruments.instrumentType })
          .from(instruments).where(eq(instruments.tenantId, scope.tenantId));
        const existingInstrumentKeys = new Set(existingInstruments.map((item) => `${item.symbol}|${item.instrumentType}`));
        for (const item of source.instruments) {
          const instrumentKey = `${item.symbol}|${item.instrumentType}`;
          if (existingInstrumentKeys.has(instrumentKey)) instrumentUpdated += 1;
          else instrumentImported += 1;
          existingInstrumentKeys.add(instrumentKey);
          await tx.insert(instruments).values({
            tenantId: scope.tenantId, symbol: item.symbol, name: item.name, assetClass: item.assetClass, instrumentType: item.instrumentType,
            subcategory: item.subcategory, defaultTradingStyle: item.tradingStyle, defaultQuantity: numeric(item.quantity),
            defaultMultiplier: numeric(item.multiplier), defaultPlatform: item.platform, defaultCurrency: item.currency,
          }).onConflictDoUpdate({
            target: [instruments.tenantId, instruments.symbol, instruments.instrumentType],
            set: { name: item.name, assetClass: item.assetClass, subcategory: item.subcategory, defaultTradingStyle: item.tradingStyle,
              defaultQuantity: numeric(item.quantity), defaultMultiplier: numeric(item.multiplier), defaultPlatform: item.platform,
              defaultCurrency: item.currency, archivedAt: null, updatedAt: new Date() },
          });
        }

        const [strategyRows, reasonRows, playbookRows] = await Promise.all([
          tx.select({ id: strategies.id, name: strategies.name }).from(strategies).where(eq(strategies.tenantId, scope.tenantId)),
          tx.select({ id: closeReasons.id, name: closeReasons.name }).from(closeReasons).where(eq(closeReasons.tenantId, scope.tenantId)),
          tx.select({ id: playbooks.id, name: playbooks.name }).from(playbooks).where(eq(playbooks.tenantId, scope.tenantId)),
        ]);
        const strategyIds = new Map(strategyRows.map((item) => [key(item.name), item.id]));
        const reasonIds = new Map(reasonRows.map((item) => [key(item.name), item.id]));
        const playbookIds = new Map(playbookRows.map((item) => [key(item.name), item.id]));

        const existingTrades = await tx.select().from(trades).where(and(
          eq(trades.tenantId, scope.tenantId), eq(trades.createdByUserId, scope.userId), eq(trades.accountId, accountId),
        ));
        const existingTradeIds = new Map(existingTrades.map((trade) => [tradeImportSignature({
          symbol: trade.symbol, entryAt: trade.entryAt.toISOString(), direction: trade.direction, entryPrice: Number(trade.entryPrice),
          quantity: Number(trade.quantity), multiplier: Number(trade.multiplier), currency: trade.currency,
        }), trade.id]));
        const tradeRefIds = new Map<string, string>();
        let importedTrades = 0;
        let skippedTrades = 0;

        for (const trade of source.trades) {
          const signature = tradeImportSignature(trade);
          const duplicateId = existingTradeIds.get(signature);
          if (duplicateId) {
            skippedTrades += 1;
            if (trade.exportRef) tradeRefIds.set(trade.exportRef, duplicateId);
            continue;
          }
          const evaluation = evaluateTradeEntry(trade);
          const [instrument] = await tx.insert(instruments).values({
            tenantId: scope.tenantId, symbol: trade.symbol, assetClass: trade.assetClass, instrumentType: trade.instrumentType,
            subcategory: trade.subcategory, defaultTradingStyle: trade.tradingStyle, defaultQuantity: numeric(trade.quantity),
            defaultMultiplier: numeric(trade.multiplier), defaultPlatform: trade.platform, defaultCurrency: trade.currency,
          }).onConflictDoUpdate({
            target: [instruments.tenantId, instruments.symbol, instruments.instrumentType],
            set: { assetClass: trade.assetClass, subcategory: trade.subcategory, defaultTradingStyle: trade.tradingStyle,
              defaultQuantity: numeric(trade.quantity), defaultMultiplier: numeric(trade.multiplier), defaultPlatform: trade.platform,
              defaultCurrency: trade.currency, archivedAt: null, updatedAt: new Date() },
          }).returning({ id: instruments.id });
          const [created] = await tx.insert(trades).values({
            tenantId: scope.tenantId, accountId, createdByUserId: scope.userId, instrumentId: instrument.id,
            strategyId: trade.strategyName ? strategyIds.get(key(trade.strategyName)) ?? null : null,
            playbookId: trade.playbookName ? playbookIds.get(key(trade.playbookName)) ?? null : null,
            closeReasonId: trade.status === "closed" && trade.closeReasonName ? reasonIds.get(key(trade.closeReasonName)) ?? null : null,
            symbol: trade.symbol, assetClass: trade.assetClass, instrumentType: trade.instrumentType, subcategory: trade.subcategory,
            tradingStyle: trade.tradingStyle, platform: trade.platform, direction: trade.direction, status: trade.status, currency: trade.currency,
            entryAt: new Date(trade.entryAt), entryPrice: numeric(trade.entryPrice)!, exitAt: trade.exitAt ? new Date(trade.exitAt) : null,
            exitPrice: numeric(trade.exitPrice), quantity: numeric(trade.quantity)!, multiplier: numeric(trade.multiplier)!, stopLoss: numeric(trade.stopLoss),
            plannedTarget: numeric(trade.plannedTarget), manualPnl: numeric(trade.manualPnl), fees: numeric(trade.fees)!, fxToAccount: numeric(trade.fxToAccount)!,
            plannedRisk: numeric(evaluation.preview.plannedRisk), plannedRewardRisk: numeric(evaluation.preview.plannedRewardRisk),
            realizedPnl: numeric(evaluation.preview.realizedPnl), realizedR: numeric(evaluation.preview.realizedR), confidence: trade.confidence,
            emotion: clean(trade.emotion), setupChecklist: trade.setupChecklist, tags: trade.tags, ruleViolations: clean(trade.ruleViolations),
            linkedNote: clean(trade.linkedNote), notes: clean(trade.notes),
          }).returning({ id: trades.id });
          importedTrades += 1;
          existingTradeIds.set(signature, created.id);
          if (trade.exportRef) tradeRefIds.set(trade.exportRef, created.id);
        }

        const existingNotes = await tx.select().from(notes).where(and(
          eq(notes.tenantId, scope.tenantId), eq(notes.createdByUserId, scope.userId), eq(notes.accountId, accountId),
        ));
        const noteKey = (note: Pick<NormalizedImportNote, "title" | "bodyText" | "noteType" | "collection">, tradeId: string | null, playbookId: string | null) =>
          [key(note.title), note.bodyText.trim(), note.noteType, note.collection, tradeId ?? "", playbookId ?? ""].join("|");
        const existingNoteKeys = new Set(existingNotes.map((note) => noteKey(note, note.linkedTradeId, note.linkedPlaybookId)));
        let importedNotes = 0;
        let skippedNotes = 0;
        for (const note of source.notes) {
          const linkedTradeId = note.linkedTradeRef ? tradeRefIds.get(note.linkedTradeRef) ?? null : null;
          const linkedPlaybookId = note.linkedPlaybookName ? playbookIds.get(key(note.linkedPlaybookName)) ?? null : null;
          const signature = noteKey(note, linkedTradeId, linkedPlaybookId);
          if (existingNoteKeys.has(signature)) {
            skippedNotes += 1;
            continue;
          }
          await tx.insert(notes).values({
            tenantId: scope.tenantId, accountId, createdByUserId: scope.userId, title: note.title, bodyText: note.bodyText,
            bodyJson: note.bodyJson, noteType: note.noteType, collection: note.collection, isTemplate: note.isTemplate,
            pinned: note.pinned, linkedTradeId, linkedPlaybookId, updatedAt: note.updatedAt ? new Date(note.updatedAt) : new Date(),
          });
          existingNoteKeys.add(signature);
          importedNotes += 1;
        }

        return {
          trades: { imported: importedTrades, skipped: skippedTrades },
          instruments: { imported: instrumentImported, updated: instrumentUpdated },
          strategies: { imported: strategyInputs.filter((item) => !existingStrategyKeys.has(key(item.name))).length, existing: strategyInputs.filter((item) => existingStrategyKeys.has(key(item.name))).length },
          closeReasons: { imported: reasonInputs.filter((item) => !existingReasonKeys.has(key(item.name))).length, existing: reasonInputs.filter((item) => existingReasonKeys.has(key(item.name))).length },
          playbooks: { imported: playbookInputs.filter((item) => !existingPlaybookKeys.has(key(item.name))).length, existing: playbookInputs.filter((item) => existingPlaybookKeys.has(key(item.name))).length },
          notes: { imported: importedNotes, skipped: skippedNotes },
        };
      });
    },
  };
}
