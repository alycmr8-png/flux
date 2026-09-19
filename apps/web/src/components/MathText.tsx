"use client";
/**
 * MathText — renders AI-generated study text that mixes prose with LaTeX.
 *
 *   Display math: $$…$$  or  \[…\]
 *   Inline math:  $…$    or  \(…\)
 *   Literal dollar: \$
 *
 * Parsing lives in @sano/shared so web and mobile read notes identically. Prose
 * is always rendered as React text nodes; only KaTeX's own output is injected as
 * HTML. A fragment KaTeX cannot typeset is shown as readable symbols, never as
 * raw LaTeX. (The KaTeX stylesheet is imported once in app/layout.tsx; sizing
 * and alignment for .flux-math-* live in app/globals.css.)
 */
import { createElement, useEffect, useMemo, type CSSProperties, type ReactNode } from "react";
import katex from "katex";
// Chemistry notation: \ce{2H2 + O2 -> 2H2O}.
import "katex/contrib/mhchem";
import { formulaSegments, isBareLatex, latexToReadable, parseMath, type MathSegment } from "@sano/shared";

export { hasMathDelimiters, isBareLatex, parseMath, type MathSegment } from "@sano/shared";

// Rendering is pure for a given (tex, display) — cache it across re-renders.
const renderCache = new Map<string, string | null>();

/** KaTeX HTML for a fragment, or null when it can't be typeset. */
function renderTex(tex: string, displayMode: boolean): string | null {
  const key = `${displayMode ? "D" : "I"}${tex}`;
  const hit = renderCache.get(key);
  if (hit !== undefined) return hit;
  let html: string | null;
  try {
    html = katex.renderToString(tex, {
      displayMode,
      throwOnError: false,
      output: "htmlAndMathml",
      strict: "ignore",
    });
    // throwOnError:false renders a red error span instead of throwing — fall back to readable text.
    if (html.includes("katex-error")) html = null;
  } catch {
    html = null;
  }
  if (renderCache.size > 2000) renderCache.clear();
  renderCache.set(key, html);
  return html;
}

let copyTexLoaded = false;
/** Copying a selection with math puts its LaTeX source on the clipboard. */
function useCopyTex() {
  useEffect(() => {
    if (copyTexLoaded) return;
    copyTexLoaded = true;
    // @ts-ignore — the contrib module ships without type declarations
    import("katex/contrib/copy-tex").catch(() => { copyTexLoaded = false; });
  }, []);
}

function MathFragment({ tex, display }: { tex: string; display: boolean }) {
  const html = renderTex(tex, display);
  if (html === null) {
    const readable = latexToReadable(tex);
    return display
      ? <span className="flux-math-display flux-math-fallback">{readable}</span>
      : <span className="flux-math-fallback">{readable}</span>;
  }
  return (
    <span
      className={display ? "flux-math-display" : "flux-math-inline"}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

type Tag = "span" | "div" | "p" | "li";

export interface MathTextProps {
  text: string | number | null | undefined;
  /** Wrapper element. Defaults to span. Math is rendered with spans so it is valid inside p/button. */
  as?: Tag;
  className?: string;
  style?: CSSProperties;
}

function renderSegments(segments: MathSegment[]): ReactNode[] {
  return segments.map((seg, k) => {
    const node = seg.type === "text"
      ? seg.value
      : <MathFragment key={k} tex={seg.tex} display={seg.display} />;
    return seg.bold ? <strong key={k} style={{ fontWeight: 700 }}>{node}</strong> : seg.type === "text" ? <span key={k}>{node}</span> : node;
  });
}

function isPlain(segments: MathSegment[], source: string): boolean {
  return segments.length <= 1 && segments.every(seg => seg.type === "text" && !seg.bold && seg.value === source);
}

/** Mixed prose + LaTeX. Plain text renders as plain text. */
export function MathText({ text, as = "span", className, style }: MathTextProps) {
  const str = text == null ? "" : String(text);
  const segments = useMemo(() => parseMath(str), [str]);
  useCopyTex();
  return createElement(as, { className, style }, isPlain(segments, str) ? str : renderSegments(segments));
}

/**
 * For the "Formulas" block: an item may be a bare LaTeX expression with no
 * delimiters (e.g. `\frac{a}{b}`) — typeset those whole as display math.
 * Anything else goes through MathText (plain Unicode formulas stay text).
 */
export function FormulaText({ text, as = "div", className, style }: MathTextProps) {
  const str = text == null ? "" : String(text);
  const segments = useMemo(() => formulaSegments(str), [str]);
  useCopyTex();
  if (!isBareLatex(str)) return <MathText text={str} as={as} className={className} style={style} />;
  return createElement(as, { className, style }, renderSegments(segments));
}

export default MathText;
