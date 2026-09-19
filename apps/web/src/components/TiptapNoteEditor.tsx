"use client";
import { useEditor, EditorContent, Extension } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Mathematics, { migrateMathStrings } from "@tiptap/extension-mathematics";
// Chemistry formulas (\ce{…}) in the note's rendered maths.
import "katex/contrib/mhchem";
import Placeholder from "@tiptap/extension-placeholder";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { useEffect, useRef, useState } from "react";
import { MathComposer, type MathComposerResult } from "@/components/MathComposer";
import { SCIENCE_STRUCTURES, SCIENCE_SYMBOLS, type MathTemplate } from "@sano/shared";
import { useTr } from "@/lib/useTr";

// ─── Inline suggestion (autocomplete) ─────────────────────────────────────────
// A suggestion is shown as grey text right after the cursor. Tab accepts it; any
// edit, cursor move or Esc drops it. It is a decoration, never part of the note.

type Suggestion = { text: string; pos: number } | null;
const suggestionKey = new PluginKey<Suggestion>("noteSuggestion");

const InlineSuggestion = Extension.create({
  name: "inlineSuggestion",
  addProseMirrorPlugins() {
    return [
      new Plugin<Suggestion>({
        key: suggestionKey,
        state: {
          init: () => null,
          apply(tr, value) {
            const meta = tr.getMeta(suggestionKey);
            if (meta !== undefined) return meta as Suggestion;
            // Anything the student does makes the old suggestion stale.
            if (tr.docChanged || tr.selectionSet) return null;
            return value;
          },
        },
        props: {
          decorations(state) {
            const s = suggestionKey.getState(state);
            if (!s) return null;
            return DecorationSet.create(state.doc, [
              Decoration.widget(s.pos, () => {
                const span = document.createElement("span");
                span.className = "note-suggestion";
                span.textContent = s.text;
                return span;
              }, { side: 1 }),
            ]);
          },
        },
      }),
    ];
  },
  addKeyboardShortcuts() {
    return {
      Tab: ({ editor }) => {
        const s = suggestionKey.getState(editor.state);
        if (!s) return false;
        editor.chain().insertContentAt(s.pos, s.text).run();
        // Suggested maths arrives as $…$; turn it into rendered maths like typed maths.
        migrateMathStrings(editor);
        return true;
      },
      Escape: ({ editor }) => {
        if (!suggestionKey.getState(editor.state)) return false;
        editor.view.dispatch(editor.state.tr.setMeta(suggestionKey, null));
        return true;
      },
    };
  },
});

const SUGGEST_AFTER_MS = 900;
const SUGGEST_TIMEOUT_MS = 6000;

export function TiptapNoteEditor({
  content,
  onChange,
  complete,
  color = "#4B5FE8",
}: {
  content: string;
  onChange: (html: string) => void;
  /** Returns how the text before the cursor might continue ("" for no suggestion). */
  complete?: (before: string, signal: AbortSignal) => Promise<string>;
  color?: string;
}) {
  const tr = useTr();
  // The math writer: new formulas, or an existing one clicked in the note.
  const [composer, setComposer] = useState<{ latex: string; display: boolean; pos?: number } | null>(null);
  // The inline palette: open/closed, and whether a tap makes inline or block math.
  const [palette, setPalette] = useState(false);
  const [paletteDisplay, setPaletteDisplay] = useState(false);
  const openComposerRef = useRef(setComposer);
  openComposerRef.current = setComposer;
  const completeRef = useRef(complete);
  completeRef.current = complete;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // if content is plain text/markdown (not HTML), wrap so Tiptap displays it
  const initialContent = content && !content.trimStart().startsWith("<")
    ? `<p>${content.replace(/\n/g, "</p><p>")}</p>`
    : content || "<p></p>";

  const editor = useEditor({
    extensions: [
      StarterKit,
      Mathematics.configure({
        // Clicking a formula reopens it in the math writer.
        inlineOptions: { onClick: (node, pos) => openComposerRef.current({ latex: node.attrs.latex ?? "", display: false, pos }) },
        blockOptions: { onClick: (node, pos) => openComposerRef.current({ latex: node.attrs.latex ?? "", display: true, pos }) },
        katexOptions: { throwOnError: false },
      }),
      InlineSuggestion,
      Placeholder.configure({
        placeholder: "Start writing… press ∑ Formula to drop in an equation anywhere. Pause and Flux suggests the rest — Tab to accept.",
      }),
    ],
    content: initialContent,
    onUpdate: ({ editor, transaction }) => {
      onChange(editor.getHTML());
      if (!transaction.docChanged) return;
      // Ask for a suggestion once typing pauses; a new keystroke cancels the last ask.
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current?.abort();
      timerRef.current = setTimeout(async () => {
        const ask = completeRef.current;
        const { state } = editor;
        const { selection } = state;
        const $pos = selection.$head;
        // Only at the end of a paragraph, in plain text, with something to go on.
        if (!ask || !selection.empty || $pos.parentOffset !== $pos.parent.content.size) return;
        if ($pos.parent.type.name === "codeBlock") return;
        const pos = selection.head;
        const before = state.doc.textBetween(Math.max(0, pos - 1500), pos, "\n", " ");
        if (before.trim().length < 12 || /\n\s*$/.test(before)) return;
        const controller = new AbortController();
        abortRef.current = controller;
        const timeout = setTimeout(() => controller.abort(), SUGGEST_TIMEOUT_MS);
        try {
          const text = await ask(before, controller.signal);
          // Still exactly where it was asked for?
          if (!text || controller.signal.aborted || editor.isDestroyed) return;
          if (editor.state.doc !== state.doc || editor.state.selection.head !== pos) return;
          editor.view.dispatch(editor.state.tr.setMeta(suggestionKey, { text, pos }));
        } catch { /* no suggestion this time */ } finally {
          clearTimeout(timeout);
        }
      }, SUGGEST_AFTER_MS);
    },
    editorProps: {
      attributes: {
        class: "outline-none min-h-[480px] px-7 py-6 text-[18px] text-[#0f1115] leading-[1.8]",
      },
    },
    immediatelyRender: false,
  });

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    abortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const incoming = content && !content.trimStart().startsWith("<")
      ? `<p>${content.replace(/\n/g, "</p><p>")}</p>`
      : content || "<p></p>";
    if (current !== incoming) editor.commands.setContent(incoming);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  if (!editor) return null;

  /**
   * A palette tap writes the notation into the note there and then. Editing an
   * existing formula still opens the small editor, reached by clicking it.
   */
  function insertFromPalette(t: MathTemplate) {
    if (!editor) return;
    const latex = t.latex.trim();
    if (!latex) return;
    const chain = editor.chain().focus();
    (paletteDisplay ? chain.insertBlockMath({ latex }) : chain.insertInlineMath({ latex })).run();
  }

  function applyMath({ latex, display }: MathComposerResult) {
    if (!editor || !latex) return;
    const target = composer;
    setComposer(null);
    const chain = editor.chain().focus();
    if (target?.pos !== undefined) {
      const node = editor.state.doc.nodeAt(target.pos);
      const wasBlock = node?.type.name === "blockMath";
      if (wasBlock === display) {
        (display ? chain.updateBlockMath({ latex, pos: target.pos }) : chain.updateInlineMath({ latex, pos: target.pos })).run();
        return;
      }
      // Moved between "in the sentence" and "on its own line": replace the node.
      chain.deleteRange({ from: target.pos, to: target.pos + (node?.nodeSize ?? 1) }).run();
      editor.chain().focus().setTextSelection(target.pos)[display ? "insertBlockMath" : "insertInlineMath"]({ latex }).run();
      return;
    }
    (display ? chain.insertBlockMath({ latex }) : chain.insertInlineMath({ latex })).run();
  }

  function Btn({ onClick, active, title, children }: {
    onClick: () => void; active: boolean; title: string; children: React.ReactNode;
  }) {
    return (
      <button
        onMouseDown={e => { e.preventDefault(); onClick(); }}
        title={title}
        className={`px-2.5 py-1.5 rounded-lg text-[15px] font-medium transition-colors ${
          active ? "bg-indigo-600 text-white" : "text-gray-600 hover:text-gray-900 hover:bg-[rgba(0,0,0,0.06)]"
        }`}
      >
        {children}
      </button>
    );
  }

  const Sep = () => <span className="w-px h-4 bg-[rgba(0,0,0,0.08)] mx-0.5 shrink-0" />;

  return (
    <div className="bg-[#FFFFFF] border border-[rgba(0,0,0,0.08)] rounded-2xl overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-4 py-3 border-b border-[rgba(0,0,0,0.07)] flex-wrap">
        <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })} title={tr("Heading 1")}>H1</Btn>
        <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title={tr("Heading 2")}>H2</Btn>
        <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title={tr("Heading 3")}>H3</Btn>
        <Sep />
        <Btn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title={tr("Bold")}><b>B</b></Btn>
        <Btn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title={tr("Italic")}><i>I</i></Btn>
        <Btn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title={tr("Strikethrough")}><s>S</s></Btn>
        <Btn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive("code")} title={tr("Inline code")}><code>`</code></Btn>
        <Btn onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive("codeBlock")} title={tr("Code block")}><code>{ }</code></Btn>
        <Sep />
        <Btn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title={tr("Bullet list")}>• List</Btn>
        <Btn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title={tr("Numbered list")}>1. List</Btn>
        <Btn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title={tr("Quote")}>"</Btn>
        <Sep />
        <button
          onMouseDown={e => { e.preventDefault(); setPalette(o => !o); }}
          aria-expanded={palette}
          title={tr("Insert a science expression — maths, chemistry, physics, dosage, statistics")}
          className="ml-1 flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[15px] font-semibold"
          style={palette
            ? { background: "#0f1115", color: "#FFFFFF" }
            : { background: color, color: "#FFFFFF" }}
        >
          <span className="text-[17px] leading-none">∑</span>{tr("Formula")}</button>
      </div>

      {/* The expression palette lives in the editor, not over it: the note stays
          visible and a tap drops the notation straight in at the cursor. */}
      {palette && (
        <div className="px-4 py-3 border-b border-[rgba(0,0,0,0.07)]" style={{ background: "rgba(0,0,0,0.015)" }}>
          <div className="flex items-center gap-2 mb-2.5">
            <span className="text-[12px] font-bold uppercase tracking-[0.12em]" style={{ color: "rgba(15,17,21,0.5)" }}>
              {tr("Tap to drop it into your note")}
            </span>
            <div className="ml-auto flex rounded-full p-0.5" style={{ background: "rgba(0,0,0,0.06)" }}>
              {([[false, tr("In the sentence")], [true, tr("On its own line")]] as const).map(([value, label]) => (
                <button key={label} onMouseDown={e => { e.preventDefault(); setPaletteDisplay(value); }}
                  className="rounded-full px-3 py-1 text-[13px] font-semibold"
                  style={paletteDisplay === value
                    ? { background: "#FFFFFF", color: "#0f1115", boxShadow: "0 1px 2px rgba(0,0,0,0.12)" }
                    : { color: "rgba(15,17,21,0.7)" }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-2">
            {SCIENCE_STRUCTURES.map(t => (
              <button key={t.latex} title={t.title}
                onMouseDown={e => { e.preventDefault(); insertFromPalette(t); }}
                className="min-w-[44px] rounded-xl px-2.5 py-1.5 text-[16px] bg-white transition-colors hover:bg-black/[0.04]"
                style={{ border: "1px solid rgba(0,0,0,0.12)", color: "#0f1115" }}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {SCIENCE_SYMBOLS.map(t => (
              <button key={t.latex} title={t.title}
                onMouseDown={e => { e.preventDefault(); insertFromPalette(t); }}
                className="min-w-[36px] rounded-lg px-2 py-1 text-[15px] transition-colors hover:bg-black/[0.08]"
                style={{ background: `${color}12`, color: "#0f1115" }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Editor area */}
      <EditorContent editor={editor} />

      <MathComposer
        open={!!composer}
        initialLatex={composer?.latex ?? ""}
        initialDisplay={composer?.display ?? false}
        editing={composer?.pos !== undefined}
        color={color}
        onInsert={applyMath}
        onClose={() => setComposer(null)}
      />

      <style>{`
        .tiptap p { margin: 0 0 0.6rem; }
        .tiptap h1 { font-size: 1.9rem; font-weight: 700; margin: 1.1rem 0 0.5rem; color: #0f1115; }
        .tiptap h2 { font-size: 1.5rem; font-weight: 700; margin: 0.9rem 0 0.4rem; color: #0f1115; }
        .tiptap h3 { font-size: 1.25rem; font-weight: 700; margin: 0.7rem 0 0.3rem; color: #0f1115; }
        .tiptap ul  { list-style: disc;    padding-left: 1.4rem; margin: 0.3rem 0; }
        .tiptap ol  { list-style: decimal; padding-left: 1.4rem; margin: 0.3rem 0; }
        .tiptap li  { margin: 0.15rem 0; }
        .tiptap blockquote { border-left: 3px solid rgba(0,0,0,0.15); padding-left: 1rem; color: #666; margin: 0.5rem 0; }
        .tiptap code { background: rgba(0,0,0,0.05); border-radius: 4px; padding: 0.1em 0.35em; font-family: monospace; font-size: 0.85em; }
        .tiptap pre  { background: #f4f4f4; border-radius: 10px; padding: 1rem; overflow-x: auto; }
        .tiptap pre code { background: none; padding: 0; }
        .tiptap .note-suggestion { color: rgba(15,17,21,0.42); pointer-events: none; }
        .tiptap .note-suggestion::after { content: "Tab"; margin-left: 6px; padding: 0 5px; border-radius: 4px; font-size: 0.72em; vertical-align: 1px; color: rgba(15,17,21,0.55); border: 1px solid rgba(15,17,21,0.18); }
        .tiptap p.is-editor-empty:first-child::before { content: attr(data-placeholder); color: rgba(0,0,0,0.28); pointer-events: none; float: left; height: 0; }
        .tiptap .Tiptap-mathematics-editor { font-family: monospace; font-size: 0.85em; background: rgba(0,0,0,0.04); border-radius: 4px; padding: 0.1em 0.4em; outline: none; border: 1px solid rgba(0,0,0,0.1); }
        .tiptap .Tiptap-mathematics-render { display: inline-block; cursor: pointer; }
        .tiptap .Tiptap-mathematics-render:hover { background: rgba(0,0,0,0.04); border-radius: 4px; }
        .tiptap [data-type="inline-math"], .tiptap [data-type="block-math"] { cursor: pointer; border-radius: 6px; transition: background 0.15s; }
        .tiptap [data-type="inline-math"]:hover, .tiptap [data-type="block-math"]:hover { background: rgba(75,95,232,0.08); }
        .tiptap .katex { font-size: 1.08em; }
        .tiptap [data-type="block-math"] { display: block; margin: 0.6rem 0; padding: 0.25rem 1rem; }
      `}</style>
    </div>
  );
}
