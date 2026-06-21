import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { ReviewDashboard } from "@/components/review/review-dashboard";
import { ensureDefaultTradeLibraries, getTradeEntryLibraries } from "@/db/repositories/libraries";
import { createTradeRepository } from "@/db/repositories/trades";
import { getDb } from "@/db/server";
import { buildReviewAnalyticsByCurrency } from "@/lib/review-data";
import { parseTradeScope } from "@/lib/trade-scope";
import { requireWorkspaceSession } from "@/lib/workspace-session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Review Center · TradeVault",
  description: "Currency-safe behavioral evidence and the closed-trade review queue.",
};

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ period?: string; asset?: string; from?: string; to?: string }> }) {
  const { shellUser, scope: tenantScope, account, timeZone } = await requireWorkspaceSession();
  const dashboardScope = parseTradeScope(await searchParams);
  const db = getDb();
  await ensureDefaultTradeLibraries(db, tenantScope);
  const [rows, libraries] = await Promise.all([
    createTradeRepository(db, tenantScope).listAll(account.id),
    getTradeEntryLibraries(db, tenantScope),
  ]);
  const now = new Date();
  const analyticsByCurrency = buildReviewAnalyticsByCurrency(rows, {
    strategies: new Map(libraries.strategies.map(({ id, name }) => [id, name])),
    playbooks: new Map(libraries.playbooks.map(({ id, name }) => [id, name])),
    closeReasons: new Map(libraries.closeReasons.map(({ id, name }) => [id, name])),
  }, dashboardScope, now, timeZone);

  return <AppShell user={shellUser}><ReviewDashboard analyticsByCurrency={analyticsByCurrency} currency={shellUser.currency} scope={dashboardScope} nowIso={now.toISOString()} timeZone={timeZone} /></AppShell>;
}
