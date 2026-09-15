/**
 * MathText — renders AI-generated study text that mixes prose with LaTeX.
 *
 *   Display math: $$…$$  or  \[…\]
 *   Inline math:  $…$    or  \(…\)
 *   Literal dollar: \$
 *
 * Parsing lives in @sano/shared, so web and mobile read notes identically.
 * Text without maths renders as native <Text> (bold spans and bullets included).
 * Text with maths renders in a small auto-sized WebView: KaTeX runs here in JS
 * (renderToString), prose is HTML-escaped, and the page only loads KaTeX's CSS
 * and fonts from the CDN. A fragment KaTeX rejects shows as readable symbols.
 */
import { memo, useCallback, useMemo, useState } from "react";
import { Dimensions, StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import katex from "katex";
import { formulaSegments, latexToReadable, parseMath, type MathSegment } from "@sano/shared";

export { formulaSegments, hasMathDelimiters, isBareLatex, parseMath, type MathSegment } from "@sano/shared";

// ─── HTML building ────────────────────────────────────────────────────────────

// Pinned to the bundled KaTeX version so the CSS/fonts always match renderToString's markup.
const KATEX_CSS = `https://cdn.jsdelivr.net/npm/katex@${katex.version}/dist/katex.min.css`;

const renderCache = new Map<string, string | null>();

/** KaTeX HTML for a fragment, or null when it can't be typeset. */
function renderTex(tex: string, displayMode: boolean): string | null {
  const key = `${displayMode ? "D" : "I"}${tex}`;
  const hit = renderCache.get(key);
  if (hit !== undefined) return hit;
  let html: string | null;
  try {
    html = katex.renderToString(tex, { displayMode, throwOnError: false, strict: "ignore", output: "html" });
    // throwOnError:false renders a red error span instead of throwing — show the raw source instead.
    if (html.includes("katex-error")) html = null;
  } catch {
    html = null;
  }
  if (renderCache.size > 2000) renderCache.clear();
  renderCache.set(key, html);
  return html;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Only allow characters a CSS value needs — style values never break out of the <style>. */
function cssValue(v: unknown): string | null {
  if (v === undefined || v === null || v === "") return null;
  const str = String(v);
  return /^[#a-zA-Z0-9().,%\s-]+$/.test(str) ? str : null;
}

function segmentsHtml(segments: MathSegment[]): string {
  return segments.map(seg => {
    let html: string;
    if (seg.type === "text") {
      html = `<span class="t">${escapeHtml(seg.value)}</span>`;
    } else {
      const typeset = renderTex(seg.tex, seg.display);
      if (typeset === null) {
        const readable = escapeHtml(latexToReadable(seg.tex));
        html = seg.display ? `<div class="d f">${readable}</div>` : `<span class="f">${readable}</span>`;
      } else {
        html = seg.display ? `<div class="d">${typeset}</div>` : `<span class="m">${typeset}</span>`;
      }
    }
    return seg.bold ? `<b>${html}</b>` : html;
  }).join("");
}

function textCss(st: TextStyle): string {
  const rules: string[] = [];
  const px = (n: unknown) => (typeof n === "number" ? `${n}px` : null);
  const add = (prop: string, value: string | null) => { if (value) rules.push(`${prop}:${value}`); };
  add("font-size", px(st.fontSize ?? 14));
  add("line-height", px(st.lineHeight));
  add("color", cssValue(st.color ?? "#000"));
  add("font-weight", cssValue(st.fontWeight));
  add("font-style", cssValue(st.fontStyle));
  add("letter-spacing", px(st.letterSpacing));
  add("text-align", cssValue(st.textAlign));
  add("text-transform", cssValue(st.textTransform));
  return rules.join(";");
}

// Posts the content height now, after fonts load, and whenever layout changes.
const MEASURE_JS = `(function(){
  var root=document.getElementById('r'),last=0;
  function post(){
    var h=Math.ceil(root.getBoundingClientRect().height);
    if(h&&h!==last){last=h;window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(String(h));}
  }
  post();
  if(document.fonts&&document.fonts.ready){document.fonts.ready.then(post);}
  window.addEventListener('load',post);
  if(window.ResizeObserver){new ResizeObserver(post).observe(root);}
  setTimeout(post,300);setTimeout(post,1200);
})();`;

function buildHtml(body: string, style: TextStyle, lead: string): string {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="${KATEX_CSS}">
<style>
html,body{margin:0;padding:0;background:transparent;-webkit-text-size-adjust:100%;text-size-adjust:100%;overflow:hidden}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;${textCss(style)};word-wrap:break-word;overflow-wrap:break-word;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
#r{padding:0;margin:0}
.t{white-space:pre-wrap}
b{font-weight:700}
.m .katex,.d .katex{text-transform:none;letter-spacing:normal;font-size:1.1em}
.d{display:block;max-width:100%;overflow-x:auto;overflow-y:hidden;padding:0.1em 0 0.1em 1em;margin:0.45em 0;-webkit-overflow-scrolling:touch}
.d .katex-display{margin:0;text-align:left}
.d .katex-display>.katex{text-align:left}
.f{font-family:"Cambria Math","STIX Two Math","Times New Roman",serif}
#r>.d:first-child{margin-top:0}#r>.d:last-child{margin-bottom:0}
${lead}
</style></head><body><div id="r">${body}</div><script>${MEASURE_JS}</script></body></html>`;
}

// ─── Component ────────────────────────────────────────────────────────────────

const LAYOUT_KEYS = [
  "flex", "flexGrow", "flexShrink", "flexBasis", "alignSelf", "width", "maxWidth", "minWidth",
  "margin", "marginTop", "marginBottom", "marginLeft", "marginRight", "marginHorizontal", "marginVertical",
] as const;

// Measured heights survive remounts (tab switches, flipping a card back) so they don't jump.
const heightCache = new Map<string, number>();

export interface MathTextProps {
  text: string | number | null | undefined;
  /** The Text style you'd otherwise use: font size, colour, weight, line height (+ margins/flex). */
  style?: StyleProp<TextStyle>;
  /** Allow touches on the math (horizontal scroll of wide equations). Leave off inside touchables. */
  interactive?: boolean;
  /** Optional leading run in a different style, e.g. a bold key term before its definition. */
  lead?: { text: string; style?: StyleProp<TextStyle> };
  numberOfLines?: number;
  /** Formulas-block item: delimiter-less LaTeX (\frac, ^, _) is typeset as display math. */
  formula?: boolean;
}

function MathTextImpl({ text, style, interactive, lead, numberOfLines, formula }: MathTextProps) {
  const str = text == null ? "" : String(text);
  const leadStr = lead?.text ?? "";
  const segments = useMemo(() => (formula ? formulaSegments(str) : parseMath(str)), [str, formula]);
  const leadSegments = useMemo(() => parseMath(leadStr), [leadStr]);
  const hasMath = segments.some(seg => seg.type === "math") || leadSegments.some(seg => seg.type === "math");

  if (!hasMath) {
    const runs = (list: MathSegment[]) =>
      list.map((seg, k) => (seg.bold ? <Text key={k} style={styles.bold}>{seg.type === "text" ? seg.value : ""}</Text> : seg.type === "text" ? seg.value : ""));
    return (
      <Text style={style} numberOfLines={numberOfLines}>
        {lead ? <Text style={lead.style}>{runs(leadSegments)}</Text> : null}
        {runs(segments)}
      </Text>
    );
  }
  return <MathWebView text={str} style={style} interactive={interactive} lead={lead} formula={formula} />;
}

function MathWebView({ text, style, interactive, lead, formula }: Omit<MathTextProps, "text" | "numberOfLines"> & { text: string }) {
  const flat = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  const leadFlat = (StyleSheet.flatten(lead?.style) ?? {}) as TextStyle;
  const leadStr = lead?.text ?? "";

  const html = useMemo(() => {
    const leadHtml = leadStr ? `<span class="lead">${segmentsHtml(parseMath(leadStr))}</span>` : "";
    const leadCss = leadStr ? `.lead{${textCss({ ...flat, ...leadFlat })}}` : "";
    const segments = formula ? formulaSegments(text) : parseMath(text);
    return buildHtml(leadHtml + segmentsHtml(segments), flat, leadCss);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, leadStr, formula, JSON.stringify(flat), JSON.stringify(leadFlat)]);

  const [width, setWidth] = useState(0);
  const cacheKey = `${Math.round(width)}|${html}`;
  // Tagged with its key so a content change (e.g. flipping a card) doesn't reuse a stale height.
  const [measured, setMeasured] = useState<{ key: string; h: number } | null>(null);

  const layoutStyle: ViewStyle = {};
  for (const k of LAYOUT_KEYS) if (flat[k] !== undefined) (layoutStyle as any)[k] = flat[k];

  const fontSize = flat.fontSize ?? 14;
  const lineHeight = flat.lineHeight ?? Math.round(fontSize * 1.4);
  const estimate = useMemo(() => {
    const w = width || Dimensions.get("window").width * 0.8;
    const charsPerLine = Math.max(10, Math.floor(w / (fontSize * 0.52)));
    let lines = 0;
    let displays = 0;
    for (const seg of [...parseMath(leadStr), ...(formula ? formulaSegments(text) : parseMath(text))]) {
      if (seg.type === "math" && seg.display) { displays++; continue; }
      const value = seg.type === "text" ? seg.value : seg.tex;
      for (const line of value.split("\n")) lines += Math.max(1, Math.ceil(line.length / charsPerLine));
    }
    return Math.ceil(Math.max(1, lines) * lineHeight + displays * Math.max(lineHeight * 2.2, fontSize * 3));
  }, [text, leadStr, formula, width, fontSize, lineHeight]);

  const height = (measured?.key === cacheKey ? measured.h : undefined) ?? heightCache.get(cacheKey) ?? estimate;

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setWidth(prev => (Math.abs(prev - w) >= 1 ? w : prev));
  }, []);

  const onMessage = useCallback((e: WebViewMessageEvent) => {
    const h = Number(e.nativeEvent.data);
    if (!Number.isFinite(h) || h <= 0) return;
    if (heightCache.size > 1000) heightCache.clear();
    heightCache.set(cacheKey, h);
    setMeasured(prev => (prev?.key === cacheKey && Math.abs(prev.h - h) < 1 ? prev : { key: cacheKey, h }));
  }, [cacheKey]);

  return (
    <View
      style={[styles.wrap, layoutStyle]}
      pointerEvents={interactive ? "auto" : "none"}
      onLayout={onLayout}
    >
      <WebView
        source={{ html }}
        originWhitelist={["*"]}
        style={[styles.web, { height }]}
        containerStyle={styles.webContainer}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        automaticallyAdjustContentInsets={false}
        onMessage={onMessage}
        setSupportMultipleWindows={false}
        textZoom={100}
        // The page is self-contained: block any navigation away from it.
        onShouldStartLoadWithRequest={req => !/^https?:/i.test(req.url)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bold: { fontWeight: "700" },
  wrap: { flexGrow: 1, flexShrink: 1, alignSelf: "stretch" },
  web: { backgroundColor: "transparent", width: "100%" },
  webContainer: { backgroundColor: "transparent", flex: 0 },
});

export const MathText = memo(MathTextImpl);
export default MathText;
