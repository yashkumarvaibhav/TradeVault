import { and, asc, eq, isNull } from "drizzle-orm";

import type { Database } from "@/db/client";
import { checklistTemplates, closeReasons, instruments, playbooks, strategies } from "@/db/schema";
import type { TenantScope } from "@/db/repositories/workspaces";

const strategyDefaults = [
  { name: "Breakout", description: "Price expands beyond a clearly defined range or level." },
  { name: "Trend continuation", description: "Join an established directional move after confirmation." },
  { name: "Mean reversion", description: "Trade an overstretched move back toward its reference value." },
];

const closeReasonDefaults = ["Target hit", "Stop loss", "Manual exit", "Time exit", "Thesis invalidated"];

const playbookDefaults = [
  { name: "Opening range breakout", marketScope: "Intraday", setupRules: ["Opening range is defined", "Break has volume or momentum confirmation", "Invalidation is beyond the range"] },
  { name: "Pullback continuation", marketScope: "Trend", setupRules: ["Higher-timeframe trend is intact", "Pullback reaches a planned area", "Entry has a clear invalidation"] },
];

const checklistDefaults = [{
  name: "Core trade discipline",
  items: [
    { id: "thesis", label: "The trade thesis is written and specific", phase: "entry" as const },
    { id: "invalidation", label: "Invalidation and initial stop are defined", phase: "entry" as const },
    { id: "sizing", label: "Position size is within the planned risk", phase: "entry" as const },
    { id: "exit-plan", label: "The exit followed the plan or has an explained exception", phase: "exit" as const },
    { id: "review", label: "Outcome and learning are ready for review", phase: "exit" as const },
  ],
}];

/** Idempotently heals the default libraries for both new and existing tenants. */
export async function ensureDefaultTradeLibraries(db: Database, scope: TenantScope) {
  await db.transaction(async (tx) => {
    await tx.insert(strategies).values(strategyDefaults.map((item) => ({ tenantId: scope.tenantId, ...item }))).onConflictDoNothing();
    await tx.insert(closeReasons).values(closeReasonDefaults.map((name) => ({ tenantId: scope.tenantId, name }))).onConflictDoNothing();
    await tx.insert(playbooks).values(playbookDefaults.map((item) => ({ tenantId: scope.tenantId, ...item }))).onConflictDoNothing();
    await tx.insert(checklistTemplates).values(checklistDefaults.map((item) => ({ tenantId: scope.tenantId, ...item }))).onConflictDoNothing();
  });
}

export async function getTradeEntryLibraries(db: Database, scope: TenantScope) {
  const [strategyRows, closeReasonRows, playbookRows, checklistRows, instrumentRows] = await Promise.all([
    db.select().from(strategies).where(and(eq(strategies.tenantId, scope.tenantId), isNull(strategies.archivedAt))).orderBy(asc(strategies.name)),
    db.select().from(closeReasons).where(and(eq(closeReasons.tenantId, scope.tenantId), isNull(closeReasons.archivedAt))).orderBy(asc(closeReasons.name)),
    db.select().from(playbooks).where(and(eq(playbooks.tenantId, scope.tenantId), isNull(playbooks.archivedAt))).orderBy(asc(playbooks.name)),
    db.select().from(checklistTemplates).where(and(eq(checklistTemplates.tenantId, scope.tenantId), isNull(checklistTemplates.archivedAt))).orderBy(asc(checklistTemplates.name)),
    db.select().from(instruments).where(and(eq(instruments.tenantId, scope.tenantId), isNull(instruments.archivedAt))).orderBy(asc(instruments.symbol)),
  ]);

  return {
    strategies: strategyRows.map(({ id, name, description }) => ({ id, name, description })),
    closeReasons: closeReasonRows.map(({ id, name }) => ({ id, name })),
    playbooks: playbookRows.map(({ id, name, marketScope, setupRules }) => ({ id, name, marketScope, setupRules })),
    checklistTemplates: checklistRows.map(({ id, name, items }) => ({ id, name, items })),
    instruments: instrumentRows.map((row) => ({
      id: row.id,
      symbol: row.symbol,
      name: row.name,
      assetClass: row.assetClass,
      instrumentType: row.instrumentType,
      subcategory: row.subcategory,
      expiryDate: row.expiryDate,
      optionSide: row.optionSide,
      strikePrice: row.strikePrice,
      tradingStyle: row.defaultTradingStyle,
      quantity: row.defaultQuantity,
      multiplier: row.defaultMultiplier,
      platform: row.defaultPlatform,
      currency: row.defaultCurrency,
    })),
  };
}

export type TradeEntryLibraries = Awaited<ReturnType<typeof getTradeEntryLibraries>>;
