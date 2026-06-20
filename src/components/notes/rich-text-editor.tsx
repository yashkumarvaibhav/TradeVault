"use client";

import * as React from "react";
import { EditorContent, useEditor, type Editor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Heading2, Heading3, Italic, List, ListOrdered, Quote, Strikethrough } from "lucide-react";

import { cn } from "@/lib/utils";

const CONTENT_CLASS = cn(
  "min-h-52 w-full rounded-b-md border border-t-0 border-line bg-raised px-3 py-3 text-sm leading-relaxed text-ink outline-none",
  "focus-visible:border-line-strong [&_:focus]:outline-none",
  "[&_p]:my-1.5 [&_h2]:mt-3 [&_h2]:font-serif [&_h2]:text-xl [&_h2]:text-ink [&_h3]:mt-2.5 [&_h3]:font-semibold [&_h3]:text-ink",
  "[&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5",
  "[&_blockquote]:border-l-2 [&_blockquote]:border-line-strong [&_blockquote]:pl-3 [&_blockquote]:text-muted [&_strong]:font-semibold",
);

function ToolbarButton({ active, label, onClick, children }: { active?: boolean; label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={Boolean(active)}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "flex size-9 items-center justify-center rounded-md border border-transparent text-muted transition-colors hover:bg-hover hover:text-ink [&_svg]:size-4",
        active && "border-line-strong bg-accent-soft text-ink",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Accessible TipTap rich-text editor. Emits the ProseMirror JSON (for storage) and the plain
 * text (for search/excerpts) on every change. `onReady` exposes the editor for imperative
 * template insertion. Renders nothing server-side (`immediatelyRender: false`) to avoid
 * hydration mismatches under the App Router.
 */
export function RichTextEditor({
  initialContent,
  onChange,
  onReady,
  ariaLabel = "Note body",
}: {
  initialContent?: JSONContent | string;
  onChange: (json: string, text: string) => void;
  onReady?: (editor: Editor) => void;
  ariaLabel?: string;
}) {
  const emit = React.useCallback((editor: Editor) => onChange(JSON.stringify(editor.getJSON()), editor.getText()), [onChange]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit],
    content: initialContent ?? "",
    editorProps: {
      attributes: { role: "textbox", "aria-multiline": "true", "aria-label": ariaLabel, class: CONTENT_CLASS },
    },
    onUpdate: ({ editor }) => emit(editor),
  });

  const seeded = React.useRef(false);
  React.useEffect(() => {
    if (!editor) return;
    onReady?.(editor);
    if (!seeded.current) {
      seeded.current = true;
      emit(editor); // populate hidden inputs with the initial content
    }
  }, [editor, onReady, emit]);

  if (!editor) {
    return <div className="min-h-[16.5rem] rounded-md border border-line bg-raised" aria-hidden="true" />;
  }

  return (
    <div>
      <div role="toolbar" aria-label="Text formatting" className="flex flex-wrap gap-1 rounded-t-md border border-line bg-sidebar p-1.5">
        <ToolbarButton label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><Bold /></ToolbarButton>
        <ToolbarButton label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic /></ToolbarButton>
        <ToolbarButton label="Strikethrough" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough /></ToolbarButton>
        <span className="mx-1 w-px self-stretch bg-line" aria-hidden="true" />
        <ToolbarButton label="Heading" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 /></ToolbarButton>
        <ToolbarButton label="Subheading" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 /></ToolbarButton>
        <span className="mx-1 w-px self-stretch bg-line" aria-hidden="true" />
        <ToolbarButton label="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}><List /></ToolbarButton>
        <ToolbarButton label="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered /></ToolbarButton>
        <ToolbarButton label="Quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote /></ToolbarButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
