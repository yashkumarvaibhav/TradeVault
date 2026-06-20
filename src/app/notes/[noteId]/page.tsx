import type { Metadata } from "next";
import { ArrowLeft, Paperclip } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { NoteEditor, type NoteEditorValue } from "@/components/notes/note-editor";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { createAttachmentRepository } from "@/db/repositories/attachments";
import { getTradeEntryLibraries } from "@/db/repositories/libraries";
import { createNoteRepository } from "@/db/repositories/notes";
import { createTradeRepository } from "@/db/repositories/trades";
import { getDb } from "@/db/server";
import { formatDateInTimeZone } from "@/lib/date-time";
import { requireWorkspaceSession } from "@/lib/workspace-session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Edit note · TradeVault" };

export default async function NoteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ noteId: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { noteId } = await params;
  const { saved } = await searchParams;
  const { shellUser, scope, account, timeZone } = await requireWorkspaceSession();
  const db = getDb();

  const note = await createNoteRepository(db, scope).getById(account.id, noteId);
  if (!note) notFound();

  const tradeRepo = createTradeRepository(db, scope);
  const [trades, libraries, media, linkedTrade] = await Promise.all([
    tradeRepo.list({ accountId: account.id, limit: 50 }),
    getTradeEntryLibraries(db, scope),
    note.linkedTradeId ? createAttachmentRepository(db, scope).listForTrade(account.id, note.linkedTradeId) : Promise.resolve([]),
    note.linkedTradeId ? tradeRepo.getById(account.id, note.linkedTradeId) : Promise.resolve(null),
  ]);

  const tradeOptions = trades.map((trade) => ({
    id: trade.id,
    label: `${trade.symbol} · ${formatDateInTimeZone(trade.entryAt, timeZone, { day: "2-digit", month: "short", year: "numeric" })}`,
  }));
  // Keep the linked trade selectable even if it falls outside the recent window.
  if (linkedTrade && !tradeOptions.some((option) => option.id === linkedTrade.id)) {
    tradeOptions.unshift({ id: linkedTrade.id, label: `${linkedTrade.symbol} · ${formatDateInTimeZone(linkedTrade.entryAt, timeZone, { day: "2-digit", month: "short", year: "numeric" })}` });
  }
  const playbookOptions = libraries.playbooks.map((playbook) => ({ id: playbook.id, name: playbook.name }));

  const value: NoteEditorValue = {
    id: note.id,
    title: note.title,
    bodyJson: note.bodyJson,
    bodyText: note.bodyText,
    noteType: note.noteType,
    collection: note.collection,
    isTemplate: note.isTemplate,
    pinned: note.pinned,
    linkedTradeId: note.linkedTradeId,
    linkedPlaybookId: note.linkedPlaybookId,
  };

  return (
    <AppShell user={shellUser}>
      <PageHeader
        eyebrow={<><Chip tone="accent">Notes</Chip>{note.isTemplate ? <Chip>Template</Chip> : null}<Chip>Updated {formatDateInTimeZone(note.updatedAt, timeZone, { day: "2-digit", month: "short", year: "numeric" })}</Chip></>}
        title="Edit note"
        description="Update the note, change its filing, or link it to a different record."
        actions={<Button asChild variant="ghost" size="compact"><Link href="/notes"><ArrowLeft aria-hidden="true" />Back to notes</Link></Button>}
      />
      <div className="mt-8">
        <NoteEditor mode="edit" note={value} tradeOptions={tradeOptions} playbookOptions={playbookOptions} saved={saved === "1"} />
      </div>

      {media.length ? (
        <section className="mt-6 rounded-lg border border-line bg-raised p-4 shadow-[var(--shadow-sm)]" aria-label="Linked trade media">
          <div className="flex items-center gap-2"><Paperclip className="size-4 text-accent" aria-hidden="true" /><h2 className="font-serif text-lg text-ink">Linked trade media</h2></div>
          <p className="mt-1 text-sm text-muted">Attachments on the linked trade — managed from the trade, shown here for reference.</p>
          <ul className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {media.map((file) => (
              <li key={file.id} className="overflow-hidden rounded-md border border-line bg-page">
                <Link href={`/api/attachments/${file.id}`} target="_blank" rel="noreferrer" className="block outline-none focus-visible:ring-2 focus-visible:ring-accent/40">
                  {file.contentType.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/attachments/${file.id}`} alt={file.caption ?? file.originalName} className="h-28 w-full object-cover" />
                  ) : (
                    <div className="flex h-28 items-center justify-center text-xs font-semibold text-muted">PDF</div>
                  )}
                  <p className="truncate px-2 py-1.5 text-xs text-muted">{file.caption ?? file.originalName}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </AppShell>
  );
}
