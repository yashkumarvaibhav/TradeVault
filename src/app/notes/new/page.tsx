import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { NoteEditor } from "@/components/notes/note-editor";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { getTradeEntryLibraries } from "@/db/repositories/libraries";
import { createTradeRepository } from "@/db/repositories/trades";
import { getDb } from "@/db/server";
import { formatDateInTimeZone } from "@/lib/date-time";
import { requireWorkspaceSession } from "@/lib/workspace-session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "New note · TradeVault" };

export default async function NewNotePage() {
  const { shellUser, scope, account, timeZone } = await requireWorkspaceSession();
  const db = getDb();
  const [trades, libraries] = await Promise.all([
    createTradeRepository(db, scope).list({ accountId: account.id, limit: 50 }),
    getTradeEntryLibraries(db, scope),
  ]);
  const tradeOptions = trades.map((trade) => ({
    id: trade.id,
    label: `${trade.symbol} · ${formatDateInTimeZone(trade.entryAt, timeZone, { day: "2-digit", month: "short", year: "numeric" })}`,
  }));
  const playbookOptions = libraries.playbooks.map((playbook) => ({ id: playbook.id, name: playbook.name }));

  return (
    <AppShell user={shellUser}>
      <PageHeader
        eyebrow={<Chip tone="accent">Notes</Chip>}
        title="New note"
        description="Write a journal entry, plan, or review. Link it to a trade or playbook to keep your thinking connected."
        actions={<Button asChild variant="ghost" size="compact"><Link href="/notes"><ArrowLeft aria-hidden="true" />Back to notes</Link></Button>}
      />
      <div className="mt-8">
        <NoteEditor mode="create" tradeOptions={tradeOptions} playbookOptions={playbookOptions} />
      </div>
    </AppShell>
  );
}
