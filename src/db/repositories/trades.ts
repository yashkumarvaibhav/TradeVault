import { and, asc, count, desc, eq, gte, ilike, inArray, isNotNull, lt, or, type SQL } from "drizzle-orm";
import { addDateKeyDays, startOfDateInTimeZone } from "@/lib/date-time";

import type { Database } from "@/db/client";
import { closeReasons, instruments, playbooks, strategies, trades, tradingAccounts, type SetupChecklistItem } from "@/db/schema";
import type { TenantScope } from "@/db/repositories/workspaces";
import { evaluateTradeEntry, type TradeEntryDraft } from "@/lib/domain/trade-entry";

export interface CreateTradeInput extends TradeEntryDraft {
  accountId: string;
  strategyId?: string | null;
  playbookId?: string | null;
  closeReasonId?: string | null;
  subcategory?: string | null;
  tradingStyle?: string | null;
  platform?: string | null;
  confidence?: number | null;
  emotion?: string | null;
  tags?: string[];
  ruleViolations?: string | null;
  linkedNote?: string | null;
  notes?: string | null;
  setupChecklist?: SetupChecklistItem[];
}

export interface TradeQueryOptions {
  accountId: string;
  page?: number;
  pageSize?: number;
  search?: string;
  assetClass?: string;
  status?: string;
  result?: "win" | "loss" | "breakeven";
  direction?: string;
  currency?: string;
  instrumentType?: string;
  symbol?: string;
  subcategory?: string;
  tradingStyle?: string;
  platform?: string;
  emotion?: string;
  strategyId?: string;
  playbookId?: string;
  closeReasonId?: string;
  dateFrom?: string;
  dateTo?: string;
  timeZone?: string;
  sort?: "entry-desc" | "entry-asc" | "pnl-desc" | "pnl-asc" | "symbol-asc" | "r-desc";
}

function numeric(value: number | null | undefined) {
  return value == null ? null : String(value);
}

function cleanOptional(value?: string | null) {
  const cleaned = value?.trim();
  return cleaned || null;
}

/**
 * Tenant-branded trade boundary. Every query carries tenant + owner scope, and
 * creation re-checks account ownership before the database composite FKs run.
 */
export function createTradeRepository(db: Database, scope: TenantScope) {
  const ownedAccount = (accountId: string) => and(
    eq(tradingAccounts.id, accountId),
    eq(tradingAccounts.tenantId, scope.tenantId),
    eq(tradingAccounts.ownerUserId, scope.userId),
  );

  const queryConditions = (options: TradeQueryOptions) => {
    const conditions: SQL[] = [
      eq(trades.tenantId, scope.tenantId),
      eq(trades.createdByUserId, scope.userId),
      eq(trades.accountId, options.accountId),
    ];
    const search = options.search?.trim();
    if (search) {
      const pattern = `%${search}%`;
      conditions.push(or(
        ilike(trades.symbol, pattern), ilike(trades.subcategory, pattern), ilike(trades.tradingStyle, pattern),
        ilike(trades.platform, pattern), ilike(trades.emotion, pattern),
      )!);
    }
    if (options.assetClass) conditions.push(eq(trades.assetClass, options.assetClass as typeof trades.assetClass.enumValues[number]));
    if (options.status) conditions.push(eq(trades.status, options.status as typeof trades.status.enumValues[number]));
    if (options.direction) conditions.push(eq(trades.direction, options.direction as typeof trades.direction.enumValues[number]));
    if (options.currency) conditions.push(eq(trades.currency, options.currency as typeof trades.currency.enumValues[number]));
    if (options.instrumentType) conditions.push(eq(trades.instrumentType, options.instrumentType as typeof trades.instrumentType.enumValues[number]));
    if (options.symbol) conditions.push(eq(trades.symbol, options.symbol));
    if (options.subcategory) conditions.push(eq(trades.subcategory, options.subcategory));
    if (options.tradingStyle) conditions.push(eq(trades.tradingStyle, options.tradingStyle));
    if (options.platform) conditions.push(eq(trades.platform, options.platform));
    if (options.emotion) conditions.push(eq(trades.emotion, options.emotion));
    if (options.strategyId) conditions.push(eq(trades.strategyId, options.strategyId));
    if (options.playbookId) conditions.push(eq(trades.playbookId, options.playbookId));
    if (options.closeReasonId) conditions.push(eq(trades.closeReasonId, options.closeReasonId));
    if (options.dateFrom) conditions.push(gte(trades.entryAt, startOfDateInTimeZone(options.dateFrom, options.timeZone ?? "UTC")));
    if (options.dateTo) conditions.push(lt(trades.entryAt, startOfDateInTimeZone(addDateKeyDays(options.dateTo, 1), options.timeZone ?? "UTC")));
    if (options.result === "win") conditions.push(and(isNotNull(trades.realizedPnl), gte(trades.realizedPnl, "0.000001"))!);
    if (options.result === "loss") conditions.push(and(isNotNull(trades.realizedPnl), lt(trades.realizedPnl, "0"))!);
    if (options.result === "breakeven") conditions.push(eq(trades.realizedPnl, "0"));
    return and(...conditions)!;
  };

  return {
    list: (options: { accountId?: string; limit?: number } = {}) => {
      const conditions = [eq(trades.tenantId, scope.tenantId), eq(trades.createdByUserId, scope.userId)];
      if (options.accountId) conditions.push(eq(trades.accountId, options.accountId));
      return db
        .select()
        .from(trades)
        .where(and(...conditions))
        .orderBy(desc(trades.entryAt), desc(trades.createdAt))
        .limit(Math.min(Math.max(options.limit ?? 50, 1), 100));
    },

    listAll: (accountId: string) => db.select().from(trades)
      .where(and(eq(trades.tenantId, scope.tenantId), eq(trades.createdByUserId, scope.userId), eq(trades.accountId, accountId)))
      .orderBy(asc(trades.entryAt), asc(trades.createdAt)),

    getById: async (accountId: string, tradeId: string) => {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tradeId)) return null;
      const [trade] = await db.select().from(trades).where(and(
        eq(trades.id, tradeId), eq(trades.tenantId, scope.tenantId), eq(trades.createdByUserId, scope.userId), eq(trades.accountId, accountId),
      )).limit(1);
      return trade ?? null;
    },

    filterOptions: async (accountId: string) => {
      const rows = await db.select({ symbol: trades.symbol, subcategory: trades.subcategory, tradingStyle: trades.tradingStyle, platform: trades.platform, emotion: trades.emotion })
        .from(trades).where(and(eq(trades.tenantId, scope.tenantId), eq(trades.createdByUserId, scope.userId), eq(trades.accountId, accountId)));
      const unique = (values: Array<string | null>) => [...new Set(values.filter((value): value is string => Boolean(value)))].sort();
      return { symbols: unique(rows.map((row) => row.symbol)), subcategories: unique(rows.map((row) => row.subcategory)), tradingStyles: unique(rows.map((row) => row.tradingStyle)), platforms: unique(rows.map((row) => row.platform)), emotions: unique(rows.map((row) => row.emotion)) };
    },

    queryPage: async (options: TradeQueryOptions) => {
      const pageSize = [25, 50, 100].includes(options.pageSize ?? 25) ? options.pageSize ?? 25 : 25;
      const where = queryConditions(options);
      const [{ total }] = await db.select({ total: count() }).from(trades).where(where);
      const pageCount = Math.max(1, Math.ceil(total / pageSize));
      const page = Math.min(Math.max(options.page ?? 1, 1), pageCount);
      const order = options.sort === "entry-asc" ? [asc(trades.entryAt), asc(trades.createdAt)]
        : options.sort === "pnl-desc" ? [desc(trades.realizedPnl), desc(trades.entryAt)]
        : options.sort === "pnl-asc" ? [asc(trades.realizedPnl), desc(trades.entryAt)]
        : options.sort === "symbol-asc" ? [asc(trades.symbol), desc(trades.entryAt)]
        : options.sort === "r-desc" ? [desc(trades.realizedR), desc(trades.entryAt)]
        : [desc(trades.entryAt), desc(trades.createdAt)];
      const [rows, summaryRows] = await Promise.all([
        db.select().from(trades).where(where).orderBy(...order).limit(pageSize).offset((page - 1) * pageSize),
        db.select({ currency: trades.currency, realizedPnl: trades.realizedPnl, realizedR: trades.realizedR, status: trades.status }).from(trades).where(where),
      ]);
      return { rows, summaryRows, total, page, pageSize, pageCount };
    },

    bulkSetReviewed: async (input: { accountId: string; tradeIds: string[]; reviewed: boolean }) => {
      const tradeIds = [...new Set(input.tradeIds)].filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)).slice(0, 100);
      if (!tradeIds.length) return 0;
      const changed = await db.update(trades).set({ reviewedAt: input.reviewed ? new Date() : null, updatedAt: new Date() }).where(and(
        eq(trades.tenantId, scope.tenantId),
        eq(trades.createdByUserId, scope.userId),
        eq(trades.accountId, input.accountId),
        inArray(trades.id, tradeIds),
      )).returning({ id: trades.id });
      return changed.length;
    },

    saveReview: async (input: { accountId: string; tradeId: string; confidence: number | null; emotion: string | null; ruleViolations: string | null; notes: string | null; completedChecklistIds: string[]; mfePrice?: number | null; maePrice?: number | null }) => {
      const existing = await db.select().from(trades).where(and(
        eq(trades.id, input.tradeId), eq(trades.tenantId, scope.tenantId), eq(trades.createdByUserId, scope.userId), eq(trades.accountId, input.accountId),
      )).limit(1);
      if (!existing[0]) return null;
      const row = existing[0];
      const evaluated = evaluateTradeEntry({
        symbol: row.symbol, assetClass: row.assetClass, instrumentType: row.instrumentType,
        direction: row.direction, status: row.status, currency: row.currency,
        entryAt: row.entryAt.toISOString(), entryPrice: Number(row.entryPrice),
        exitAt: row.exitAt?.toISOString() ?? null, exitPrice: row.exitPrice == null ? null : Number(row.exitPrice),
        quantity: Number(row.quantity), multiplier: Number(row.multiplier),
        stopLoss: row.stopLoss == null ? null : Number(row.stopLoss), plannedTarget: row.plannedTarget == null ? null : Number(row.plannedTarget),
        manualPnl: row.manualPnl == null ? null : Number(row.manualPnl), fees: Number(row.fees), fxToAccount: Number(row.fxToAccount),
        mfePrice: input.mfePrice, maePrice: input.maePrice,
      });
      if (Object.keys(evaluated.errors).length > 0) {
        const error = new Error("Review validation failed.");
        Object.assign(error, { fieldErrors: evaluated.errors });
        throw error;
      }
      const completed = new Set(input.completedChecklistIds);
      const [reviewed] = await db.update(trades).set({
        confidence: input.confidence && input.confidence >= 1 && input.confidence <= 5 ? input.confidence : null,
        emotion: cleanOptional(input.emotion),
        ruleViolations: cleanOptional(input.ruleViolations),
        notes: cleanOptional(input.notes),
        setupChecklist: row.setupChecklist.map((item) => ({ ...item, completed: completed.has(item.id) })),
        mfePrice: numeric(input.mfePrice),
        maePrice: numeric(input.maePrice),
        mfeAmount: numeric(evaluated.preview.mfeAmount),
        maeAmount: numeric(evaluated.preview.maeAmount),
        mfeR: numeric(evaluated.preview.mfeR),
        maeR: numeric(evaluated.preview.maeR),
        capturedMovePct: numeric(evaluated.preview.capturedMovePct),
        reviewedAt: new Date(),
        updatedAt: new Date(),
      }).where(and(
        eq(trades.id, input.tradeId), eq(trades.tenantId, scope.tenantId), eq(trades.createdByUserId, scope.userId), eq(trades.accountId, input.accountId),
      )).returning();
      return reviewed ?? null;
    },

    /**
     * Close an open trade: recompute realized P&L / R through the same tested
     * domain oracle, never mixing currencies. Tenant + owner + account scoped.
     */
    closeTrade: async (input: {
      accountId: string;
      tradeId: string;
      exitAt: string;
      exitPrice: number | null;
      manualPnl: number | null;
      fees: number;
      closeReasonId: string | null;
      notes?: string | null;
      mfePrice?: number | null;
      maePrice?: number | null;
    }): Promise<{ status: "missing" } | { status: "already-closed" } | { status: "closed"; trade: typeof trades.$inferSelect }> => {
      const [existing] = await db.select().from(trades).where(and(
        eq(trades.id, input.tradeId), eq(trades.tenantId, scope.tenantId), eq(trades.createdByUserId, scope.userId), eq(trades.accountId, input.accountId),
      )).limit(1);
      if (!existing) return { status: "missing" };
      if (existing.status !== "open") return { status: "already-closed" };

      if (input.closeReasonId) {
        const [reason] = await db.select({ id: closeReasons.id }).from(closeReasons)
          .where(and(eq(closeReasons.id, input.closeReasonId), eq(closeReasons.tenantId, scope.tenantId))).limit(1);
        if (!reason) throw new Error("A selected close reason is not available in this workspace.");
      }

      const draft: TradeEntryDraft = {
        symbol: existing.symbol,
        assetClass: existing.assetClass,
        instrumentType: existing.instrumentType,
        direction: existing.direction,
        status: "closed",
        currency: existing.currency,
        entryAt: existing.entryAt.toISOString(),
        entryPrice: Number(existing.entryPrice),
        exitAt: input.exitAt,
        exitPrice: input.exitPrice,
        quantity: Number(existing.quantity),
        multiplier: Number(existing.multiplier),
        stopLoss: existing.stopLoss == null ? null : Number(existing.stopLoss),
        plannedTarget: existing.plannedTarget == null ? null : Number(existing.plannedTarget),
        manualPnl: input.manualPnl,
        fees: input.fees,
        fxToAccount: Number(existing.fxToAccount),
        mfePrice: input.mfePrice,
        maePrice: input.maePrice,
      };
      const evaluated = evaluateTradeEntry(draft);
      if (Object.keys(evaluated.errors).length > 0) {
        const error = new Error("Close validation failed.");
        Object.assign(error, { fieldErrors: evaluated.errors });
        throw error;
      }

      const [closed] = await db.update(trades).set({
        status: "closed",
        exitAt: new Date(input.exitAt),
        exitPrice: numeric(input.exitPrice),
        manualPnl: numeric(input.manualPnl),
        fees: numeric(input.fees)!,
        closeReasonId: input.closeReasonId || null,
        plannedRisk: numeric(evaluated.preview.plannedRisk),
        plannedRewardRisk: numeric(evaluated.preview.plannedRewardRisk),
        realizedPnl: numeric(evaluated.preview.realizedPnl),
        realizedR: numeric(evaluated.preview.realizedR),
        mfePrice: numeric(input.mfePrice),
        maePrice: numeric(input.maePrice),
        mfeAmount: numeric(evaluated.preview.mfeAmount),
        maeAmount: numeric(evaluated.preview.maeAmount),
        mfeR: numeric(evaluated.preview.mfeR),
        maeR: numeric(evaluated.preview.maeR),
        capturedMovePct: numeric(evaluated.preview.capturedMovePct),
        notes: input.notes === undefined ? existing.notes : cleanOptional(input.notes),
        updatedAt: new Date(),
      }).where(and(
        eq(trades.id, input.tradeId), eq(trades.tenantId, scope.tenantId), eq(trades.createdByUserId, scope.userId), eq(trades.accountId, input.accountId),
      )).returning();
      return { status: "closed", trade: closed };
    },

    create: async (input: CreateTradeInput) => {
      const evaluated = evaluateTradeEntry(input);
      if (Object.keys(evaluated.errors).length > 0) {
        const error = new Error("Trade entry validation failed.");
        Object.assign(error, { fieldErrors: evaluated.errors });
        throw error;
      }

      const symbol = input.symbol.trim().toUpperCase();
      const [account] = await db.select({ id: tradingAccounts.id }).from(tradingAccounts).where(ownedAccount(input.accountId)).limit(1);
      if (!account) throw new Error("Trading account is not available in this workspace.");

      return db.transaction(async (tx) => {
        const linkedLibraries = await Promise.all([
          input.strategyId ? tx.select({ id: strategies.id }).from(strategies).where(and(eq(strategies.id, input.strategyId), eq(strategies.tenantId, scope.tenantId))).limit(1) : Promise.resolve([{ id: null }]),
          input.playbookId ? tx.select({ id: playbooks.id }).from(playbooks).where(and(eq(playbooks.id, input.playbookId), eq(playbooks.tenantId, scope.tenantId))).limit(1) : Promise.resolve([{ id: null }]),
          input.closeReasonId ? tx.select({ id: closeReasons.id }).from(closeReasons).where(and(eq(closeReasons.id, input.closeReasonId), eq(closeReasons.tenantId, scope.tenantId))).limit(1) : Promise.resolve([{ id: null }]),
        ]);
        if ((input.strategyId && !linkedLibraries[0][0]) || (input.playbookId && !linkedLibraries[1][0]) || (input.closeReasonId && !linkedLibraries[2][0])) {
          throw new Error("A selected trade library item is not available in this workspace.");
        }
        const [instrument] = await tx
          .insert(instruments)
          .values({
            tenantId: scope.tenantId,
            symbol,
            assetClass: input.assetClass,
            instrumentType: input.instrumentType,
            subcategory: cleanOptional(input.subcategory),
            expiryDate: input.expiryDate || null,
            optionSide: input.instrumentType === "Options" ? input.optionSide || null : null,
            strikePrice: input.instrumentType === "Options" ? numeric(input.strikePrice) : null,
            defaultTradingStyle: cleanOptional(input.tradingStyle),
            defaultQuantity: numeric(input.quantity),
            defaultMultiplier: numeric(input.multiplier),
            defaultPlatform: cleanOptional(input.platform),
            defaultCurrency: input.currency,
          })
          .onConflictDoUpdate({
            target: [instruments.tenantId, instruments.symbol, instruments.instrumentType],
            set: {
              assetClass: input.assetClass,
              subcategory: cleanOptional(input.subcategory),
              expiryDate: input.expiryDate || null,
              optionSide: input.instrumentType === "Options" ? input.optionSide || null : null,
              strikePrice: input.instrumentType === "Options" ? numeric(input.strikePrice) : null,
              defaultTradingStyle: cleanOptional(input.tradingStyle),
              defaultQuantity: numeric(input.quantity),
              defaultMultiplier: numeric(input.multiplier),
              defaultPlatform: cleanOptional(input.platform),
              defaultCurrency: input.currency,
              updatedAt: new Date(),
            },
          })
          .returning({ id: instruments.id });

        const [trade] = await tx.insert(trades).values({
          tenantId: scope.tenantId,
          accountId: input.accountId,
          createdByUserId: scope.userId,
          instrumentId: instrument.id,
          strategyId: input.strategyId || null,
          playbookId: input.playbookId || null,
          closeReasonId: input.status === "closed" ? input.closeReasonId || null : null,
          symbol,
          assetClass: input.assetClass,
          instrumentType: input.instrumentType,
          subcategory: cleanOptional(input.subcategory),
          expiryDate: input.expiryDate || null,
          optionSide: input.instrumentType === "Options" ? input.optionSide || null : null,
          strikePrice: input.instrumentType === "Options" ? numeric(input.strikePrice) : null,
          tradingStyle: cleanOptional(input.tradingStyle),
          platform: cleanOptional(input.platform),
          direction: input.direction,
          status: input.status,
          currency: input.currency,
          entryAt: new Date(input.entryAt),
          entryPrice: numeric(input.entryPrice)!,
          exitAt: input.exitAt ? new Date(input.exitAt) : null,
          exitPrice: numeric(input.exitPrice),
          quantity: numeric(input.quantity)!,
          multiplier: numeric(input.multiplier)!,
          stopLoss: numeric(input.stopLoss),
          plannedTarget: numeric(input.plannedTarget),
          manualPnl: numeric(input.manualPnl),
          fees: numeric(input.fees)!,
          fxToAccount: numeric(input.fxToAccount)!,
          plannedRisk: numeric(evaluated.preview.plannedRisk),
          plannedRewardRisk: numeric(evaluated.preview.plannedRewardRisk),
          realizedPnl: numeric(evaluated.preview.realizedPnl),
          realizedR: numeric(evaluated.preview.realizedR),
          mfePrice: numeric(input.mfePrice),
          maePrice: numeric(input.maePrice),
          mfeAmount: numeric(evaluated.preview.mfeAmount),
          maeAmount: numeric(evaluated.preview.maeAmount),
          mfeR: numeric(evaluated.preview.mfeR),
          maeR: numeric(evaluated.preview.maeR),
          capturedMovePct: numeric(evaluated.preview.capturedMovePct),
          confidence: input.confidence ?? null,
          emotion: cleanOptional(input.emotion),
          setupChecklist: input.setupChecklist ?? [],
          tags: (input.tags ?? []).map((tag) => tag.trim()).filter(Boolean),
          ruleViolations: cleanOptional(input.ruleViolations),
          linkedNote: cleanOptional(input.linkedNote),
          notes: cleanOptional(input.notes),
        }).returning();

        return trade;
      });
    },

    /**
     * Edit an existing open or closed trade. Re-validates and recomputes every
     * derived metric through the same oracle as create; tenant/account scoped.
     * Returns null when the trade is not in this workspace.
     */
    update: async (input: CreateTradeInput & { tradeId: string }) => {
      const evaluated = evaluateTradeEntry(input);
      if (Object.keys(evaluated.errors).length > 0) {
        const error = new Error("Trade entry validation failed.");
        Object.assign(error, { fieldErrors: evaluated.errors });
        throw error;
      }

      const symbol = input.symbol.trim().toUpperCase();
      const [owned] = await db.select({ id: trades.id }).from(trades).where(and(
        eq(trades.id, input.tradeId), eq(trades.tenantId, scope.tenantId), eq(trades.createdByUserId, scope.userId), eq(trades.accountId, input.accountId),
      )).limit(1);
      if (!owned) return null;

      return db.transaction(async (tx) => {
        const linkedLibraries = await Promise.all([
          input.strategyId ? tx.select({ id: strategies.id }).from(strategies).where(and(eq(strategies.id, input.strategyId), eq(strategies.tenantId, scope.tenantId))).limit(1) : Promise.resolve([{ id: null }]),
          input.playbookId ? tx.select({ id: playbooks.id }).from(playbooks).where(and(eq(playbooks.id, input.playbookId), eq(playbooks.tenantId, scope.tenantId))).limit(1) : Promise.resolve([{ id: null }]),
          input.closeReasonId ? tx.select({ id: closeReasons.id }).from(closeReasons).where(and(eq(closeReasons.id, input.closeReasonId), eq(closeReasons.tenantId, scope.tenantId))).limit(1) : Promise.resolve([{ id: null }]),
        ]);
        if ((input.strategyId && !linkedLibraries[0][0]) || (input.playbookId && !linkedLibraries[1][0]) || (input.closeReasonId && !linkedLibraries[2][0])) {
          throw new Error("A selected trade library item is not available in this workspace.");
        }
        const [instrument] = await tx
          .insert(instruments)
          .values({
            tenantId: scope.tenantId, symbol, assetClass: input.assetClass, instrumentType: input.instrumentType,
            subcategory: cleanOptional(input.subcategory), defaultTradingStyle: cleanOptional(input.tradingStyle),
            expiryDate: input.expiryDate || null, optionSide: input.instrumentType === "Options" ? input.optionSide || null : null,
            strikePrice: input.instrumentType === "Options" ? numeric(input.strikePrice) : null,
            defaultQuantity: numeric(input.quantity), defaultMultiplier: numeric(input.multiplier),
            defaultPlatform: cleanOptional(input.platform), defaultCurrency: input.currency,
          })
          .onConflictDoUpdate({
            target: [instruments.tenantId, instruments.symbol, instruments.instrumentType],
            set: {
              assetClass: input.assetClass, subcategory: cleanOptional(input.subcategory),
              expiryDate: input.expiryDate || null, optionSide: input.instrumentType === "Options" ? input.optionSide || null : null,
              strikePrice: input.instrumentType === "Options" ? numeric(input.strikePrice) : null,
              defaultTradingStyle: cleanOptional(input.tradingStyle), defaultQuantity: numeric(input.quantity),
              defaultMultiplier: numeric(input.multiplier), defaultPlatform: cleanOptional(input.platform),
              defaultCurrency: input.currency, updatedAt: new Date(),
            },
          })
          .returning({ id: instruments.id });

        const [updated] = await tx.update(trades).set({
          instrumentId: instrument.id,
          strategyId: input.strategyId || null,
          playbookId: input.playbookId || null,
          closeReasonId: input.status === "closed" ? input.closeReasonId || null : null,
          symbol,
          assetClass: input.assetClass,
          instrumentType: input.instrumentType,
          subcategory: cleanOptional(input.subcategory),
          expiryDate: input.expiryDate || null,
          optionSide: input.instrumentType === "Options" ? input.optionSide || null : null,
          strikePrice: input.instrumentType === "Options" ? numeric(input.strikePrice) : null,
          tradingStyle: cleanOptional(input.tradingStyle),
          platform: cleanOptional(input.platform),
          direction: input.direction,
          status: input.status,
          currency: input.currency,
          entryAt: new Date(input.entryAt),
          entryPrice: numeric(input.entryPrice)!,
          exitAt: input.exitAt ? new Date(input.exitAt) : null,
          exitPrice: numeric(input.exitPrice),
          quantity: numeric(input.quantity)!,
          multiplier: numeric(input.multiplier)!,
          stopLoss: numeric(input.stopLoss),
          plannedTarget: numeric(input.plannedTarget),
          manualPnl: numeric(input.manualPnl),
          fees: numeric(input.fees)!,
          fxToAccount: numeric(input.fxToAccount)!,
          plannedRisk: numeric(evaluated.preview.plannedRisk),
          plannedRewardRisk: numeric(evaluated.preview.plannedRewardRisk),
          realizedPnl: numeric(evaluated.preview.realizedPnl),
          realizedR: numeric(evaluated.preview.realizedR),
          mfePrice: numeric(input.mfePrice),
          maePrice: numeric(input.maePrice),
          mfeAmount: numeric(evaluated.preview.mfeAmount),
          maeAmount: numeric(evaluated.preview.maeAmount),
          mfeR: numeric(evaluated.preview.mfeR),
          maeR: numeric(evaluated.preview.maeR),
          capturedMovePct: numeric(evaluated.preview.capturedMovePct),
          confidence: input.confidence ?? null,
          emotion: cleanOptional(input.emotion),
          setupChecklist: input.setupChecklist ?? [],
          tags: (input.tags ?? []).map((tag) => tag.trim()).filter(Boolean),
          ruleViolations: cleanOptional(input.ruleViolations),
          linkedNote: cleanOptional(input.linkedNote),
          notes: cleanOptional(input.notes),
          updatedAt: new Date(),
        }).where(and(
          eq(trades.id, input.tradeId), eq(trades.tenantId, scope.tenantId), eq(trades.createdByUserId, scope.userId), eq(trades.accountId, input.accountId),
        )).returning();
        return updated;
      });
    },
  };
}
