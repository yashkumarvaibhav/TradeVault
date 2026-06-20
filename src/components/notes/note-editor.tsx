"use client";

import * as React from "react";
import { useActionState } from "react";
import type { Editor, JSONContent } from "@tiptap/react";
import { AlertCircle, Check, FileText, NotebookPen, Pin, Trash2 } from "lucide-react";
import Link from "next/link";

import { RichTextEditor } from "@/components/notes/rich-text-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NOTE_COLLECTIONS,
  NOTE_TYPES,
  type NoteCollection,
  type NoteType,
  type RichTextDoc,
} from "@/lib/domain/notes";
import { NOTE_TEMPLATES } from "@/lib/notes-templates";
import { cn } from "@/lib/utils";

import { archiveNoteAction, saveNoteAction, togglePinAction, type NoteFormState } from "@/app/notes/actions";

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

export interface NoteEditorValue {
  id: string;
  title: string;
  bodyJson: RichTextDoc | null;
  bodyText: string;
  noteType: NoteType;
  collection: NoteCollection;
  isTemplate: boolean;
  pinned: boolean;
  linkedTradeId: string | null;
  linkedPlaybookId: string | null;
}

function Field({ label, htmlFor, children, hint }: { label: string; htmlFor: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

const selectClass = "h-11 w-full rounded-md border border-line bg-raised px-3 text-sm text-ink outline-none focus-visible:border-line-strong focus-visible:ring-2 focus-visible:ring-accent/40";

function initialContent(note?: NoteEditorValue): JSONContent | string {
  if (note?.bodyJson) return note.bodyJson as JSONContent;
  if (note?.bodyText) return { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: note.bodyText }] }] };
  return "";
}

export function NoteEditor({
  mode,
  note,
  tradeOptions,
  playbookOptions,
  saved = false,
}: {
  mode: "create" | "edit";
  note?: NoteEditorValue;
  tradeOptions: { id: string; label: string }[];
  playbookOptions: { id: string; name: string }[];
  saved?: boolean;
}) {
  const [state, formAction, pending] = useActionState<NoteFormState, FormData>(saveNoteAction, {});
  const editorRef = React.useRef<Editor | null>(null);

  const [title, setTitle] = React.useState(note?.title ?? "");
  const [noteType, setNoteType] = React.useState<NoteType>(note?.noteType ?? "general");
  const [collection, setCollection] = React.useState<NoteCollection>(note?.collection ?? "none");
  const [isTemplate, setIsTemplate] = React.useState(note?.isTemplate ?? false);
  const [pinned, setPinned] = React.useState(note?.pinned ?? false);
  const [linkedTradeId, setLinkedTradeId] = React.useState(note?.linkedTradeId ?? "");
  const [linkedPlaybookId, setLinkedPlaybookId] = React.useState(note?.linkedPlaybookId ?? "");
  const [body, setBody] = React.useState({ json: note?.bodyJson ? JSON.stringify(note.bodyJson) : "", text: note?.bodyText ?? "" });

  const onBodyChange = React.useCallback((json: string, text: string) => setBody({ json, text }), []);
  const onReady = React.useCallback((editor: Editor) => { editorRef.current = editor; }, []);

  function applyTemplate(id: string) {
    const template = NOTE_TEMPLATES.find((item) => item.id === id);
    if (!template) return;
    setTitle((current) => current.trim() ? current : template.title);
    setNoteType(template.noteType);
    setCollection(template.collection);
    editorRef.current?.chain().focus().setContent(template.bodyHtml).run();
  }

  const errors = state.fieldErrors ?? {};

  return (
    <div className="space-y-6">
    <form action={formAction} className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
      {note ? <input type="hidden" name="noteId" value={note.id} /> : null}
      <input type="hidden" name="bodyJson" value={body.json} />
      <input type="hidden" name="bodyText" value={body.text} />
      <input type="hidden" name="noteType" value={noteType} />
      <input type="hidden" name="collection" value={collection} />
      {isTemplate ? <input type="hidden" name="isTemplate" value="on" /> : null}
      {pinned ? <input type="hidden" name="pinned" value="on" /> : null}
      <input type="hidden" name="linkedTradeId" value={linkedTradeId} />
      <input type="hidden" name="linkedPlaybookId" value={linkedPlaybookId} />

      <div className="min-w-0 space-y-4">
        {saved ? (
          <p role="status" className="flex items-center gap-2 rounded-md border border-line-strong bg-accent-soft px-3 py-2 text-sm font-semibold text-ink">
            <Check className="size-4 text-accent" aria-hidden="true" />Note saved.
          </p>
        ) : null}
        {state.error ? (
          <p role="alert" className="flex items-center gap-2 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">
            <AlertCircle className="size-4" aria-hidden="true" />{state.error}
          </p>
        ) : null}

        {mode === "create" ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-line bg-page p-3">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Start from</span>
            {NOTE_TEMPLATES.map((template) => (
              <Button key={template.id} type="button" variant="outline" size="compact" title={template.description} onClick={() => applyTemplate(template.id)}>
                <FileText aria-hidden="true" />{template.label}
              </Button>
            ))}
          </div>
        ) : null}

        <Field label="Title" htmlFor="title">
          <Input id="title" name="title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What is this note about?" autoFocus={mode === "create"} aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? "title-error" : undefined} className="text-base" />
          {errors.title ? <p id="title-error" className="text-xs text-danger">{errors.title}</p> : null}
        </Field>

        <div className="space-y-1.5">
          <Label htmlFor="note-body">Body</Label>
          <RichTextEditor initialContent={initialContent(note)} onChange={onBodyChange} onReady={onReady} ariaLabel="Note body" />
        </div>
      </div>

      <aside className="min-w-0 space-y-5 lg:sticky lg:top-24 lg:h-fit">
        <div className="space-y-4 rounded-lg border border-line bg-raised p-4 shadow-[var(--shadow-sm)]">
          <p className="font-serif text-lg text-ink">Filing</p>
          <Field label="Folder" htmlFor="note-folder">
            <select id="note-folder" value={noteType} onChange={(event) => setNoteType(event.target.value as NoteType)} className={selectClass}>
              {NOTE_TYPES.map((type) => <option key={type} value={type}>{TYPE_LABEL[type]}</option>)}
            </select>
          </Field>
          <Field label="Collection" htmlFor="note-collection">
            <select id="note-collection" value={collection} onChange={(event) => setCollection(event.target.value as NoteCollection)} className={selectClass}>
              {NOTE_COLLECTIONS.map((value) => <option key={value} value={value}>{COLLECTION_LABEL[value]}</option>)}
            </select>
          </Field>

          <label className="flex items-center gap-2.5 text-sm text-body">
            <input type="checkbox" checked={pinned} onChange={(event) => setPinned(event.target.checked)} className="size-4 accent-[var(--accent)]" />
            <Pin className="size-4 text-muted" aria-hidden="true" />Pin to top
          </label>
          <label className="flex items-center gap-2.5 text-sm text-body">
            <input type="checkbox" checked={isTemplate} onChange={(event) => setIsTemplate(event.target.checked)} className="size-4 accent-[var(--accent)]" />
            <FileText className="size-4 text-muted" aria-hidden="true" />Save as a reusable template
          </label>
        </div>

        <div className="space-y-4 rounded-lg border border-line bg-raised p-4 shadow-[var(--shadow-sm)]">
          <p className="font-serif text-lg text-ink">Links</p>
          {errors.link ? <p className="text-xs text-danger">{errors.link}</p> : null}
          <Field label="Linked trade" htmlFor="note-trade" hint="Connect this note to a trade in your log.">
            <select id="note-trade" value={linkedTradeId} onChange={(event) => setLinkedTradeId(event.target.value)} className={selectClass}>
              <option value="">No linked trade</option>
              {tradeOptions.map((trade) => <option key={trade.id} value={trade.id}>{trade.label}</option>)}
            </select>
          </Field>
          <Field label="Linked playbook" htmlFor="note-playbook">
            <select id="note-playbook" value={linkedPlaybookId} onChange={(event) => setLinkedPlaybookId(event.target.value)} className={selectClass}>
              <option value="">No linked playbook</option>
              {playbookOptions.map((playbook) => <option key={playbook.id} value={playbook.id}>{playbook.name}</option>)}
            </select>
          </Field>
        </div>

        <div className="flex flex-col gap-2">
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : mode === "create" ? "Create note" : "Save changes"}</Button>
          <Button asChild variant="ghost"><Link href={note ? `/notes/${note.id}` : "/notes"}>Cancel</Link></Button>
        </div>
      </aside>
    </form>

    {mode === "edit" && note ? (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-page p-3">
        <span className="flex items-center gap-2 text-sm text-muted"><NotebookPen className="size-4" aria-hidden="true" />Manage this note</span>
        <div className="flex gap-2">
          <PinForm noteId={note.id} pinned={note.pinned} />
          <ArchiveForm noteId={note.id} />
        </div>
      </div>
    ) : null}
    </div>
  );
}

/** Standalone forms so pin/archive do not nest inside the editor form. */
function PinForm({ noteId, pinned }: { noteId: string; pinned: boolean }) {
  return (
    <form action={togglePinAction}>
      <input type="hidden" name="noteId" value={noteId} />
      <input type="hidden" name="pinned" value={pinned ? "false" : "true"} />
      <Button type="submit" variant="outline" size="compact" className={cn(pinned && "border-line-strong bg-accent-soft text-ink")}>
        <Pin aria-hidden="true" />{pinned ? "Unpin" : "Pin"}
      </Button>
    </form>
  );
}

function ArchiveForm({ noteId }: { noteId: string }) {
  return (
    <form action={archiveNoteAction}>
      <input type="hidden" name="noteId" value={noteId} />
      <Button type="submit" variant="ghost" size="compact" className="text-danger hover:bg-danger/10">
        <Trash2 aria-hidden="true" />Archive
      </Button>
    </form>
  );
}
