import { AppShell } from "@/components/app-shell";
import { OverviewDashboard, type OverviewAsset, type OverviewPeriod } from "@/components/overview/overview-dashboard";
import { createTradeRepository } from "@/db/repositories/trades";
import { getDb } from "@/db/server";
import { buildOverviewData } from "@/lib/overview-data";
import { requireWorkspaceSession } from "@/lib/workspace-session";

export const dynamic = "force-dynamic";

const PERIODS: OverviewPeriod[] = ["all", "30d", "90d", "ytd"];
const ASSETS: OverviewAsset[] = ["Overall", "Equity", "Index", "Forex", "Commodity", "US Index", "Crypto"];

function periodCutoff(period: OverviewPeriod, now: Date): Date | null {
  if (period === "30d") return new Date(now.getTime() - 30 * 86_400_000);
  if (period === "90d") return new Date(now.getTime() - 90 * 86_400_000);
  if (period === "ytd") return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  return null;
}

export default async function Home({ searchParams }: { searchParams: Promise<{ period?: string; asset?: string }> }) {
  const { shellUser, scope, account } = await requireWorkspaceSession();
  const sp = await searchParams;
  const period = (PERIODS.includes(sp.period as OverviewPeriod) ? sp.period : "all") as OverviewPeriod;
  const asset = (ASSETS.includes(sp.asset as OverviewAsset) ? sp.asset : "Overall") as OverviewAsset;

  const rows = await createTradeRepository(getDb(), scope).listAll(account.id);
  const now = new Date();
  const cutoff = periodCutoff(period, now);
  const scopedRows = rows.filter((row) =>
    (asset === "Overall" || row.assetClass === asset) && (cutoff == null || row.entryAt >= cutoff),
  );
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  return <AppShell user={shellUser}>
    <OverviewDashboard
      dataByCurrency={buildOverviewData(scopedRows, now)}
      displayName={shellUser.displayName}
      asOf={now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}
      scope={{ period, asset, month }}
    />
  </AppShell>;
}
