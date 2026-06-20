import type { NoteCollection, NoteType } from "@/lib/domain/notes";

/**
 * Built-in starter templates for quick-create. These prefill the editor (title + folder +
 * collection + rich body) reusing review prompts and playbook-checklist structure. They are
 * not stored rows — user-saved templates (notes with `isTemplate`) live in the Templates view.
 */
export interface NoteTemplate {
  id: string;
  label: string;
  description: string;
  noteType: NoteType;
  collection: NoteCollection;
  title: string;
  bodyHtml: string;
}

export const NOTE_TEMPLATES: NoteTemplate[] = [
  {
    id: "pre-trade-plan",
    label: "Pre-trade plan",
    description: "Thesis, setup, and invalidation before you commit.",
    noteType: "pre-trade",
    collection: "setups",
    title: "Pre-trade plan",
    bodyHtml:
      "<h3>Thesis</h3><p>Why is this trade worth taking right now?</p>" +
      "<h3>Setup &amp; trigger</h3><ul><li>Playbook / pattern</li><li>Entry trigger</li></ul>" +
      "<h3>Risk</h3><ul><li>Initial stop &amp; invalidation</li><li>Planned size (within risk budget)</li><li>Target / reward-to-risk</li></ul>",
  },
  {
    id: "post-trade-review",
    label: "Post-trade review",
    description: "What happened, what you'd repeat, what to fix.",
    noteType: "post-trade",
    collection: "mistakes",
    title: "Post-trade review",
    bodyHtml:
      "<h3>What went well</h3><p></p>" +
      "<h3>What I'd change</h3><p></p>" +
      "<h3>Rule discipline</h3><ul><li>Did I follow the plan?</li><li>Any rule violations?</li></ul>" +
      "<h3>One lesson</h3><p></p>",
  },
  {
    id: "daily-journal",
    label: "Daily journal",
    description: "Market read, mindset, and focus for the day.",
    noteType: "daily-journal",
    collection: "none",
    title: "Daily journal",
    bodyHtml:
      "<h3>Market read</h3><p></p>" +
      "<h3>Mindset</h3><p>Energy, emotions, anything off?</p>" +
      "<h3>Focus today</h3><ul><li></li></ul>",
  },
];
