import type { ReactNode } from "react";
import Link from "next/link";
import {
  BookMarked,
  FileText,
  Link2,
  ListChecks,
  NotebookPen,
  Pin,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import {
  NOTE_COLLECTIONS,
  NOTE_TYPES,
  type NoteCollection,
  type NoteFeedItem,
  type NotesCounts,
  type NoteType,
  type NotesView,
} from "@/lib/domain/notes";
import { formatDateInTimeZone } from "@/lib/date-time";
import { cn } from "@/lib/utils";

const TYPE_LABEL: Record<NoteType, string> = {
  general: "General",
  "pre-trade": "Pre-trade",
  "post-trade": "Post-trade",
  "daily-journal": "Daily journal",
};

const COLLECTION_LABEL: Record<NoteCollection, string> = {
  none: "Unfiled",
  setups: "Setups",
  "risk-rules": "Risk rules",
  mistakes: "Mistakes",
  tags: "Tags",
};

// S9 nav: Folders are the three filing note types; General stays unfiled under All notes.
const FOLDER_TYPES = NOTE_TYPES.filter((type) => type !== "general") as Exclude<NoteType, "general">[];
const COLLECTION_KEYS = NOTE_COLLECTIONS.filter((collection) => collection !== "none") as Exclude<NoteCollection, "none">[];

const SOURCE_META: Record<NoteFeedItem["source"], { label: string; Icon: typeof FileText }> = {
  note: { label: "Note", Icon: NotebookPen },
  "trade-entry-note": { label: "Trade entry note", Icon: Link2 },
  "trade-review-note": { label: "Trade review note", Icon: ListChecks },
  "playbook-note": { label: "Playbook note", Icon: BookMarked },
};

interface NotesQueryState {
  view: NotesView;
  type: NoteType | null;
  collection: NoteCollection | null;
  q: string;
}

/** Build a `/notes` href, always carrying the current search term. */
function href(state: NotesQueryState, next: Partial<NotesQueryState>): string {
  const merged = { ...state, ...next };
  const params = new URLSearchParams();
  if (merged.q) params.set("q", merged.q);
  if (next.view && next.view !== "all") params.set("view", next.view);
  if (next.type) params.set("type", next.type);
  if (next.collection) params.set("collection", next.collection);
  const qs = params.toString();
  return qs ? `/notes?${qs}` : "/notes";
}

function NavLink({
  label,
  count,
  active,
  to,
  Icon,
}: {
  label: string;
  count: number;
  active: boolean;
  to: string;
  Icon?: typeof FileText;
}) {
  return (
    <Link
      href={to}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-11 items-center gap-2.5 rounded-md px-3 text-sm transition-colors",
        active ? "border border-line-strong bg-accent-soft font-semibold text-ink" : "text-muted hover:bg-hover hover:text-ink",
      )}
    >
      {Icon ? <Icon className={cn("size-[18px] shrink-0", active && "text-accent")} aria-hidden="true" /> : null}
      <span className="flex-1 truncate">{label}</span>
      <span className="tnum text-xs text-faint">{count}</span>
    </Link>
  );
}

function NavSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-faint">{title}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function NoteCard({ item, timeZone }: { item: NoteFeedItem; timeZone: string }) {
  const { label: sourceLabel, Icon: SourceIcon } = SOURCE_META[item.source];
  const titleClass = "font-serif text-lg font-medium leading-snug tracking-[-0.02em] text-ink";
  return (
    <article className="flex min-w-0 flex-col rounded-lg border border-line bg-raised p-4 shadow-[var(--shadow-sm)] transition-colors hover:border-line-strong">
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0">
          {item.href ? (
            <Link href={item.href} className="rounded-sm underline-offset-2 outline-none hover:underline focus-visible:underline">
              <span className={cn(titleClass, "line-clamp-2")}>{item.title}</span>
            </Link>
          ) : (
            <span className={cn(titleClass, "line-clamp-2")}>{item.title}</span>
          )}
        </h3>
        {item.pinned ? <Pin className="size-4 shrink-0 fill-accent text-accent" aria-label="Pinned" /> : null}
      </div>

      <p className="mt-2 line-clamp-3 min-h-[3.5rem] text-sm leading-relaxed text-muted">
        {item.excerpt || <span className="text-faint">No additional text.</span>}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Chip tone={item.editable ? "neutral" : "accent"} className="gap-1">
          <SourceIcon className="size-3" aria-hidden="true" />
          {item.editable ? TYPE_LABEL[item.noteType] : sourceLabel}
        </Chip>
        {item.collection !== "none" ? <Chip>{COLLECTION_LABEL[item.collection]}</Chip> : null}
        {item.linkLabel ? <Chip className="max-w-full"><span className="truncate">{item.linkLabel}</span></Chip> : null}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-2 text-xs text-faint">
        <span>{formatDateInTimeZone(item.updatedAtIso, timeZone, { day: "2-digit", month: "short", year: "numeric" })}</span>
        {!item.editable ? <span className="font-semibold uppercase tracking-[0.06em]">Linked · read-only</span> : null}
      </div>
    </article>
  );
}

export function NotesWorkspace({
  items,
  counts,
  view,
  type,
  collection,
  q,
  timeZone,
}: {
  items: NoteFeedItem[];
  counts: NotesCounts;
  view: NotesView;
  type: NoteType | null;
  collection: NoteCollection | null;
  q: string;
  timeZone: string;
}) {
  const state: NotesQueryState = { view, type, collection, q };
  const libraryActive = view === "all" && !type && !collection;
  const hasActiveFilter = !libraryActive || Boolean(q);

  const activeLabel = view === "pinned"
    ? "Pinned"
    : view === "templates"
      ? "Templates"
      : type
        ? `${TYPE_LABEL[type]} folder`
        : collection
          ? `${COLLECTION_LABEL[collection]} collection`
          : "All notes";

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        eyebrow={<><Chip tone="accent">Notes &amp; journal</Chip><Chip>{counts.all} notes</Chip>{counts.templates ? <Chip>{counts.templates} templates</Chip> : null}</>}
        title="Notes"
        description="Capture and find your trading thinking. Trade and playbook notes appear here linked to their source — never copied."
        actions={<Button asChild size="compact"><Link href="/notes/new"><Plus aria-hidden="true" />New note</Link></Button>}
      />

      <div className="grid min-w-0 gap-6 lg:grid-cols-[13.5rem_minmax(0,1fr)]">
        <nav aria-label="Notes navigation" className="flex flex-col gap-5 lg:sticky lg:top-24 lg:h-fit">
          <NavSection title="Library">
            <NavLink label="All notes" count={counts.all} active={libraryActive} to={href(state, { view: "all", type: null, collection: null })} Icon={NotebookPen} />
            <NavLink label="Pinned" count={counts.pinned} active={view === "pinned"} to={href(state, { view: "pinned", type: null, collection: null })} Icon={Pin} />
            <NavLink label="Templates" count={counts.templates} active={view === "templates"} to={href(state, { view: "templates", type: null, collection: null })} Icon={FileText} />
          </NavSection>

          <NavSection title="Collections">
            {COLLECTION_KEYS.map((key) => (
              <NavLink key={key} label={COLLECTION_LABEL[key]} count={counts.byCollection[key]} active={collection === key} to={href(state, { view: "all", type: null, collection: key })} Icon={Sparkles} />
            ))}
          </NavSection>

          <NavSection title="Folders">
            {FOLDER_TYPES.map((key) => (
              <NavLink key={key} label={TYPE_LABEL[key]} count={counts.byType[key]} active={type === key} to={href(state, { view: "all", type: key, collection: null })} Icon={Link2} />
            ))}
          </NavSection>
        </nav>

        <div className="min-w-0 space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <form action="/notes" method="get" role="search" className="relative flex-1">
              {view !== "all" ? <input type="hidden" name="view" value={view} /> : null}
              {type ? <input type="hidden" name="type" value={type} /> : null}
              {collection ? <input type="hidden" name="collection" value={collection} /> : null}
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden="true" />
              <input
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Search titles, text, and linked records"
                aria-label="Search notes"
                className="h-11 w-full rounded-md border border-line bg-raised pl-9 pr-3 text-sm text-ink outline-none placeholder:text-faint focus-visible:border-line-strong focus-visible:ring-2 focus-visible:ring-accent/40"
              />
            </form>
            {hasActiveFilter ? (
              <Button asChild variant="ghost" size="compact" className="self-start sm:self-auto">
                <Link href="/notes"><X aria-hidden="true" />Clear filters</Link>
              </Button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
            <span className="font-semibold text-ink">{activeLabel}</span>
            <span aria-hidden="true">·</span>
            <span className="tnum">{items.length} {items.length === 1 ? "result" : "results"}</span>
            {q ? <Chip className="gap-1"><Search className="size-3" aria-hidden="true" />“{q}”</Chip> : null}
          </div>

          {items.length ? (
            <div className="grid min-w-0 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {items.map((item) => <NoteCard key={item.id} item={item} timeZone={timeZone} />)}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-line bg-page p-10 text-center">
              <NotebookPen className="mx-auto size-7 text-faint" aria-hidden="true" />
              <p className="mt-3 font-serif text-xl text-ink">{q || !libraryActive ? "No notes match this view." : "No notes yet."}</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted">
                {q || !libraryActive
                  ? "Try clearing the search or choosing a different folder. Trade and playbook notes show up here automatically once you write them."
                  : "Write your first journal note, or add entry and review notes on your trades — they all gather here."}
              </p>
              <div className="mt-4 flex justify-center gap-2">
                <Button asChild size="compact"><Link href="/notes/new"><Plus aria-hidden="true" />New note</Link></Button>
                {hasActiveFilter ? <Button asChild variant="outline" size="compact"><Link href="/notes">View all notes</Link></Button> : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
