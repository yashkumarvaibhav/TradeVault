import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { RiskStudio } from "@/components/risk/risk-studio";
import { getTradeEntryLibraries } from "@/db/repositories/libraries";
import { createTradeRepository } from "@/db/repositories/trades";
import { getDb } from "@/db/server";
import { buildRiskWhatIfSamplesByCurrency } from "@/lib/analytics-data";
import { parseTradeScope, scopeTradeRows } from "@/lib/trade-scope";
import { requireWorkspaceSession } from "@/lib/workspace-session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Risk Studio · TradeVault",
  description: "Seeded Monte-Carlo and transparent What-If scenarios for your realized-R edge — historical scenarios, not forecasts.",
};

export default async function RiskPage({ searchParams }: { searchParams: Promise<{ period?: string; asset?: string; from?: string; to?: string }> }) {
  const { shellUser, scope: tenantScope, account, timeZone } = await requireWorkspaceSession();
  const dashboardScope = parseTradeScope(await searchParams);
  const db = getDb();
  const [rows, libraries] = await Promise.all([
    createTradeRepository(db, tenantScope).listAll(account.id),
    getTradeEntryLibraries(db, tenantScope),
  ]);
  const scopedRows = scopeTradeRows(rows, dashboardScope, new Date(), timeZone);
  const playbookNames = new Map(libraries.playbooks.map((playbook) => [playbook.id, playbook.name]));
  const whatIfSamplesByCurrency = buildRiskWhatIfSamplesByCurrency(scopedRows, playbookNames, timeZone);

  return (
    <AppShell user={shellUser}>
      <RiskStudio
        whatIfSamplesByCurrency={whatIfSamplesByCurrency}
        currency={shellUser.currency}
        scope={dashboardScope}
        timeZone={timeZone}
      />
    </AppShell>
  );
}
