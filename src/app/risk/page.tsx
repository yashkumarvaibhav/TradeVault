import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { RiskStudio } from "@/components/risk/risk-studio";
import { createTradeRepository } from "@/db/repositories/trades";
import { getDb } from "@/db/server";
import { buildRealizedRByCurrency } from "@/lib/analytics-data";
import { parseTradeScope, scopeTradeRows } from "@/lib/trade-scope";
import { requireWorkspaceSession } from "@/lib/workspace-session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Risk Studio · TradeVault",
  description: "Seeded Monte-Carlo simulation of your realized-R edge — historical scenarios, not forecasts.",
};

export default async function RiskPage({ searchParams }: { searchParams: Promise<{ period?: string; asset?: string; from?: string; to?: string }> }) {
  const { shellUser, scope: tenantScope, account, timeZone } = await requireWorkspaceSession();
  const dashboardScope = parseTradeScope(await searchParams);
  const db = getDb();
  const rows = await createTradeRepository(db, tenantScope).listAll(account.id);
  const scopedRows = scopeTradeRows(rows, dashboardScope, new Date(), timeZone);
  const rSamplesByCurrency = buildRealizedRByCurrency(scopedRows, timeZone);

  return (
    <AppShell user={shellUser}>
      <RiskStudio
        rSamplesByCurrency={rSamplesByCurrency}
        defaultCurrency={account.defaultCurrency}
        scope={dashboardScope}
        timeZone={timeZone}
      />
    </AppShell>
  );
}
