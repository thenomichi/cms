"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading2,
  Heading3,
  Undo,
  Redo,
  RemoveFormatting,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RichEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Lightweight WYSIWYG editor for trip descriptions.
 * Toolbar: Bold, Italic, H2, H3, Bullet List, Ordered List, Undo, Redo, Clear Formatting
 * Outputs clean HTML.
 */
export function RichEditor({ value, onChange, placeholder = "Start writing...", className }: RichEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none min-h-[120px] px-4 py-3 outline-none focus:outline-none text-ink [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1 [&_p]:text-sm [&_p]:leading-relaxed [&_p]:my-1 [&_ul]:text-sm [&_ul]:my-2 [&_ol]:text-sm [&_ol]:my-2 [&_li]:my-0.5",
      },
    },
  });

  if (!editor) return null;

  const btnClass = (active: boolean) =>
    cn(
      "flex h-7 w-7 items-center justify-center rounded transition-colors",
      active
        ? "bg-rust/10 text-rust"
        : "text-mid hover:bg-surface3 hover:text-ink",
    );

  return (
    <div className={cn("rounded-lg border border-line bg-surface overflow-hidden", className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 border-b border-line bg-surface2 px-2 py-1.5">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={btnClass(editor.isActive("bold"))}
          title="Bold"
        >
          <Bold className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={btnClass(editor.isActive("italic"))}
          title="Italic"
        >
          <Italic className="h-3.5 w-3.5" />
        </button>

        <div className="mx-1 h-4 w-px bg-line" />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={btnClass(editor.isActive("heading", { level: 2 }))}
          title="Heading"
        >
          <Heading2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={btnClass(editor.isActive("heading", { level: 3 }))}
          title="Subheading"
        >
          <Heading3 className="h-3.5 w-3.5" />
        </button>

        <div className="mx-1 h-4 w-px bg-line" />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={btnClass(editor.isActive("bulletList"))}
          title="Bullet List"
        >
          <List className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={btnClass(editor.isActive("orderedList"))}
          title="Numbered List"
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </button>

        <div className="mx-1 h-4 w-px bg-line" />

        <button
          type="button"
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
          className={btnClass(false)}
          title="Clear Formatting"
        >
          <RemoveFormatting className="h-3.5 w-3.5" />
        </button>

        <div className="flex-1" />

        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className={cn(btnClass(false), !editor.can().undo() && "opacity-30")}
          title="Undo"
        >
          <Undo className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className={cn(btnClass(false), !editor.can().redo() && "opacity-30")}
          title="Redo"
        >
          <Redo className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Editor content */}
      <EditorContent editor={editor} />
    </div>
  );
}
