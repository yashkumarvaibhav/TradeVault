import { AppShell } from "@/components/app-shell";
import { OverviewDashboard } from "@/components/overview/overview-dashboard";
import { createNoteRepository } from "@/db/repositories/notes";
import { createTradeRepository } from "@/db/repositories/trades";
import { getDb } from "@/db/server";
import { buildNotesFeed } from "@/lib/domain/notes";
import { buildOverviewData } from "@/lib/overview-data";
import { parseTradeScope, scopeMonth, scopeTradeRows } from "@/lib/trade-scope";
import { formatDateInTimeZone } from "@/lib/date-time";
import { requireWorkspaceSession } from "@/lib/workspace-session";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ period?: string; asset?: string; from?: string; to?: string }> }) {
  const { shellUser, scope, account, timeZone } = await requireWorkspaceSession();
  const dashboardScope = parseTradeScope(await searchParams);
  const db = getDb();
  const notesRepo = createNoteRepository(db, scope);

  const [rows, dedicatedNotes, sourceNotes] = await Promise.all([
    createTradeRepository(db, scope).listAll(account.id),
    notesRepo.listForFeed(account.id),
    notesRepo.listSourceNotes(account.id),
  ]);
  const now = new Date();
  const scopedRows = scopeTradeRows(rows, dashboardScope, now, timeZone);
  const recentNotes = buildNotesFeed({ notes: dedicatedNotes, ...sourceNotes }).items.slice(0, 4);

  return <AppShell user={shellUser}>
    <OverviewDashboard
      dataByCurrency={buildOverviewData(scopedRows, now, timeZone)}
      displayName={shellUser.displayName}
      asOf={formatDateInTimeZone(now, timeZone, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      scope={{ ...dashboardScope, month: scopeMonth(now, timeZone) }}
      recentNotes={recentNotes}
      timeZone={timeZone}
    />
  </AppShell>;
}
