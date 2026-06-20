import { AppShell } from "@/components/app-shell";
import { OverviewDashboard } from "@/components/overview/overview-dashboard";
import { createTradeRepository } from "@/db/repositories/trades";
import { getDb } from "@/db/server";
import { buildOverviewData } from "@/lib/overview-data";
import { requireWorkspaceSession } from "@/lib/workspace-session";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { shellUser, scope, account } = await requireWorkspaceSession();
  const rows = await createTradeRepository(getDb(), scope).listAll(account.id);
  const now = new Date();
  return <AppShell user={shellUser}>
    <OverviewDashboard
      dataByCurrency={buildOverviewData(rows, now)}
      displayName={shellUser.displayName}
      asOf={now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}
    />
  </AppShell>;
}
