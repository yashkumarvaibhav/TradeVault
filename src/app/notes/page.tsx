import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { NotesWorkspace } from "@/components/notes/notes-workspace";
import { createNoteRepository } from "@/db/repositories/notes";
import { getDb } from "@/db/server";
import {
  buildNotesFeed,
  NOTE_COLLECTIONS,
  NOTE_TYPES,
  type NoteCollection,
  type NoteType,
  type NotesView,
} from "@/lib/domain/notes";
import { requireWorkspaceSession } from "@/lib/workspace-session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Notes · TradeVault",
  description: "Search, file, and revisit your trading notes and journal — with trade and playbook notes linked to their source.",
};

export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; view?: string; type?: string; collection?: string }>;
}) {
  const { shellUser, scope, account, timeZone } = await requireWorkspaceSession();
  const repo = createNoteRepository(getDb(), scope);
  const [dedicated, sources] = await Promise.all([repo.listForFeed(account.id), repo.listSourceNotes(account.id)]);

  const query = await searchParams;
  const view: NotesView = (["all", "pinned", "templates"].includes(query.view ?? "") ? query.view : "all") as NotesView;
  const type = (NOTE_TYPES as readonly string[]).includes(query.type ?? "") ? (query.type as NoteType) : null;
  const collection = (NOTE_COLLECTIONS as readonly string[]).includes(query.collection ?? "") ? (query.collection as NoteCollection) : null;
  const q = typeof query.q === "string" ? query.q.slice(0, 120) : "";

  const feed = buildNotesFeed({ notes: dedicated, ...sources }, { q, view, type, collection });

  return (
    <AppShell user={shellUser}>
      <NotesWorkspace items={feed.items} counts={feed.counts} view={view} type={type} collection={collection} q={q} timeZone={timeZone} />
    </AppShell>
  );
}
