import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { ReportsWorkspace } from "@/components/reports/reports-workspace";
import { ensureDefaultTradeLibraries, getTradeEntryLibraries } from "@/db/repositories/libraries";
import { createTradeRepository } from "@/db/repositories/trades";
import { getDb } from "@/db/server";
import { buildAnalyticsByCurrency } from "@/lib/analytics-data";
import { parseTradeScope, scopeTradeRows } from "@/lib/trade-scope";
import { requireWorkspaceSession } from "@/lib/workspace-session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reports · TradeVault",
  description: "Printable, currency-scoped trading performance reports and private JSON backups.",
};

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ period?: string; asset?: string; from?: string; to?: string }> }) {
  const { shellUser, scope: tenantScope, account, timeZone } = await requireWorkspaceSession();
  const reportScope = parseTradeScope(await searchParams);
  const db = getDb();
  await ensureDefaultTradeLibraries(db, tenantScope);
  const [rows, libraries] = await Promise.all([
    createTradeRepository(db, tenantScope).listAll(account.id),
    getTradeEntryLibraries(db, tenantScope),
  ]);
  const scopedRows = scopeTradeRows(rows, reportScope, new Date(), timeZone);
  const analyticsByCurrency = buildAnalyticsByCurrency(
    scopedRows,
    new Map(libraries.strategies.map((item) => [item.id, item.name])),
    new Map(libraries.playbooks.map((item) => [item.id, item.name])),
    timeZone,
  );

  return (
    <AppShell user={shellUser}>
      <ReportsWorkspace
        accountName={account.name}
        defaultCurrency={account.defaultCurrency}
        analyticsByCurrency={analyticsByCurrency}
        scope={reportScope}
        timeZone={timeZone}
        generatedAt={new Date().toISOString()}
      />
    </AppShell>
  );
}
