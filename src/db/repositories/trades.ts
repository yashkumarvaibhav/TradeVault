import { and, desc, eq } from "drizzle-orm";

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
