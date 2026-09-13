import OpenAI from "openai";
import { toMathNotation } from "@sano/shared";

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

// The model follows MATH_STYLE most of the time but not always, so every string
// it produces also goes through the deterministic converter.
function mathify<T>(value: T): T {
  if (typeof value === "string") return toMathNotation(value) as unknown as T;
  if (Array.isArray(value)) return value.map(mathify) as unknown as T;
  if (value && typeof value === "object") {
    const out: any = {};
    for (const [k, v] of Object.entries(value as any)) out[k] = mathify(v);
    return out;
  }
  return value;
}

function extractText(msg: any): string {
  return msg?.choices?.[0]?.message?.content ?? "";
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
// ("the integral of x squared"). Rendering targets are plain <Text> in the mobile
// app, so notation must be real Unicode characters — never LaTeX markup.
const MATH_STYLE = `SCIENTIFIC NOTATION — MANDATORY:
The transcript comes from speech recognition, so every formula arrives spelled out in words. You MUST rewrite each one in real symbols. Leaving maths in words is an error.
Convert exactly like these:
- "the integral from zero to one of x squared d x" → ∫₀¹ x² dx
- "the sum from i equals one to n of i equals n times n plus one over two" → ∑ᵢ₌₁ⁿ i = n(n+1)/2
- "f prime of g of x times g prime of x" → f′(g(x)) · g′(x)
- "delta E equals m c squared" → ΔE = mc²
- "water is H two O, sulfuric acid is H two S O four" → H₂O, H₂SO₄
- "theta between zero and pi" → θ ∈ [0, π]
- "x squared plus y squared equals r squared" → x² + y² = r²
Use these characters: superscripts ⁰¹²³⁴⁵⁶⁷⁸⁹ⁿ⁻, subscripts ₀₁₂₃₄₅₆₇₈₉ᵢₙ, Greek α β γ δ ε θ λ μ π ρ σ τ φ ω Δ Σ Ω Π, operators × ÷ · ± ≤ ≥ ≠ ≈ ∝ → ⇒ ∞, calculus ∫ ∑ ∏ ∂ ∇ √, sets ∈ ∉ ⊂ ∪ ∩ ∀ ∃.
Never output LaTeX or markdown maths (no \\frac, no \\int, no $...$). Write fractions as a/b or ½.
Keep ordinary prose in words — only the maths becomes symbols.`;

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
  return `[Part ${part}/${total} · ${timeRange}]\n${extractText(msg)}`;
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
  return text === "NO_CONTENT" ? "" : toMathNotation(text);
}

export async function generateCheatSheet(transcript: string, lectureTitle: string, language = "en") {
  const langName = LANG_NAMES[language] ?? "English";
  const message = await createWithRetry({
    model: "gpt-4o",
    max_tokens: 6000,
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
- formulas: every equation or formula mentioned
- actionItems: ONLY explicit deadlines/assignments mentioned; empty array if none

${MATH_STYLE}`,
    messages: [
      {
        role: "user",
        content: `Lecture: "${lectureTitle}"\n\nTranscript:\n${transcript.slice(0, 25000)}`,
      },
    ],
  });

  const json = extractText(message).match(/\{[\s\S]*\}/)?.[0] ?? "{}";
  return mathify(JSON.parse(json));
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

export async function generateQuiz(
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
    max_tokens: 4096,
    system: `You are an expert study assistant. Generate 5-10 multiple choice questions from a lecture transcript.
Write ALL text (questions, options, explanations) in ${LANG_NAMES[language] ?? "English"}.
Return ONLY valid JSON array — no markdown, no code blocks, no commentary. Schema:
[{
  "question": string,
  "options": string[4],
  "correctIndex": number,
  "explanation": string,
  "timestampSeconds": number | null
}]
Questions should test deep understanding, not just memorization.

${MATH_STYLE}`,
    messages: [
      {
        role: "user",
        content: `Lecture: "${lectureTitle}"\n\nTranscript:\n${transcript.slice(0, 12000)}`,
      },
    ],
  });

  const json = extractText(message).match(/\[[\s\S]*\]/)?.[0] ?? "[]";
  return mathify(JSON.parse(json));
}

export async function generateFlashcardsFromTranscript(
  transcript: string,
  language = "en"
): Promise<{ front: string; back: string }[]> {
  const langName = LANG_NAMES[language] ?? "English";
  const msg = await createWithRetry({
    model: "gpt-4o-mini",
    max_tokens: 2000,
    system: `Generate 10-14 flashcards from this lecture in ${langName}. Each card tests one idea: a definition, a formula, a mechanism or a worked relationship. Keep the front short and answerable; keep the back precise.
Return ONLY valid JSON array — no markdown, no code blocks.
[{"front": string, "back": string}]

${MATH_STYLE}`,
    messages: [{ role: "user", content: `Transcript:\n${transcript.slice(0, 12000)}` }],
  });
  const json = extractText(msg).match(/\[[\s\S]*\]/)?.[0] ?? "[]";
  return mathify(JSON.parse(json));
}

export async function generateKeyPoints(
  transcript: string,
  language = "en"
): Promise<{ point: string; category: string }[]> {
  const langName = LANG_NAMES[language] ?? "English";
  const msg = await createWithRetry({
    model: "gpt-4o-mini",
    max_tokens: 1500,
    system: `Extract 10-15 key points from this lecture in ${langName}. Categorize each as one of: "Definition", "Important", "Formula", "Example", "Warning". Return ONLY valid JSON array — no markdown, no code blocks.\n[{"point": string, "category": "Definition"|"Important"|"Formula"|"Example"|"Warning"}]\n\n${MATH_STYLE}`,
    messages: [{ role: "user", content: `Transcript:\n${transcript.slice(0, 12000)}` }],
  });
  const json = extractText(msg).match(/\[[\s\S]*\]/)?.[0] ?? "[]";
  return mathify(JSON.parse(json));
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
    system: `You are a helpful tutor for the lecture "${title}". Answer questions about it clearly and concisely in ${langName}. Only use information from the transcript.\n\nTranscript:\n${transcript.slice(0, 8000)}`,
    messages,
  });
  return toMathNotation(extractText(msg));
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

SOURCES:
${sourceBlock}`,
    messages,
  });
  return toMathNotation(extractText(msg));
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

STUDENT'S OWN NOTES (titles): ${noteTitles.length ? noteTitles.join(" · ") : "(none)"}

SOURCES:
${sourceBlock}`,
    messages: [{ role: "user", content: `Build my exam pack for "${courseName}".` }],
  });

  const json = extractText(message).match(/\{[\s\S]*\}/)?.[0] ?? "{}";
  return mathify(JSON.parse(json));
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

${MATH_STYLE}`,
    messages: [{ role: "user", content: text }],
  });
  return toMathNotation(extractText(msg).trim() || text);
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
