import { describe, expect, it } from "vitest";

import {
  buildNotesFeed,
  toExcerpt,
  type DedicatedNoteInput,
  type NotesFeedSources,
} from "./notes";

const T1 = "11111111-1111-4111-8111-111111111111";
const P1 = "22222222-2222-4222-8222-222222222222";

function dedicated(overrides: Partial<DedicatedNoteInput> & Pick<DedicatedNoteInput, "id" | "title" | "updatedAtIso">): DedicatedNoteInput {
  return {
    bodyText: "",
    noteType: "general",
    collection: "none",
    isTemplate: false,
    pinned: false,
    linkedTradeId: null,
    linkedPlaybookId: null,
    ...overrides,
  };
}

function sources(): NotesFeedSources {
  return {
    notes: [
      dedicated({ id: "n1", title: "Weekly intent", updatedAtIso: "2026-06-10T00:00:00.000Z", pinned: true, bodyText: "Stay patient." }),
      dedicated({ id: "n2", title: "Sunday journal", updatedAtIso: "2026-06-15T00:00:00.000Z", noteType: "daily-journal" }),
      dedicated({ id: "n3", title: "Pre-trade checklist", updatedAtIso: "2026-06-12T00:00:00.000Z", isTemplate: true, noteType: "pre-trade" }),
      dedicated({ id: "n4", title: "Chased the move", updatedAtIso: "2026-06-14T00:00:00.000Z", collection: "mistakes", linkedTradeId: T1, linkedTradeLabel: "AAPL" }),
    ],
    tradeNotes: [
      { tradeId: T1, symbol: "AAPL", entryAtIso: "2026-06-01T00:00:00.000Z", updatedAtIso: "2026-06-06T00:00:00.000Z", reviewedAtIso: "2026-06-05T00:00:00.000Z", entryNote: "Waited for the open  range\nthen entered", reviewNote: "Exited too early" },
      { tradeId: "33333333-3333-4333-8333-333333333333", symbol: "NIFTY", entryAtIso: "2026-06-02T00:00:00.000Z", updatedAtIso: "2026-06-03T00:00:00.000Z", reviewedAtIso: null, entryNote: "   ", reviewNote: null },
    ],
    playbookNotes: [
      { playbookId: P1, name: "Opening range breakout", notes: "Trade only with volume confirmation", updatedAtIso: "2026-06-08T00:00:00.000Z" },
    ],
  };
}

describe("buildNotesFeed", () => {
  it("merges dedicated and source notes, keeping source items linked and read-only", () => {
    const { items } = buildNotesFeed(sources());

    // Default view excludes the template (n3) → 6 items.
    expect(items.map((item) => item.id)).toEqual([
      "n1", // pinned first
      "n2", // then newest non-pinned
      "n4",
      `playbook:${P1}`,
      `trade-review:${T1}`,
      `trade-entry:${T1}`,
    ]);

    const entry = items.find((item) => item.id === `trade-entry:${T1}`)!;
    expect(entry.source).toBe("trade-entry-note");
    expect(entry.editable).toBe(false);
    expect(entry.noteType).toBe("pre-trade");
    expect(entry.href).toBe(`/trades/${T1}`);
    expect(entry.linkLabel).toBe("Trade · AAPL");
    expect(entry.title).toBe("Waited for the open  range");
    expect(entry.excerpt).toBe("Waited for the open range then entered");

    const review = items.find((item) => item.id === `trade-review:${T1}`)!;
    expect(review.source).toBe("trade-review-note");
    expect(review.noteType).toBe("post-trade");
    expect(review.href).toBe(`/trades/${T1}?mode=review`);

    const playbook = items.find((item) => item.id === `playbook:${P1}`)!;
    expect(playbook.collection).toBe("setups");
    expect(playbook.href).toBe(`/trades?playbookId=${P1}`);
    expect(playbook.linkLabel).toBe("Playbook · Opening range breakout");

    // Whitespace-only / null trade notes never surface.
    expect(items.some((item) => item.id.includes("33333333"))).toBe(false);
  });

  it("isolates templates to the Templates view and never mixes them into other views", () => {
    const all = buildNotesFeed(sources(), { view: "all" });
    expect(all.items.some((item) => item.isTemplate)).toBe(false);

    const templates = buildNotesFeed(sources(), { view: "templates" });
    expect(templates.items.map((item) => item.id)).toEqual(["n3"]);

    const pinned = buildNotesFeed(sources(), { view: "pinned" });
    expect(pinned.items.map((item) => item.id)).toEqual(["n1"]);
  });

  it("filters by folder (type) and collection across dedicated and source items", () => {
    expect(buildNotesFeed(sources(), { type: "daily-journal" }).items.map((i) => i.id)).toEqual(["n2"]);
    expect(buildNotesFeed(sources(), { type: "post-trade" }).items.map((i) => i.id)).toEqual([`trade-review:${T1}`]);
    expect(buildNotesFeed(sources(), { collection: "setups" }).items.map((i) => i.id)).toEqual([`playbook:${P1}`]);
    expect(buildNotesFeed(sources(), { collection: "mistakes" }).items.map((i) => i.id)).toEqual(["n4"]);
  });

  it("searches title, excerpt, and link label with multi-term AND semantics", () => {
    // "aapl" lives only in the link labels of the trade notes + the trade-linked dedicated note.
    expect(buildNotesFeed(sources(), { q: "aapl" }).items.map((i) => i.id)).toEqual([
      "n4", `trade-review:${T1}`, `trade-entry:${T1}`,
    ]);
    // Multi-term hits a single body.
    expect(buildNotesFeed(sources(), { q: "exited early" }).items.map((i) => i.id)).toEqual([`trade-review:${T1}`]);
    expect(buildNotesFeed(sources(), { q: "no-such-term" }).items).toHaveLength(0);
  });

  it("reports stable counts over the full non-archived universe, independent of the active query", () => {
    const { counts } = buildNotesFeed(sources(), { view: "pinned", q: "aapl" });
    expect(counts.all).toBe(6);
    expect(counts.pinned).toBe(1);
    expect(counts.templates).toBe(1);
    expect(counts.byType).toEqual({ general: 3, "pre-trade": 1, "post-trade": 1, "daily-journal": 1 });
    expect(counts.byCollection).toEqual({ none: 4, setups: 1, "risk-rules": 0, mistakes: 1, tags: 0 });
  });
});

describe("toExcerpt", () => {
  it("collapses whitespace and truncates with an ellipsis", () => {
    expect(toExcerpt("  hello   world \n line ")).toBe("hello world line");
    const long = "x".repeat(300);
    const excerpt = toExcerpt(long, 50);
    expect(excerpt).toHaveLength(50);
    expect(excerpt.endsWith("…")).toBe(true);
  });

  it("treats null/undefined bodies as empty", () => {
    expect(toExcerpt(null)).toBe("");
    expect(toExcerpt(undefined)).toBe("");
  });
});
