import { and, asc, count, desc, eq, gte, ilike, isNotNull, lt, lte, or, type SQL } from "drizzle-orm";

import type { Database } from "@/db/client";
import { instruments, trades, tradingAccounts } from "@/db/schema";
import type { TenantScope } from "@/db/repositories/workspaces";
import { evaluateTradeEntry, type TradeEntryDraft } from "@/lib/domain/trade-entry";

export interface CreateTradeInput extends TradeEntryDraft {
  accountId: string;
  subcategory?: string | null;
  tradingStyle?: string | null;
  platform?: string | null;
  confidence?: number | null;
  emotion?: string | null;
  tags?: string[];
  ruleViolations?: string | null;
  linkedNote?: string | null;
  notes?: string | null;
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
  emotion?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: "entry-desc" | "entry-asc" | "pnl-desc" | "pnl-asc" | "symbol-asc" | "r-desc";
}

function numeric(value: number | null) {
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
    if (options.emotion) conditions.push(eq(trades.emotion, options.emotion));
    if (options.dateFrom) conditions.push(gte(trades.entryAt, new Date(`${options.dateFrom}T00:00:00.000Z`)));
    if (options.dateTo) conditions.push(lte(trades.entryAt, new Date(`${options.dateTo}T23:59:59.999Z`)));
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
        const [instrument] = await tx
          .insert(instruments)
          .values({
            tenantId: scope.tenantId,
            symbol,
            assetClass: input.assetClass,
            instrumentType: input.instrumentType,
            subcategory: cleanOptional(input.subcategory),
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
          symbol,
          assetClass: input.assetClass,
          instrumentType: input.instrumentType,
          subcategory: cleanOptional(input.subcategory),
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
          confidence: input.confidence ?? null,
          emotion: cleanOptional(input.emotion),
          tags: (input.tags ?? []).map((tag) => tag.trim()).filter(Boolean),
          ruleViolations: cleanOptional(input.ruleViolations),
          linkedNote: cleanOptional(input.linkedNote),
          notes: cleanOptional(input.notes),
        }).returning();

        return trade;
      });
    },
  };
}
