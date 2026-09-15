import OpenAI from "openai";

let _openai: OpenAI | null = null;
function getClient() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 90000 });
  return _openai;
}

async function createWithRetry(params: any, retries = 3): Promise<any> {
  const models = [params.model, "gpt-4o-mini"];
  let modelIdx = 0;
  for (let i = 0; i < retries; i++) {
    try {
      const { system, messages, model, max_tokens, ...rest } = { ...params, model: models[modelIdx] };
      const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
      if (system) openaiMessages.push({ role: "system", content: system });
      if (messages) openaiMessages.push(...messages);
      return await getClient().chat.completions.create({
        ...rest,
        model,
        max_tokens,
        messages: openaiMessages,
      });
    } catch (err: any) {
      const status = err?.status ?? err?.error?.status;
      const isRetryable = status >= 500 || status === 429;
      if (isRetryable && i < retries - 1) {
        if (i >= 1 && models[1]) modelIdx = 1;
        const wait = (i + 1) * 3000;
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      throw err;
    }
  }
}

function extractText(msg: any): string {
  return msg?.choices?.[0]?.message?.content ?? "";
}

// LaTeX commands that begin with a letter JSON treats as an escape. A model that
// writes "\frac" instead of "\\frac" produces valid JSON that silently decodes to
// a form-feed followed by "rac", so these are recognised and re-escaped.
const LATEX_ON_JSON_ESCAPE = new Set([
  "bar", "backslash", "because", "begin", "beta", "big", "bigcap", "bigcup", "bigg", "biggl", "biggr", "bigl", "bigr",
  "binom", "bm", "bmod", "boldsymbol", "bot", "box", "breve", "bullet",
  "flat", "forall", "frac", "frown",
  "nabla", "ne", "nearrow", "neg", "neq", "newline", "nexists", "ngeq", "ni", "nleq", "nmid", "not", "notin", "nparallel", "nu", "nwarrow",
  "rangle", "rbrace", "rceil", "rfloor", "rho", "right", "rightarrow", "rightharpoonup", "rightleftharpoons", "rm", "rvert", "rVert",
  "tan", "tanh", "tau", "text", "textbf", "textit", "textrm", "textstyle", "tfrac", "therefore", "theta", "tilde", "times", "to", "top",
  "triangle", "triangleq",
]);

/** Doubles every backslash that JSON would misread, so LaTeX survives JSON.parse. */
function escapeLatexInJson(raw: string): string {
  return raw.replace(/\\(u[0-9a-fA-F]{4}|[a-zA-Z]+|[\s\S])/g, (match, tail: string) => {
    if (/^u[0-9a-fA-F]{4}$/.test(tail)) return match;
    if (tail.length === 1 && `"\\/`.includes(tail)) return match;
    if (/^[a-zA-Z]+$/.test(tail)) {
      if ("bfnrt".includes(tail[0]) && !LATEX_ON_JSON_ESCAPE.has(tail)) return match; // a real \n, \t, ... escape
    }
    return "\\\\" + tail;
  });
}

function parseJsonObject(text: string): any {
  const raw = text.match(/\{[\s\S]*\}/)?.[0] ?? "{}";
  try {
    return normalizeMath(JSON.parse(escapeLatexInJson(raw)));
  } catch (err) {
    console.error(`[claude] unparseable JSON (${text.length} chars), ends: ${JSON.stringify(text.slice(-300))}`);
    throw err;
  }
}

/** JSON mode only returns objects, so list generators ask for {"items": [...]}. */
function parseJsonItems(text: string): any[] {
  const parsed = parseJsonObject(text);
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed?.items)) return parsed.items;
  return (Object.values(parsed ?? {}).find(Array.isArray) as any[]) ?? [];
}

async function batchPromises<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < tasks.length; i += limit) {
    const batch = tasks.slice(i, i + limit).map(t => t());
    results.push(...(await Promise.all(batch)));
  }
  return results;
}

const LANG_NAMES: Record<string, string> = {
  en: "English", fr: "French", ar: "Arabic", es: "Spanish", pt: "Portuguese",
};

// Transcripts come from speech recognition, so formulas arrive as words
// ("the integral of x squared"). Generated study material is typeset with KaTeX
// on web and mobile, and should read like a good tutor's handout — prose carries
// the reasoning, maths supports it.
const MATH_STYLE = `MATHEMATICS — WRITE IT LIKE A CLEAN TEXTBOOK:
Speech recognition spells maths out in words. Turn the maths into LaTeX and keep the explanation in ordinary sentences, the way a careful professor writes a handout.
Examples:
- "the integral of two x cosine of x squared d x" → the integral $\\int 2x\\cos(x^2)\\,dx$
- "let u equal x squared, so d u equals two x d x" → let $u = x^2$, so $du = 2x\\,dx$
- "the limit as x approaches zero of sine x over x equals one" → $\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1$
- "F equals m a, where m is mass and a is acceleration" → $F = ma$, where $m$ is the mass and $a$ the acceleration
- "sulfuric acid, H two S O four" → sulfuric acid ($\\mathrm{H_2SO_4}$)
Rules:
1. Only symbols go inside dollar signs; the words of the sentence stay outside them: the limit of $\\frac{\\sin x}{x}$ as $x \\to 0$ is $1$. Functions are commands (\\sin, \\cos, \\ln), never spelled out.
2. $...$ for maths inside a sentence. $$...$$ on its own line only for a key result or worked steps. Never \\( \\) or \\[ \\].
3. Worked steps are one block with the equals signs aligned:
   $$\\begin{aligned} \\int 2x\\cos(x^2)\\,dx &= \\int \\cos u\\,du \\\\ &= \\sin(x^2) + C \\end{aligned}$$
4. Write it as it is printed: \\sin x, \\ln x, \\frac{a}{b}, x^2, a_n, \\sqrt{x}, \\vec{v}, \\Delta E, \\leq, \\approx; a thin space before differentials (\\,dx); upright units ($9.8\\,\\mathrm{m/s^2}$); implied multiplication ($2x$, $mc^2$), with \\times only for dimensions ($3 \\times 3$) or powers of ten.
5. No Unicode look-alikes (x², ∫, ½) and no dollar signs for money — write USD.`;

// A recording and the photos attached to it are one lecture. The photos' text
// arrives under "[WRITTEN ON THE BOARD IN THIS LECTURE]" at the end of the transcript.
const ONE_LECTURE = `The material is ONE lecture: what the lecturer said, plus anything written on the board or slides (the section headed "[WRITTEN ON THE BOARD IN THIS LECTURE]", read from photos). Treat it as a single source — put what was written into the topics it belongs to, alongside what was said about it. Never create a separate section, point, card or question about the photos or the board.`;

// Lower than the default for steadier notation, but not too low: at 0.3 the
// models fell into repetition loops ("\\textstyle \\textstyle …") until the reply
// was cut off.
const STUDY_TEMPERATURE = 0.7;

// Short fields (options, card fronts) must stay one line, and JSON needs every
// backslash escaped.
const JSON_MATH_STYLE = `${MATH_STYLE}
In short fields (questions, quiz options, flashcard fronts, key points, terms) use inline $...$ only.
The output is JSON, so every LaTeX backslash is written twice inside strings ("$\\\\frac{a}{b}$", "$\\\\sin x$"), exactly as in the example.
Before returning, re-read every string: any formula still written in words must be rewritten in LaTeX.`;

// Models drift to \( \) and \[ \] even when told otherwise; the renderers accept
// both, but one convention keeps stored notes consistent.
function normalizeMathDelimiters(s: string): string {
  return s
    // Over-escaped JSON leaves a doubled backslash before a command, which KaTeX reads as a line break.
    .replace(/\\\\(?=[a-zA-Z])/g, "\\")
    // Keep notation uniform across notes and quizzes: \text{cos} → \cos, \text{d}x → dx.
    .replace(/\\(?:text|mathrm)\{\s*(sin|cos|tan|cot|sec|csc|ln|log|exp|lim|max|min|det|gcd|arcsin|arccos|arctan|sinh|cosh|tanh)\s*\}/g, "\\$1 ")
    .replace(/\\(?:text|mathrm)\{d\}(?=[a-zA-Z])/g, "d")
    // "\text{ }" used as a spacer (e.g. before dx) → a thin space.
    .replace(/\\text\{\s+\}/g, "\\,")
    // Double-escaped line breaks arrive as a literal "\n"; LaTeX commands starting with n are left alone.
    .replace(/\\n/g, (m, offset: number, str: string) => {
      const word = /^n[a-zA-Z]*/.exec(str.slice(offset + 1))?.[0] ?? "n";
      return word !== "n" && LATEX_ON_JSON_ESCAPE.has(word) ? m : "\n";
    })
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, m) => `$$${m.trim()}$$`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, m) => `$${m.trim()}$`)
    .replace(/\$\$((?:(?!\$\$)[\s\S])+)\$\$|\$((?:[^$\\\n]|\\.)+)\$/g, (m, display?: string, inline?: string) =>
      display !== undefined ? `$$${tidyTex(display)}$$` : liftProseOutOfMath(inline ?? "") ?? inlineMath(tidyTex(inline ?? "")))
    .replace(/ ?\{\{EMPTY_MATH\}\} ?/g, " ")
    .replace(/\\begin\{(aligned|align\*?|gathered|cases|array|[pbvV]?matrix)\}[\s\S]*?\\end\{\1\}/g, repairRowBreaks)
    .replace(/(?:\$\$(?:(?!\$\$)[\s\S])+\$\$\s*){2,}/g, mergeDerivation)
    .replace(/\$\$((?:(?!\$\$)[\s\S])+)\$\$([.,;:])(?=\s|$)/g, (_, tex: string, punct: string) => {
      const body = tex.trimEnd();
      return /\\end\{aligned\}$/.test(body)
        ? `$$${body.replace(/\s*\\end\{aligned\}$/, `${punct} \\end{aligned}`)}$$`
        : `$$${body}${punct}$$`;
    });
}

const FN = "sin|cos|tan|cot|sec|csc|sinh|cosh|tanh|ln|log|exp";

/**
 * Small fixes a person typesetting by hand would make: \sin(u) → \sin u,
 * 2x \times \cos x → 2x \cos x, a thin space before differentials, and no
 * stray spacing commands after function names.
 */
// Marks where an inline fragment tidied down to nothing; collapsed with its
// neighbouring spaces afterwards so no "$$" or double space is left behind.
const EMPTY_MATH = "{{EMPTY_MATH}}";

function inlineMath(tex: string): string {
  return tex.trim() ? `$${tex}$` : EMPTY_MATH;
}

function tidyTex(tex: string): string {
  let t = tex
    .replace(/\\(?:textstyle|displaystyle|scriptstyle)\s*/g, "")
    .replace(/\\(?:text|mathrm)\{\s*d\s*\}\s*([a-zA-Z])(?![a-zA-Z])/g, "\\,d$1")
    .replace(/\\(?:text|mathrm|operatorname)\{\s*(sine|cosine|tangent|log|ln|exp|natural log)\s*\}\s*/g, (_m, name: string) =>
      `\\${({ sine: "sin", cosine: "cos", tangent: "tan", "natural log": "ln" } as Record<string, string>)[name] ?? name} `)
    .replace(new RegExp(`\\\\(${FN})\\s*(?:\\\\,\\s*)+`, "g"), "\\$1 ")
    .replace(new RegExp(`\\\\(${FN})\\s*\\(\\s*([a-zA-Z]|\\\\[a-zA-Z]+)\\s*\\)(?!\\s*\\^)`, "g"), "\\$1 $2")
    .replace(new RegExp(`(?<=[a-zA-Z0-9)}])\\s*\\\\times\\s*(?=\\\\(?:${FN})(?![a-zA-Z]))`, "g"), " ")
    .replace(/\\(lim|sum|int|prod)\s+(?=[_^])/g, "\\$1");
  // Only where a differential is plausible: an integral, "du = …", or an integrand ending in ")dx".
  if (/\\int|(?:^|[^a-zA-Z\\])d[a-z]\s*=|[)}]\s*d[a-z]\s*$/.test(t)) {
    t = t.replace(/(?<=[a-zA-Z0-9)}])(\s*)d([a-zA-Z]|\\theta|\\phi|\\rho|\\tau)(?![a-zA-Z])/g, (m, space: string, v: string, offset: number, str: string) =>
      // A "d" glued to a letter is part of a word or product (\text{odd}, ad − bc).
      !space && /[a-zA-Z]/.test(str[offset - 1]) ? m : `\\,d${v}`);
  }
  return t.replace(/[ \t]+(?=\\,)/g, "").replace(/[ \t]{2,}/g, " ");
}

/**
 * Models sometimes wrap a whole sentence in maths: $\text{the limit as } x \text{ approaches } 0$.
 * Words inside top-level \text{…} that contain a space are prose, so the fragment
 * is split back into sentence text with only the symbols typeset:
 * "the limit as $x$ approaches $0$". Returns null when there is nothing to lift.
 */
function liftProseOutOfMath(tex: string): string | null {
  const pieces: { math: boolean; value: string }[] = [];
  let depth = 0;
  let buf = "";
  let lifted = false;
  for (let i = 0; i < tex.length; i++) {
    if (depth === 0 && tex.startsWith("\\text{", i)) {
      let j = i + 6;
      let d = 1;
      for (; j < tex.length && d > 0; j++) {
        if (tex[j] === "\\") { j++; continue; }
        if (tex[j] === "{") d++;
        else if (tex[j] === "}") d--;
      }
      const words = tex.slice(i + 6, j - 1);
      if (/\s/.test(words.trim()) || (/^\s|\s$/.test(words) && /[a-zA-Z]{2,}/.test(words))) {
        pieces.push({ math: true, value: buf }, { math: false, value: words });
        buf = "";
        lifted = true;
        i = j - 1;
        continue;
      }
    }
    const c = tex[i];
    if (c === "\\") { buf += tex.slice(i, i + 2); i++; continue; }
    if (c === "{") depth++;
    else if (c === "}") depth--;
    buf += c;
  }
  if (!lifted) return null;
  pieces.push({ math: true, value: buf });
  return pieces
    .map(p => {
      if (!p.math) return p.value;
      // Leftover spacing commands between two words are not maths.
      const body = p.value.replace(/\\[,;:! ]|\\q?quad/g, " ").trim();
      if (!body) return p.value.length ? " " : "";
      const lead = /^\s/.test(p.value) ? " " : "";
      const trail = /\s$/.test(p.value) ? " " : "";
      const tidied = tidyTex(body);
      return tidied.trim() ? `${lead}$${tidied}$${trail}` : EMPTY_MATH;
    })
    .join("")
    .replace(/ {2,}/g, " ")
    .trim();
}

// A row break "\\" that lost one backslash in JSON decodes to "\ " and silently
// collapses a matrix or derivation onto one line.
function repairRowBreaks(env: string): string {
  return env.replace(/(?<!\\)\\(?=\s)/g, "\\\\");
}

const RELATION_START = /^\s*(?:=|<|>|\\approx|\\leq?|\\geq?|\\equiv|\\Rightarrow|\\implies)(?![a-zA-Z])/;

/** Index of the first "=" outside braces and brackets, or -1. */
function topLevelEquals(tex: string): number {
  let depth = 0;
  for (let i = 0; i < tex.length; i++) {
    const c = tex[i];
    if (c === "\\") { i++; continue; }
    if (c === "{" || c === "(" || c === "[") depth++;
    else if (c === "}" || c === ")" || c === "]") depth--;
    else if (c === "=" && depth === 0) return i;
  }
  return -1;
}

/**
 * Consecutive display lines where each continuation starts with "=" (or another
 * relation) are one derivation written line by line — set them as a single
 * block aligned on the relation, the way it would be written by hand.
 */
function mergeDerivation(run: string): string {
  const trailing = /\s*$/.exec(run)?.[0] ?? "";
  const blocks = [...run.matchAll(/\$\$((?:(?!\$\$)[\s\S])+)\$\$/g)].map(m => m[1].trim());
  const out: string[] = [];
  let k = 0;
  while (k < blocks.length) {
    let n = 1;
    while (k + n < blocks.length && RELATION_START.test(blocks[k + n])) n++;
    const group = blocks.slice(k, k + n);
    if (n >= 2 && group.every(b => !/\\begin|&/.test(b))) {
      const [first, ...rest] = group;
      const eq = topLevelEquals(first);
      const lines = eq === -1
        ? [`${first} &${rest[0]}`, ...rest.slice(1).map(t => `&${t}`)]
        : [`${first.slice(0, eq).trimEnd()} &${first.slice(eq)}`, ...rest.map(t => `&${t}`)];
      out.push(`$$\\begin{aligned} ${lines.join(" \\\\ ")} \\end{aligned}$$`);
    } else {
      out.push(...group.map(b => `$$${b}$$`));
    }
    k += n;
  }
  return out.join("\n") + trailing;
}

function normalizeMath<T>(value: T): T {
  if (typeof value === "string") return normalizeMathDelimiters(value) as unknown as T;
  if (Array.isArray(value)) return value.map(normalizeMath) as unknown as T;
  if (value && typeof value === "object") {
    const out: any = {};
    for (const [k, v] of Object.entries(value as any)) out[k] = normalizeMath(v);
    return out;
  }
  return value;
}

// ─── Map-Reduce pipeline for long transcripts ────────────────────────────────

function fmtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

async function summarizeChunk(
  text: string,
  title: string,
  part: number,
  total: number,
  timeRange: string,
  language: string
): Promise<string> {
  const langName = LANG_NAMES[language] ?? "English";
  const msg = await createWithRetry({
    model: "gpt-4o-mini",
    max_tokens: 900,
    system: `Extract and preserve all important content from this lecture segment. Write in ${langName}.
Return structured notes with clearly labeled sections:
TOPICS: main topics covered
KEY POINTS: every important point (preserve technical detail, examples, numbers)
KEY TERMS: term — definition for any defined concepts
FORMULAS: any equations or formulas (write them out explicitly)
Preserve specifics. Do not paraphrase away detail.

${MATH_STYLE}`,
    messages: [{
      role: "user",
      content: `"${title}" — Part ${part}/${total} (${timeRange})\n\n${text.slice(0, 8000)}`,
    }],
  });
  return `[Part ${part}/${total} · ${timeRange}]\n${normalizeMathDelimiters(extractText(msg))}`;
}

/**
 * Map-Reduce condenser. Passes short transcripts through unchanged.
 * For long ones: chunks by 10-min windows → Haiku map → condensed notes for Sonnet reduce.
 */
export async function condenseTranscript(
  transcript: string,
  segments: { start: number; end: number; text: string }[],
  title: string,
  language = "en"
): Promise<string> {
  if (transcript.length <= 15000) return transcript;

  const CHUNK_SECONDS = 600; // 10 minutes per chunk
  const chunks: { text: string; startSec: number; endSec: number }[] = [];

  if (segments.length > 0) {
    let buf: string[] = [];
    let chunkStart = segments[0].start;
    let boundary = chunkStart + CHUNK_SECONDS;

    for (const seg of segments) {
      if (seg.start >= boundary && buf.length > 0) {
        chunks.push({ text: buf.join(" "), startSec: chunkStart, endSec: seg.start });
        buf = [];
        chunkStart = seg.start;
        boundary = chunkStart + CHUNK_SECONDS;
      }
      buf.push(seg.text);
    }
    if (buf.length > 0) {
      const last = segments[segments.length - 1];
      chunks.push({ text: buf.join(" "), startSec: chunkStart, endSec: last.end });
    }
  } else {
    // No timestamps — split by character count (~15 min of speech per 15k chars)
    const SIZE = 15000;
    for (let i = 0; i < transcript.length; i += SIZE) {
      const ratio = i / transcript.length;
      const endRatio = Math.min((i + SIZE) / transcript.length, 1);
      chunks.push({
        text: transcript.slice(i, i + SIZE),
        startSec: ratio * 10800,      // assume max 3h
        endSec: endRatio * 10800,
      });
    }
  }

  // MAP: batch to 3 concurrent Haiku calls to avoid rate-limit spikes
  const summaries = await batchPromises(
    chunks.map((chunk, i) => () =>
      summarizeChunk(
        chunk.text, title, i + 1, chunks.length,
        `${fmtTime(chunk.startSec)}–${fmtTime(chunk.endSec)}`,
        language
      )
    ),
    3
  );

  return (
    `[CONDENSED FROM ${chunks.length} SEGMENTS — "${title}"]\n\n` +
    summaries.join("\n\n---\n\n")
  );
}

// ─── Generate functions (unchanged — receive condensed or raw transcript) ─────

/**
 * Reads a photo a student took during the lecture (whiteboard, projected slide,
 * a page of the textbook) and returns its content as text so it can be folded
 * into the transcript before anything is generated.
 */
export async function describeLectureImage(
  base64: string,
  mimeType: string,
  language = "en"
): Promise<string> {
  const langName = LANG_NAMES[language] ?? "English";
  const msg = await createWithRetry({
    model: "gpt-4o",
    max_tokens: 1200,
    system: `You are reading a photo taken during a university lecture — typically a whiteboard, a projected slide, or a page of notes.
Transcribe everything legible: headings, bullet points, diagrams (describe them briefly), and every formula.
Write in ${langName}. Return plain text only — no preamble, no commentary about the image quality.
If the photo contains no readable lecture content, return exactly: NO_CONTENT

${MATH_STYLE}`,
    messages: [{
      role: "user",
      content: [
        { type: "text", text: "Transcribe this lecture photo." },
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
      ],
    }],
  });
  const text = extractText(msg).trim();
  return text === "NO_CONTENT" ? "" : normalizeMathDelimiters(text);
}

async function generateCheatSheetOnce(transcript: string, lectureTitle: string, language = "en") {
  const langName = LANG_NAMES[language] ?? "English";
  const message = await createWithRetry({
    model: "gpt-4o",
    max_tokens: 9000,
    system: `You are an expert study assistant. Generate a comprehensive, detailed cheat sheet from a lecture transcript.
Write ALL text (headings, bullets, tips) in ${langName}.
Return ONLY valid JSON — no markdown, no code blocks, no commentary.
{
  "sections": [{ "heading": string, "bullets": string[] }],
  "keyTerms": [{ "term": string, "definition": string }],
  "examTips": string[],
  "formulas": string[],
  "actionItems": [{ "text": string, "type": "deadline" | "assignment" | "exam" | "reading" | "other", "dueDate": string | null }]
}

Match the depth the lecturer used — if they elaborated on something, you elaborate too:
- Sections: 5-8 sections covering every major topic addressed
- Each section: 5-8 bullets as FULL SENTENCES explaining the concept. Capture examples and elaborations the lecturer gave.
- keyTerms: 10-15 terms with thorough definitions (2-3 sentences each)
- examTips: 5-8 specific, actionable tips based on what was emphasized
- formulas: every equation or formula mentioned. Each entry is "Name: $$formula$$" — a short plain-words name, a colon, then one equation in $$...$$ with no words inside it
- actionItems: ONLY explicit deadlines/assignments mentioned; empty array if none
${ONE_LECTURE}
Example bullet: "Substituting $u = x^2$ gives $du = 2x\\\\,dx$, so $\\\\int 2x\\\\cos(x^2)\\\\,dx = \\\\int \\\\cos u\\\\,du = \\\\sin(x^2) + C$."
Example formula: "Newton's second law: $$F = ma$$"

${JSON_MATH_STYLE}`,
    response_format: { type: "json_object" },
    temperature: STUDY_TEMPERATURE,
    messages: [
      {
        role: "user",
        content: `Lecture: "${lectureTitle}"\n\nTranscript:\n${transcript.slice(0, 25000)}`,
      },
    ],
  });

  return parseJsonObject(extractText(message));
}

export async function streamSocraticResponse(
  context: string,
  lectureTitle: string,
  messages: { role: "user" | "assistant"; content: string }[],
  onChunk: (text: string) => void
): Promise<void> {
  const systemPrompt = `You are a Socratic tutor helping a student review their lecture on "${lectureTitle}".

Lecture context:
---
${context.slice(0, 8000)}
---

Rules:
1. NEVER directly answer — always guide with questions
2. If confused, simplify your question or give a small hint as another question
3. When they get something right, affirm it briefly then probe deeper
4. Keep responses SHORT: 2-3 sentences + one guiding question
5. Reference specific concepts from this lecture when relevant
6. Be warm, encouraging, and conversational

WHITEBOARD — use these formats proactively when they help understanding:

A) DIAGRAMS: When explaining a process, relationship, or structure, append a Mermaid diagram AFTER your text:
\`\`\`mermaid
flowchart TD
  A[Start] --> B[Step]
\`\`\`
Use flowchart TD, sequenceDiagram, or mindmap. Keep it simple (≤10 nodes).

B) MATH STEPS: When a student asks a math or calculation problem, append step-by-step LaTeX AFTER your question:
MATH_STEPS:[{"label":"Step 1: Identify","latex":"f(x) = x^2 + 3x + 2","hint":"What form is this?"},{"label":"Step 2: Factor","latex":"f(x) = (x+1)(x+2)","hint":"What are the roots?"}]
Each step must be valid LaTeX. Max 6 steps. The student reveals one step at a time.

Only include ONE whiteboard element per response. Never both. Never use these formats unless genuinely helpful.`;

  const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...messages,
  ];

  const stream = await getClient().chat.completions.create({
    model: "gpt-4o",
    max_tokens: 1024,
    messages: openaiMessages,
    stream: true,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content;
    if (delta) onChunk(delta);
  }
}

export async function parseSyllabus(text: string, courseName: string) {
  const msg = await createWithRetry({
    model: "gpt-4o",
    max_tokens: 8192,
    system: `You are an expert academic document parser and data engineer.
Extract ALL structured information from a course syllabus. Return ONLY valid JSON — no markdown, no code blocks.

Schema:
{
  "metadata": {
    "courseName": string,
    "professor": string | null,
    "officeHours": string | null,
    "semesterStart": "YYYY-MM-DD" | null,
    "semesterEnd": "YYYY-MM-DD" | null,
    "totalWeeks": number | null
  },
  "gradeWeights": [{ "category": string, "weight": number }],
  "schedule": [{
    "title": string,
    "raw_date_text": string,
    "type": "Exam" | "Assignment" | "Reading" | "Project" | "Quiz" | "Other",
    "importance_score": number,
    "week": number | null,
    "description": string | null
  }],
  "topics": [{ "week": number, "title": string, "description": string }]
}

Rules:
- importance_score 1–10: Exam=8–10, Project=7–9, Quiz=5–7, Assignment=3–6, Reading=1–3
- raw_date_text: copy EXACTLY from syllabus (e.g. "Week 4 Friday", "Oct 15", "11/30", "end of Week 9")
- week: extract the week number if mentioned, else null
- Extract EVERY deadline, exam, quiz, project, assignment, and reading — be exhaustive
- gradeWeights must sum to 100`,
    messages: [{
      role: "user",
      content: `Course: ${courseName}\n\nSyllabus:\n${text.slice(0, 100000)}`,
    }],
  });
  const json = extractText(msg).match(/\{[\s\S]*\}/)?.[0] ?? "{}";
  return JSON.parse(json);
}

async function generateQuizOnce(
  transcript: string,
  lectureTitle: string,
  language = "en"
): Promise<
  {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
    timestampSeconds?: number;
  }[]
> {
  const message = await createWithRetry({
    model: "gpt-4o",
    max_tokens: 6000,
    system: `You are an expert study assistant. Generate EXACTLY 8 multiple choice questions from a lecture transcript. Always return 8 — if the transcript is short, cover it in finer detail rather than returning fewer.
Write ALL text (questions, options, explanations) in ${LANG_NAMES[language] ?? "English"}.
Return ONLY a valid JSON object — no markdown, no code blocks, no commentary. Schema:
{"items": [{
  "question": string,
  "options": string[4],
  "correctIndex": number,
  "explanation": string,
  "timestampSeconds": number | null
}]}
Questions should test deep understanding, not just memorization.
${ONE_LECTURE}
Style — the quiz must look like the rest of the typeset notes:
- The question is a normal English sentence; only its maths goes in inline $...$.
- When an option is a formula or a value, the whole option is one $...$ expression, and all four options use the same form.
- The explanation reads like a tutor talking: one or two sentences giving the idea, then — only if there is working — a single aligned derivation.
Example item:
{"question": "What is $\\\\int 2x\\\\cos(x^2)\\\\,dx$?", "options": ["$\\\\sin(x^2) + C$", "$2\\\\sin(x^2) + C$", "$-\\\\sin(x^2) + C$", "$x^2\\\\sin(x^2) + C$"], "correctIndex": 0, "explanation": "Let $u = x^2$, so $du = 2x\\\\,dx$ and the integral becomes a standard one.\\n$$\\\\begin{aligned} \\\\int 2x\\\\cos(x^2)\\\\,dx &= \\\\int \\\\cos u\\\\,du \\\\\\\\ &= \\\\sin(x^2) + C. \\\\end{aligned}$$", "timestampSeconds": null}

${JSON_MATH_STYLE}`,
    response_format: { type: "json_object" },
    temperature: STUDY_TEMPERATURE,
    messages: [
      {
        role: "user",
        content: `Lecture: "${lectureTitle}"\n\nTranscript:\n${transcript.slice(0, 12000)}`,
      },
    ],
  });

  return parseJsonItems(extractText(message)).map((q: any) => ({ ...q, options: uniformOptions(q.options ?? []) }));
}

/** When some options are typeset, bare values like "0" or "x^2" are typeset too, so the four match. */
function uniformOptions(options: string[]): string[] {
  const typeset = options.some(o => /\$[^$]+\$/.test(String(o)));
  if (!typeset) return options;
  return options.map(o => {
    const str = String(o).trim();
    const bareValue = !str.includes("$") && /^[-+−]?[\w.^(){}\/+\-=\\ ]{1,20}$/.test(str) && !/[a-zA-Z]{3,}/.test(str.replace(/\\[a-zA-Z]+/g, ""));
    return bareValue ? `$${str}$` : o;
  });
}

async function generateFlashcardsFromTranscriptOnce(
  transcript: string,
  language = "en"
): Promise<{ front: string; back: string }[]> {
  const langName = LANG_NAMES[language] ?? "English";
  const msg = await createWithRetry({
    model: "gpt-4o",
    max_tokens: 3500,
    system: `Generate 10-14 flashcards from this lecture in ${langName}. ${ONE_LECTURE} Each card tests one idea: a definition, a formula, a mechanism or a worked relationship. Keep the front short and answerable; keep the back precise.
Return ONLY a valid JSON object — no markdown, no code blocks.
{"items": [{"front": string, "back": string}]}

${JSON_MATH_STYLE}`,
    response_format: { type: "json_object" },
    temperature: STUDY_TEMPERATURE,
    messages: [{ role: "user", content: `Transcript:\n${transcript.slice(0, 12000)}` }],
  });
  return parseJsonItems(extractText(msg));
}

async function generateKeyPointsOnce(
  transcript: string,
  language = "en"
): Promise<{ point: string; category: string }[]> {
  const langName = LANG_NAMES[language] ?? "English";
  const msg = await createWithRetry({
    model: "gpt-4o",
    max_tokens: 3000,
    system: `Extract 10-15 key points from this lecture in ${langName}. ${ONE_LECTURE} Categorize each as one of: "Definition", "Important", "Formula", "Example", "Warning". Return ONLY a valid JSON object — no markdown, no code blocks.\n{"items": [{"point": string, "category": "Definition"|"Important"|"Formula"|"Example"|"Warning"}]}\nExample item: {"point": "Substituting $u = x^{2}$ turns $\\\\int 2x\\\\cos(x^{2})\\\\,dx$ into $\\\\int \\\\cos u\\\\,du = \\\\sin(x^{2}) + C$", "category": "Formula"}\n\n${JSON_MATH_STYLE}`,
    response_format: { type: "json_object" },
    temperature: STUDY_TEMPERATURE,
    messages: [{ role: "user", content: `Transcript:\n${transcript.slice(0, 12000)}` }],
  });
  return parseJsonItems(extractText(msg));
}

export async function answerVideoQuestion(
  transcript: string,
  title: string,
  messages: { role: "user" | "assistant"; content: string }[],
  language = "en"
): Promise<string> {
  const langName = LANG_NAMES[language] ?? "English";
  const msg = await createWithRetry({
    model: "gpt-4o-mini",
    max_tokens: 512,
    system: `You are a helpful tutor for the lecture "${title}". Answer questions about it clearly and concisely in ${langName}. Only use information from the transcript. Write short paragraphs; use a simple list or **bold** only when it genuinely helps. No # headings or tables.\n\n${MATH_STYLE}\n\nTranscript:\n${transcript.slice(0, 8000)}`,
    messages,
  });
  return normalizeMathDelimiters(extractText(msg));
}

// ─── Course memory Q&A ("Ask your course") ──────────────────────────────────

export async function answerCourseQuestion(
  courseName: string,
  sources: { n: number; label: string; content: string }[],
  messages: { role: "user" | "assistant"; content: string }[],
  language = "en"
): Promise<string> {
  const langName = LANG_NAMES[language] ?? "English";
  const sourceBlock = sources
    .map(s => `[${s.n}] ${s.label}\n${s.content}`)
    .join("\n\n---\n\n");

  const msg = await createWithRetry({
    model: "gpt-4o",
    max_tokens: 1024,
    system: `You are the course memory for "${courseName}" — you attended every lecture and read every file the student captured. Respond in ${langName}.

You do two kinds of things:
1) ANSWER questions using the material.
2) HELP THE STUDENT STUDY when asked — e.g. "test me", "quiz me", "make flashcards", "give me practice questions", "summarize", "explain X simply". For these, actively GENERATE the requested study material (questions, flashcards, a quiz, a summary, etc.) built from the source content below. Do not refuse just because the sources aren't already in question form — your job is to turn the material into study tools.

Rules:
- Ground everything in the numbered sources below. Don't invent facts that aren't supported by them.
- If the student's own notes appear among the sources (labeled "Your note"), draw on them and cite them — connect what they wrote to the rest of the material.
- When you write a question, base it on a specific source and cite that source with bracket markers like [1] or [2][4]. When you answer or explain, cite too. Citations are mandatory.
- When asked to "test me" or "quiz me": write 4–6 questions drawn from the material (mix of recall and understanding). Ask them first; offer to reveal answers, or include an "Answer key" section after. Number the questions.
- Only say you don't have enough material yet if the sources are genuinely empty or unrelated to the request.
- Be clear and direct, like a sharp study partner. No filler.
- Formatting: short paragraphs, simple numbered or "-" lists, and **bold** only for the few terms that matter. No # headings, tables or horizontal rules.

${MATH_STYLE}

SOURCES:
${sourceBlock}`,
    messages,
  });
  return normalizeMathDelimiters(extractText(msg));
}

// ─── Exam Mode ────────────────────────────────────────────────────────────────
// Predicts likely exam content from the ENTIRE course memory: ranked topics,
// practice questions (each citing the numbered source it came from), gaps in
// the student's own notes, and a study plan sized to the days remaining.

export async function generateExamPack(
  courseName: string,
  sources: { n: number; label: string; content: string }[],
  noteTitles: string[],
  daysUntilExam: number | null,
  language = "en"
) {
  const langName = LANG_NAMES[language] ?? "English";
  const sourceBlock = sources.map(s => `[${s.n}] ${s.label}\n${s.content}`).join("\n\n---\n\n");
  const planDays = daysUntilExam != null ? Math.max(1, Math.min(daysUntilExam, 14)) : 5;

  const message = await createWithRetry({
    model: "gpt-4o",
    max_tokens: 6000,
    system: `You are the course memory for "${courseName}" — you attended every lecture and read every file the student captured. You are building their exam prep. Write ALL text in ${langName}.
Return ONLY valid JSON — no markdown, no code blocks, no commentary.
{
  "topics": [{ "name": string, "importance": 1-5, "why": string, "cite": number[] }],
  "questions": [{ "type": "mcq" | "short", "question": string, "options": string[] | null, "correctAnswer": string, "explanation": string, "cite": number[] }],
  "gaps": [{ "topic": string, "evidence": string, "suggestion": string }],
  "plan": [{ "label": string, "focus": string, "items": string[] }]
}

Rules:
- topics: 5-8 likely exam topics RANKED by how much the material emphasizes them (repetition across lectures, professor cues like "this will be on the exam", "important", time spent). "why" = one concrete sentence of evidence. "cite" = the numbered source(s) that show it.
- questions: 10-14 exam-style questions mixing "mcq" (4 options prefixed "A) ".."D) ", correctAnswer is the letter) and "short" (correctAnswer is a model answer, 1-3 sentences). Cover the top topics proportionally to importance. "explanation" says why the answer is right in 1-2 sentences. Every question MUST have "cite" pointing to the source(s) it was built from.
- gaps: topics that the lectures/files emphasize but the student's own notes (listed below) don't cover. "evidence" = why it matters; "suggestion" = what to do about it. Empty array if the student has no notes at all — do NOT invent gaps.
- plan: exactly ${planDays} entries. ${daysUntilExam != null ? `The exam is in ${daysUntilExam} day(s) — label entries "Day 1".."Day ${planDays}" ending at the exam.` : `No exam date given — label entries "Session 1".."Session ${planDays}".`} Order weak/heavy topics earlier, review + self-testing last. "items" = 2-4 concrete tasks referencing actual course material.
- Ground EVERYTHING in the numbered sources. Never invent facts, topics, or citations.

${JSON_MATH_STYLE}

STUDENT'S OWN NOTES (titles): ${noteTitles.length ? noteTitles.join(" · ") : "(none)"}

SOURCES:
${sourceBlock}`,
    messages: [{ role: "user", content: `Build my exam pack for "${courseName}".` }],
    response_format: { type: "json_object" },
    temperature: STUDY_TEMPERATURE,
  });

  return parseJsonObject(extractText(message));
}

// ─── Transcript corrector ─────────────────────────────────────────────────────
// Fixes speech-to-text errors: punctuation, homophones, split words, run-ons.
// Uses gpt-4o-mini (cheap) in 4 000-char chunks so long lectures are covered.

async function correctChunk(text: string): Promise<string> {
  const msg = await createWithRetry({
    model: "gpt-4o-mini",
    max_tokens: Math.min(Math.ceil(text.length / 3) + 600, 4096),
    system: `You are correcting a university lecture transcript produced by speech recognition.
Rules:
- Fix spelling mistakes, run-on sentences, and missing punctuation.
- Correct homophones (e.g. "their/there/they're", "to/too/two").
- Rejoin words that were split incorrectly (e.g. "mito chondria" → "mitochondria").
- Preserve all technical, scientific, and academic vocabulary.
- Do NOT add, remove, or change the meaning of any content.
- Return ONLY the corrected transcript — no explanations, no preamble.
- Write the maths in inline $...$ only; no $$ display blocks in a transcript.

${MATH_STYLE}`,
    messages: [{ role: "user", content: text }],
  });
  return normalizeMathDelimiters(extractText(msg).trim() || text);
}

// ─── Live transcript typesetting ──────────────────────────────────────────────
// During a recording, each finished sentence that sounds like maths is rewritten
// so the live view uses the same LaTeX style as the notes. Sentences with no sign
// of maths never reach the model, which keeps an hour-long lecture to cents.

const SPOKEN_MATH = new RegExp(
  [
    "\\b(?:squared|cubed|integral|integrate|derivative|differentiate|equals|plus|minus|divided by|over [a-z0-9]\\b",
    "square root|root of|sine|cosine|tangent|log(?:arithm)?|ln|limit|approaches|summation|sum of|factorial|exponent|power of|to the power",
    "delta|alpha|beta|gamma|theta|lambda|sigma|omega|epsilon|phi|rho|mu|pi|infinity|matrix|determinant|vector|gradient|partial",
    "prime|fraction|numerator|denominator|d [a-z]\\b|[a-z] of [a-z]\\b|[a-z] sub [a-z0-9]\\b|[a-z] (?:squared|cubed|over|times|plus|minus|equals)\\b)",
    "[=+^√∫∑×÷≤≥≈]",
    "\\d\\s*[a-z]\\b",
  ].join("|"),
  "i",
);

export function looksLikeSpokenMath(sentence: string): boolean {
  return SPOKEN_MATH.test(sentence);
}

/**
 * One fragment of live speech-to-text with its maths typeset in LaTeX, or null
 * when there's nothing to change (or the model's reply doesn't look like the same
 * fragment, in which case the words as heard are kept).
 */
export async function typesetSpokenMath(fragment: string, previous = ""): Promise<string | null> {
  const msg = await createWithRetry({
    model: "gpt-4o-mini",
    max_tokens: Math.min(400, Math.ceil(fragment.length / 2) + 80),
    temperature: 0.2,
    system: `You typeset a live lecture transcript. You receive one fragment of speech-to-text.
Return the same fragment with its mathematics written in LaTeX. Every other word stays exactly as spoken, in the same order.
Do not add, remove, summarise, correct or explain anything, and do not complete a formula that carries on in the next fragment.
Use inline $...$ only — no $$ display blocks.
If the fragment contains no mathematics, return it unchanged. Return only the fragment.

${MATH_STYLE}`,
    messages: [{
      role: "user",
      content: `${previous ? `Previous fragment, for context only — do not return it: ${previous}

` : ""}Fragment: ${fragment}`,
    }],
  }, 1);
  const out = normalizeMathDelimiters(extractText(msg).trim().replace(/^Fragment:\s*/i, ""));
  if (!out.includes("$") || out === fragment) return null;
  // A reply much longer or shorter than the fragment has added or dropped content.
  const letters = (t: string) => t.replace(/\[a-zA-Z]+|[^a-zA-Z]/g, "").length;
  const ratio = letters(out) / Math.max(1, letters(fragment));
  if (ratio < 0.3 || ratio > 1.6 || out.includes("$$")) return null;
  return out;
}

export async function correctTranscript(transcript: string): Promise<string> {
  if (!transcript.trim() || transcript.length < 100) return transcript;

  const CHUNK = 4000;
  if (transcript.length <= CHUNK) {
    try { return await correctChunk(transcript); } catch { return transcript; }
  }

  // Split at sentence boundaries to avoid cutting words mid-sentence
  const sentences = transcript.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current = "";
  for (const s of sentences) {
    if (current.length + s.length > CHUNK && current) {
      chunks.push(current);
      current = s;
    } else {
      current += (current ? " " : "") + s;
    }
  }
  if (current) chunks.push(current);

  try {
    const corrected = await batchPromises(
      chunks.map(c => () => correctChunk(c)),
      6
    );
    return corrected.join(" ");
  } catch {
    return transcript;
  }
}

// ─── JSON generations: one retry when the reply comes back cut off ─────────────
// A truncated or malformed reply would otherwise leave a lecture with an empty
// tab; a second attempt is far cheaper than asking the student to reprocess.

async function retryOnBadJson<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    if (!(err instanceof SyntaxError)) throw err;
    return run();
  }
}

export const generateCheatSheet = (...args: Parameters<typeof generateCheatSheetOnce>) =>
  retryOnBadJson(() => generateCheatSheetOnce(...args));
export const generateQuiz = (...args: Parameters<typeof generateQuizOnce>) =>
  retryOnBadJson(() => generateQuizOnce(...args));
export const generateFlashcardsFromTranscript = (...args: Parameters<typeof generateFlashcardsFromTranscriptOnce>) =>
  retryOnBadJson(() => generateFlashcardsFromTranscriptOnce(...args));
export const generateKeyPoints = (...args: Parameters<typeof generateKeyPointsOnce>) =>
  retryOnBadJson(() => generateKeyPointsOnce(...args));
