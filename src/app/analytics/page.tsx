import type { Metadata } from "next";

import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";
import { AppShell } from "@/components/app-shell";
import { ensureDefaultTradeLibraries, getTradeEntryLibraries } from "@/db/repositories/libraries";
import { createTradeRepository } from "@/db/repositories/trades";
import { getDb } from "@/db/server";
import { buildAnalyticsByCurrency } from "@/lib/analytics-data";
import { parseTradeScope, scopeTradeRows } from "@/lib/trade-scope";
import { requireWorkspaceSession } from "@/lib/workspace-session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Analytics · TradeVault",
  description: "Per-currency performance analytics for your trading journal.",
};

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ period?: string; asset?: string }> }) {
  const { shellUser, scope: tenantScope, account } = await requireWorkspaceSession();
  const dashboardScope = parseTradeScope(await searchParams);
  const db = getDb();
  await ensureDefaultTradeLibraries(db, tenantScope);
  const [rows, libraries] = await Promise.all([
    createTradeRepository(db, tenantScope).listAll(account.id),
    getTradeEntryLibraries(db, tenantScope),
  ]);
  const now = new Date();
  const scopedRows = scopeTradeRows(rows, dashboardScope, now);
  const strategyNames = new Map(libraries.strategies.map((strategy) => [strategy.id, strategy.name]));
  const playbookNames = new Map(libraries.playbooks.map((playbook) => [playbook.id, playbook.name]));
  const analyticsByCurrency = buildAnalyticsByCurrency(scopedRows, strategyNames, playbookNames);

  return (
    <AppShell user={shellUser}>
      <AnalyticsDashboard analyticsByCurrency={analyticsByCurrency} scope={dashboardScope} />
    </AppShell>
  );
}
