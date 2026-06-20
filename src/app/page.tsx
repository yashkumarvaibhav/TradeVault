import { AppShell } from "@/components/app-shell";
import { OverviewDashboard } from "@/components/overview/overview-dashboard";
import { createTradeRepository } from "@/db/repositories/trades";
import { getDb } from "@/db/server";
import { buildOverviewData } from "@/lib/overview-data";
import { parseTradeScope, scopeMonth, scopeTradeRows } from "@/lib/trade-scope";
import { requireWorkspaceSession } from "@/lib/workspace-session";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ period?: string; asset?: string }> }) {
  const { shellUser, scope, account } = await requireWorkspaceSession();
  const dashboardScope = parseTradeScope(await searchParams);

  const rows = await createTradeRepository(getDb(), scope).listAll(account.id);
  const now = new Date();
  const scopedRows = scopeTradeRows(rows, dashboardScope, now);

  return <AppShell user={shellUser}>
    <OverviewDashboard
      dataByCurrency={buildOverviewData(scopedRows, now)}
      displayName={shellUser.displayName}
      asOf={now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}
      scope={{ ...dashboardScope, month: scopeMonth(now) }}
    />
  </AppShell>;
}
