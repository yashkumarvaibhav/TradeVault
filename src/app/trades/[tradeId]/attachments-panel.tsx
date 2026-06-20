"use client";

import * as React from "react";
import { useActionState } from "react";
import { AlertCircle, FileText, Paperclip, Trash2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { deleteAttachmentAction, updateAttachmentCaptionAction, uploadAttachmentAction, type AttachmentState } from "./attachment-actions";

export interface AttachmentView {
  id: string;
  contentType: string;
  originalName: string;
  caption: string | null;
  sizeBytes: number;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentsPanel({ tradeId, attachments }: { tradeId: string; attachments: AttachmentView[] }) {
  const [state, formAction, pending] = useActionState<AttachmentState, FormData>(uploadAttachmentAction, {});
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <section className="rounded-lg border border-line bg-raised p-5">
      <div className="flex items-center gap-2">
        <Paperclip className="size-4 text-muted" aria-hidden="true" />
        <h2 className="font-serif text-lg text-ink">Media &amp; attachments</h2>
      </div>
      <p className="mt-1 text-sm text-muted">Chart screenshots or notes (PNG, JPEG, WebP, or PDF · up to 5 MB each). Private to your workspace.</p>

      <form ref={formRef} action={formAction} className="mt-4 space-y-3 rounded-md border border-line bg-page p-4">
        <input type="hidden" name="tradeId" value={tradeId} />
        <div className="space-y-1.5">
          <Label htmlFor="attachment-file">File</Label>
          <input
            id="attachment-file"
            name="file"
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            required
            className="block w-full text-sm text-body file:mr-3 file:min-h-9 file:rounded-md file:border file:border-line file:bg-raised file:px-3 file:text-sm file:font-semibold file:text-ink hover:file:bg-hover"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="attachment-caption">Caption (optional)</Label>
          <Input id="attachment-caption" name="caption" maxLength={300} placeholder="e.g. 5-min breakout entry" />
        </div>
        {state.error ? (
          <p role="alert" className="flex items-center gap-2 text-sm text-danger">
            <AlertCircle className="size-4" aria-hidden="true" />{state.error}
          </p>
        ) : null}
        <Button type="submit" disabled={pending}><Upload aria-hidden="true" />{pending ? "Uploading…" : "Upload attachment"}</Button>
      </form>

      {attachments.length === 0 ? (
        <p className="mt-4 text-sm text-faint">No attachments yet.</p>
      ) : (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          {attachments.map((attachment) => {
            const isImage = attachment.contentType.startsWith("image/");
            const href = `/api/attachments/${attachment.id}`;
            return (
              <li key={attachment.id} className="overflow-hidden rounded-md border border-line bg-page">
                {isImage ? (
                  <a href={href} target="_blank" rel="noreferrer" className="block bg-sidebar">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={href} alt={attachment.caption || attachment.originalName} className="max-h-48 w-full object-contain" loading="lazy" />
                  </a>
                ) : (
                  <a href={href} target="_blank" rel="noreferrer" className="flex items-center gap-3 bg-sidebar p-4 text-sm font-semibold text-accent hover:underline">
                    <FileText className="size-6 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 truncate">{attachment.originalName}</span>
                  </a>
                )}
                <div className="space-y-2 p-3">
                  <form action={updateAttachmentCaptionAction} className="flex items-center gap-2">
                    <input type="hidden" name="tradeId" value={tradeId} />
                    <input type="hidden" name="attachmentId" value={attachment.id} />
                    <Input name="caption" defaultValue={attachment.caption ?? ""} maxLength={300} aria-label={`Caption for ${attachment.originalName}`} placeholder="Add a caption" className="h-9" />
                    <Button type="submit" variant="outline" size="compact">Save</Button>
                  </form>
                  <div className="flex items-center justify-between text-xs text-faint">
                    <span>{formatBytes(attachment.sizeBytes)}</span>
                    <form action={deleteAttachmentAction} onSubmit={(event) => { if (!confirm("Delete this attachment? This cannot be undone.")) event.preventDefault(); }}>
                      <input type="hidden" name="tradeId" value={tradeId} />
                      <input type="hidden" name="attachmentId" value={attachment.id} />
                      <button type="submit" className="inline-flex min-h-9 items-center gap-1 rounded-sm px-2 font-semibold text-danger hover:bg-danger/10">
                        <Trash2 className="size-3.5" aria-hidden="true" />Delete
                      </button>
                    </form>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
