"use client";
/**
 * The science-expression writer in Take Note. One set of buttons covering maths,
 * chemistry, physics, statistics and clinical dosage notation — no subject to
 * pick first — and it shows typeset exactly as it will appear in the note.
 */
import { useEffect, useRef, useState } from "react";
import katex from "katex";
import "katex/contrib/mhchem";
import { X } from "lucide-react";
import { SCIENCE_STRUCTURES, SCIENCE_SYMBOLS, insertMathTemplate, type MathTemplate } from "@sano/shared";
import { MathText } from "@/components/MathText";
import { useTr } from "@/lib/useTr";

export type MathComposerResult = { latex: string; display: boolean };

export function MathComposer({
  open, initialLatex = "", initialDisplay = false, editing = false, color, onInsert, onClose,
}: {
  open: boolean;
  initialLatex?: string;
  initialDisplay?: boolean;
  /** Editing a formula already in the note (changes the button to tr("Update")). */
  editing?: boolean;
  color: string;
  onInsert: (result: MathComposerResult) => void;
  onClose: () => void;
}) {
  const tr = useTr();
  const [latex, setLatex] = useState(initialLatex);
  const [display, setDisplay] = useState(initialDisplay);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setLatex(initialLatex);
    setDisplay(initialDisplay);
    // Straight into the box, so typing works without a click.
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open, initialLatex, initialDisplay]);

  function applyTemplate(t: MathTemplate) {
    const el = inputRef.current;
    const start = el?.selectionStart ?? latex.length;
    const end = el?.selectionEnd ?? latex.length;
    const next = insertMathTemplate(latex, start, end, t);
    setLatex(next.text);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(next.selStart, next.selEnd);
    });
  }

  let valid = true;
  try { if (latex.trim()) katex.renderToString(latex, { throwOnError: true, displayMode: true }); } catch { valid = false; }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-6" style={{ background: "rgba(15,17,21,0.55)" }} onClick={onClose}>
      <div
        role="dialog"
        aria-label={tr("Write a science expression")}
        className="w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl flex flex-col"
        style={{ background: "#FFFFFF" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-6 pt-5 pb-4">
          <h2 className="text-[21px] font-bold" style={{ color: "#0f1115" }}>
            {editing ? tr("Edit expression") : tr("Write a science expression")}
          </h2>
          <button onClick={onClose} aria-label={tr("Close")} className="ml-auto p-1.5 rounded-lg hover:bg-black/5">
            <X size={20} style={{ color: "#0f1115" }} />
          </button>
        </div>

        <div className="px-6 space-y-4">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {SCIENCE_STRUCTURES.map(t => (
                <button key={t.latex} title={t.title} onClick={() => applyTemplate(t)}
                  className="min-w-[46px] rounded-xl px-2.5 py-2 text-[17px] transition-colors hover:bg-black/[0.04]"
                  style={{ border: "1px solid rgba(0,0,0,0.12)", color: "#0f1115" }}>
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              {SCIENCE_SYMBOLS.map(t => (
                <button key={t.latex} title={t.title} onClick={() => applyTemplate(t)}
                  className="min-w-[38px] rounded-lg px-2 py-1.5 text-[16px] transition-colors hover:bg-black/[0.05]"
                  style={{ background: `${color}10`, color: "#0f1115" }}>
                  {t.label}
                </button>
              ))}
            </div>
            <textarea
              ref={inputRef}
              id="math-latex"
              value={latex}
              onChange={e => setLatex(e.target.value)}
              rows={2}
              spellCheck={false}
              placeholder={"Tap the buttons above, or type like \\frac{a}{b} or \\ce{H2SO4}"}
              className="w-full rounded-xl px-4 py-3 text-[16px] outline-none font-mono"
              style={{ border: "1.5px solid rgba(0,0,0,0.12)", color: "#0f1115" }}
            />
          </div>

          {/* What goes into the note */}
          <div className="rounded-2xl px-5 py-4 min-h-[88px] flex items-center justify-center" style={{ background: `${color}0A`, border: `1px solid ${color}30` }}>
            {latex.trim() ? (
              valid
                ? <MathText as="div" className="text-[20px] w-full text-center" style={{ color: "#0f1115" }} text={`$$${latex}$$`} />
                : <span className="text-[15px]" style={{ color: "#B91C1C" }}>{tr("This isn't a complete formula yet — check the brackets.")}</span>
            ) : (
              <span className="text-[15px]" style={{ color: "rgba(15,17,21,0.6)" }}>{tr("Your formula appears here, typeset.")}</span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 px-6 py-5 mt-2">
          <div className="flex rounded-full p-1" style={{ background: "rgba(0,0,0,0.05)" }} role="radiogroup" aria-label={tr("Placement")}>
            {([[false, tr("In the sentence")], [true, tr("On its own line")]] as const).map(([value, label]) => (
              <button key={label} role="radio" aria-checked={display === value} onClick={() => setDisplay(value)}
                className="rounded-full px-3.5 py-1.5 text-[14.5px] font-semibold"
                style={display === value ? { background: "#FFFFFF", color: "#0f1115", boxShadow: "0 1px 3px rgba(0,0,0,0.12)" } : { color: "rgba(15,17,21,0.7)" }}>
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={() => onInsert({ latex: latex.trim(), display })}
            disabled={!latex.trim() || !valid}
            className="ml-auto rounded-full px-6 py-2.5 text-[16px] font-semibold text-white disabled:opacity-40"
            style={{ background: color }}
          >
            {editing ? tr("Update") : tr("Insert")}
          </button>
        </div>
      </div>
    </div>
  );
}
