"use client";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Mathematics from "@tiptap/extension-mathematics";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect } from "react";

export function TiptapNoteEditor({
  content,
  onChange,
}: {
  content: string;
  onChange: (html: string) => void;
}) {
  // if content is plain text/markdown (not HTML), wrap so Tiptap displays it
  const initialContent = content && !content.trimStart().startsWith("<")
    ? `<p>${content.replace(/\n/g, "</p><p>")}</p>`
    : content || "<p></p>";

  const editor = useEditor({
    extensions: [
      StarterKit,
      Mathematics,
      Placeholder.configure({
        placeholder: "Start writing… type $…$ for inline math, $$…$$ for block math",
      }),
    ],
    content: initialContent,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "outline-none min-h-[420px] px-6 py-5 text-sm text-[#111110] leading-relaxed",
      },
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const incoming = content && !content.trimStart().startsWith("<")
      ? `<p>${content.replace(/\n/g, "</p><p>")}</p>`
      : content || "<p></p>";
    if (current !== incoming) editor.commands.setContent(incoming, false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  if (!editor) return null;

  function Btn({ onClick, active, title, children }: {
    onClick: () => void; active: boolean; title: string; children: React.ReactNode;
  }) {
    return (
      <button
        onMouseDown={e => { e.preventDefault(); onClick(); }}
        title={title}
        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
          active ? "bg-[#111110] text-white" : "text-[#555] hover:text-[#111110] hover:bg-[rgba(0,0,0,0.05)]"
        }`}
      >
        {children}
      </button>
    );
  }

  const Sep = () => <span className="w-px h-4 bg-[rgba(0,0,0,0.08)] mx-0.5 shrink-0" />;

  return (
    <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-2xl overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-4 py-2.5 border-b border-[rgba(0,0,0,0.06)] flex-wrap">
        <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })} title="Heading 1">H1</Btn>
        <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Heading 2">H2</Btn>
        <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="Heading 3">H3</Btn>
        <Sep />
        <Btn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold"><b>B</b></Btn>
        <Btn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic"><i>I</i></Btn>
        <Btn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Strikethrough"><s>S</s></Btn>
        <Btn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive("code")} title="Inline code"><code>`</code></Btn>
        <Btn onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive("codeBlock")} title="Code block"><code>{ }</code></Btn>
        <Sep />
        <Btn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Bullet list">• List</Btn>
        <Btn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Numbered list">1. List</Btn>
        <Btn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Quote">"</Btn>
        <Sep />
        <Btn onClick={() => editor.chain().focus().insertContent("$$").run()} active={false} title="Inline math — type $…$">$ Math</Btn>
        <Sep />
        {["α","β","γ","δ","π","σ","Σ","∫","√","∞","±","≠","∈","∂"].map(sym => (
          <Btn key={sym} onClick={() => editor.chain().focus().insertContent(sym).run()} active={false} title={sym}>{sym}</Btn>
        ))}
      </div>

      {/* Editor area */}
      <EditorContent editor={editor} />

      <style>{`
        .tiptap p { margin: 0 0 0.5rem; }
        .tiptap h1 { font-size: 1.5rem; font-weight: 600; margin: 1rem 0 0.5rem; color: #111110; }
        .tiptap h2 { font-size: 1.2rem; font-weight: 600; margin: 0.8rem 0 0.4rem; color: #111110; }
        .tiptap h3 { font-size: 1rem;  font-weight: 600; margin: 0.6rem 0 0.3rem; color: #111110; }
        .tiptap ul  { list-style: disc;    padding-left: 1.4rem; margin: 0.3rem 0; }
        .tiptap ol  { list-style: decimal; padding-left: 1.4rem; margin: 0.3rem 0; }
        .tiptap li  { margin: 0.15rem 0; }
        .tiptap blockquote { border-left: 3px solid rgba(0,0,0,0.15); padding-left: 1rem; color: #666; margin: 0.5rem 0; }
        .tiptap code { background: rgba(0,0,0,0.05); border-radius: 4px; padding: 0.1em 0.35em; font-family: monospace; font-size: 0.85em; }
        .tiptap pre  { background: #f4f4f4; border-radius: 10px; padding: 1rem; overflow-x: auto; }
        .tiptap pre code { background: none; padding: 0; }
        .tiptap p.is-editor-empty:first-child::before { content: attr(data-placeholder); color: rgba(0,0,0,0.28); pointer-events: none; float: left; height: 0; }
        .tiptap .Tiptap-mathematics-editor { font-family: monospace; font-size: 0.85em; background: rgba(0,0,0,0.04); border-radius: 4px; padding: 0.1em 0.4em; outline: none; border: 1px solid rgba(0,0,0,0.1); }
        .tiptap .Tiptap-mathematics-render { display: inline-block; cursor: pointer; }
        .tiptap .Tiptap-mathematics-render:hover { background: rgba(0,0,0,0.04); border-radius: 4px; }
      `}</style>
    </div>
  );
}
