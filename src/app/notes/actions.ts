"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createNoteRepository } from "@/db/repositories/notes";
import { getDb } from "@/db/server";
import { NOTE_COLLECTIONS, NOTE_TYPES, type NoteCollection, type NoteType, type RichTextDoc } from "@/lib/domain/notes";
import { requireWorkspaceSession } from "@/lib/workspace-session";

export interface NoteFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

function asType(value: FormDataEntryValue | null): NoteType {
  return (NOTE_TYPES as readonly string[]).includes(String(value)) ? (value as NoteType) : "general";
}

function asCollection(value: FormDataEntryValue | null): NoteCollection {
  return (NOTE_COLLECTIONS as readonly string[]).includes(String(value)) ? (value as NoteCollection) : "none";
}

/** Parse the editor's JSON payload, tolerating an empty/invalid body (plain notes stay fast). */
function parseBodyJson(raw: FormDataEntryValue | null): RichTextDoc | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as RichTextDoc;
    return parsed && typeof parsed === "object" && parsed.type === "doc" ? parsed : null;
  } catch {
    return null;
  }
}

/** Create or update a dedicated note. `noteId` (hidden field) decides the branch. */
export async function saveNoteAction(_previous: NoteFormState, formData: FormData): Promise<NoteFormState> {
  const { scope, account } = await requireWorkspaceSession();
  const repo = createNoteRepository(getDb(), scope);

  const noteId = String(formData.get("noteId") ?? "").trim();
  const input = {
    accountId: account.id,
    title: String(formData.get("title") ?? ""),
    bodyText: String(formData.get("bodyText") ?? ""),
    bodyJson: parseBodyJson(formData.get("bodyJson")),
    noteType: asType(formData.get("noteType")),
    collection: asCollection(formData.get("collection")),
    isTemplate: formData.get("isTemplate") === "on",
    pinned: formData.get("pinned") === "on",
    linkedTradeId: String(formData.get("linkedTradeId") ?? "").trim() || null,
    linkedPlaybookId: String(formData.get("linkedPlaybookId") ?? "").trim() || null,
  };

  if (!input.title.trim()) {
    return { error: "Give the note a title.", fieldErrors: { title: "A title is required." } };
  }

  let savedId = noteId;
  try {
    if (noteId) {
      const updated = await repo.update({ ...input, noteId });
      if (!updated) return { error: "This note is no longer available." };
      savedId = updated.id;
    } else {
      const created = await repo.create(input);
      savedId = created.id;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "The note could not be saved.";
    if (/linked (trade|playbook)/i.test(message)) return { error: message, fieldErrors: { link: message } };
    if (/title/i.test(message)) return { error: message, fieldErrors: { title: message } };
    console.error("save note failed", error);
    return { error: "The note could not be saved. Try again." };
  }

  revalidatePath("/notes");
  revalidatePath("/");
  redirect(`/notes/${savedId}?saved=1`);
}

export async function togglePinAction(formData: FormData): Promise<void> {
  const { scope, account } = await requireWorkspaceSession();
  const noteId = String(formData.get("noteId") ?? "").trim();
  const pinned = formData.get("pinned") === "true";
  await createNoteRepository(getDb(), scope).setPinned(account.id, noteId, pinned);
  revalidatePath("/notes");
  revalidatePath(`/notes/${noteId}`);
}

export async function archiveNoteAction(formData: FormData): Promise<void> {
  const { scope, account } = await requireWorkspaceSession();
  const noteId = String(formData.get("noteId") ?? "").trim();
  await createNoteRepository(getDb(), scope).archive(account.id, noteId);
  revalidatePath("/notes");
  revalidatePath("/");
  redirect("/notes?archived=1");
}
