/**
 * Notes / Journal domain model (pure — no DB, no React).
 *
 * The Notes workspace is a *unified index*: it merges first-class journal notes with the
 * trading thinking that already lives on other records (trade entry notes, trade
 * review/exit notes, playbook notes). Source-derived items stay linked to their origin and
 * are never copied into detached note rows — the builder marks them read-only and points
 * their `href` at the source record. This module is the Vitest oracle for that merge,
 * the search/filter/sort rules, and excerpt generation.
 */

/** Note "type" doubles as the S9 left-nav Folders axis. */
export const NOTE_TYPES = ["general", "pre-trade", "post-trade", "daily-journal"] as const;
export const NOTE_COLLECTIONS = ["none", "setups", "risk-rules", "mistakes", "tags"] as const;

export type NoteType = (typeof NOTE_TYPES)[number];
export type NoteCollection = (typeof NOTE_COLLECTIONS)[number];

/** TipTap / ProseMirror document JSON. Null for fast plain-text notes. */
export type RichTextDoc = { type: "doc"; content?: unknown[] };

/** Where a feed item originates. Only `note` items are editable in the Notes workspace. */
export type NoteSource = "note" | "trade-entry-note" | "trade-review-note" | "playbook-note";

/** Top-level nav view (All Notes / Pinned / Templates). */
export type NotesView = "all" | "pinned" | "templates";

export interface DedicatedNoteInput {
  id: string;
  title: string;
  bodyText: string;
  noteType: NoteType;
  collection: NoteCollection;
  isTemplate: boolean;
  pinned: boolean;
  linkedTradeId: string | null;
  linkedPlaybookId: string | null;
  /** Resolved labels for the linked record, if any (e.g. "AAPL", "Opening range breakout"). */
  linkedTradeLabel?: string | null;
  linkedPlaybookLabel?: string | null;
  updatedAtIso: string;
}

export interface TradeNoteInput {
  tradeId: string;
  symbol: string;
  entryAtIso: string;
  updatedAtIso: string;
  reviewedAtIso: string | null;
  /** trades.linkedNote — the pre-trade / entry note. */
  entryNote: string | null;
  /** trades.notes — the post-trade / review-exit note. */
  reviewNote: string | null;
}

export interface PlaybookNoteInput {
  playbookId: string;
  name: string;
  notes: string | null;
  updatedAtIso: string;
}

export interface NotesFeedSources {
  notes: DedicatedNoteInput[];
  tradeNotes: TradeNoteInput[];
  playbookNotes: PlaybookNoteInput[];
}

export interface NotesQuery {
  q?: string;
  view?: NotesView;
  /** Folder filter (note type). `null`/omitted = every folder. */
  type?: NoteType | null;
  /** Collection filter. `null`/omitted = every collection. */
  collection?: NoteCollection | null;
}

export interface NoteFeedItem {
  /** Stable key. Dedicated notes use their uuid; source items use a `source:origin` key. */
  id: string;
  source: NoteSource;
  title: string;
  excerpt: string;
  noteType: NoteType;
  collection: NoteCollection;
  pinned: boolean;
  isTemplate: boolean;
  editable: boolean;
  updatedAtIso: string;
  /** Deep link to the editor (dedicated) or the source record (derived). */
  href: string | null;
  /** Short label describing the linked source, e.g. "Trade · AAPL" or "Playbook". */
  linkLabel: string | null;
  linkedTradeId: string | null;
  linkedPlaybookId: string | null;
}

export interface NotesCounts {
  all: number;
  pinned: number;
  templates: number;
  byType: Record<NoteType, number>;
  byCollection: Record<NoteCollection, number>;
}

export interface NotesFeedResult {
  items: NoteFeedItem[];
  counts: NotesCounts;
}

const EXCERPT_MAX = 180;

/** Collapse whitespace and trim a plain-text body to a single-line excerpt. */
export function toExcerpt(text: string | null | undefined, max = EXCERPT_MAX): string {
  const collapsed = (text ?? "").replace(/\s+/g, " ").trim();
  if (collapsed.length <= max) return collapsed;
  return `${collapsed.slice(0, max - 1).trimEnd()}…`;
}

function deriveTitle(text: string, fallback: string): string {
  const firstLine = (text ?? "").split(/\n/).map((line) => line.trim()).find((line) => line.length > 0);
  if (!firstLine) return fallback;
  return firstLine.length <= 80 ? firstLine : `${firstLine.slice(0, 79).trimEnd()}…`;
}

function emptyByType(): Record<NoteType, number> {
  return { general: 0, "pre-trade": 0, "post-trade": 0, "daily-journal": 0 };
}

function emptyByCollection(): Record<NoteCollection, number> {
  return { none: 0, setups: 0, "risk-rules": 0, mistakes: 0, tags: 0 };
}

function dedicatedToItem(note: DedicatedNoteInput): NoteFeedItem {
  const linkLabel = note.linkedTradeId && note.linkedTradeLabel
    ? `Trade · ${note.linkedTradeLabel}`
    : note.linkedPlaybookId && note.linkedPlaybookLabel
      ? `Playbook · ${note.linkedPlaybookLabel}`
      : null;
  return {
    id: note.id,
    source: "note",
    title: note.title,
    excerpt: toExcerpt(note.bodyText),
    noteType: note.noteType,
    collection: note.collection,
    pinned: note.pinned,
    isTemplate: note.isTemplate,
    editable: true,
    updatedAtIso: note.updatedAtIso,
    href: `/notes/${note.id}`,
    linkLabel,
    linkedTradeId: note.linkedTradeId,
    linkedPlaybookId: note.linkedPlaybookId,
  };
}

/** Expand the trade/playbook source rows into read-only, linked-to-source feed items. */
function sourceItems(sources: NotesFeedSources): NoteFeedItem[] {
  const items: NoteFeedItem[] = [];

  for (const trade of sources.tradeNotes) {
    const entry = trade.entryNote?.trim();
    if (entry) {
      items.push({
        id: `trade-entry:${trade.tradeId}`,
        source: "trade-entry-note",
        title: deriveTitle(entry, `${trade.symbol} entry note`),
        excerpt: toExcerpt(entry),
        noteType: "pre-trade",
        collection: "none",
        pinned: false,
        isTemplate: false,
        editable: false,
        updatedAtIso: trade.entryAtIso,
        href: `/trades/${trade.tradeId}`,
        linkLabel: `Trade · ${trade.symbol}`,
        linkedTradeId: trade.tradeId,
        linkedPlaybookId: null,
      });
    }
    const review = trade.reviewNote?.trim();
    if (review) {
      items.push({
        id: `trade-review:${trade.tradeId}`,
        source: "trade-review-note",
        title: deriveTitle(review, `${trade.symbol} review note`),
        excerpt: toExcerpt(review),
        noteType: "post-trade",
        collection: "none",
        pinned: false,
        isTemplate: false,
        editable: false,
        updatedAtIso: trade.reviewedAtIso ?? trade.updatedAtIso,
        href: `/trades/${trade.tradeId}?mode=review`,
        linkLabel: `Trade · ${trade.symbol}`,
        linkedTradeId: trade.tradeId,
        linkedPlaybookId: null,
      });
    }
  }

  for (const playbook of sources.playbookNotes) {
    const text = playbook.notes?.trim();
    if (!text) continue;
    items.push({
      id: `playbook:${playbook.playbookId}`,
      source: "playbook-note",
      title: deriveTitle(text, `${playbook.name} playbook note`),
      excerpt: toExcerpt(text),
      noteType: "general",
      collection: "setups",
      pinned: false,
      isTemplate: false,
      editable: false,
      updatedAtIso: playbook.updatedAtIso,
      href: `/trades?playbookId=${playbook.playbookId}`,
      linkLabel: `Playbook · ${playbook.name}`,
      linkedTradeId: null,
      linkedPlaybookId: playbook.playbookId,
    });
  }

  return items;
}

function matchesSearch(item: NoteFeedItem, q: string): boolean {
  const haystack = `${item.title}\n${item.excerpt}\n${item.linkLabel ?? ""}`.toLowerCase();
  return q.split(/\s+/).filter(Boolean).every((term) => haystack.includes(term));
}

/**
 * Build the unified notes feed: dedicated notes + source-derived (trade/playbook) notes,
 * filtered by the active view/folder/collection/search and sorted pinned-first then newest.
 * Counts reflect the full non-archived universe (independent of the active query) so the
 * left-nav badges stay stable as the user navigates.
 */
export function buildNotesFeed(sources: NotesFeedSources, query: NotesQuery = {}): NotesFeedResult {
  const all = [...sources.notes.map(dedicatedToItem), ...sourceItems(sources)];

  const counts: NotesCounts = {
    all: 0,
    pinned: 0,
    templates: 0,
    byType: emptyByType(),
    byCollection: emptyByCollection(),
  };
  for (const item of all) {
    if (item.isTemplate) {
      counts.templates += 1;
      continue;
    }
    counts.all += 1;
    if (item.pinned) counts.pinned += 1;
    counts.byType[item.noteType] += 1;
    counts.byCollection[item.collection] += 1;
  }

  const view: NotesView = query.view ?? "all";
  const q = query.q?.trim().toLowerCase() ?? "";

  const items = all
    .filter((item) => {
      if (view === "templates") return item.isTemplate && (!q || matchesSearch(item, q));
      if (item.isTemplate) return false;
      if (view === "pinned" && !item.pinned) return false;
      if (query.type && item.noteType !== query.type) return false;
      if (query.collection && item.collection !== query.collection) return false;
      if (q && !matchesSearch(item, q)) return false;
      return true;
    })
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (a.updatedAtIso !== b.updatedAtIso) return a.updatedAtIso < b.updatedAtIso ? 1 : -1;
      return a.title.localeCompare(b.title);
    });

  return { items, counts };
}
