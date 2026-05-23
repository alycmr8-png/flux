import OpenAI from "openai";

let _openai: OpenAI | null = null;
function getClient() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 90000 });
  return _openai;
}

async function createWithRetry(params: any, retries = 3): Promise<any> {
  const models = [params.model, "gpt-3.5-turbo"];
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
    model: "gpt-3.5-turbo",
    max_tokens: 900,
    system: `Extract and preserve all important content from this lecture segment. Write in ${langName}.
Return structured notes with clearly labeled sections:
TOPICS: main topics covered
KEY POINTS: every important point (preserve technical detail, examples, numbers)
KEY TERMS: term — definition for any defined concepts
FORMULAS: any equations or formulas (write them out explicitly)
Preserve specifics. Do not paraphrase away detail.`,
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
- actionItems: ONLY explicit deadlines/assignments mentioned; empty array if none`,
    messages: [
      {
        role: "user",
        content: `Lecture: "${lectureTitle}"\n\nTranscript:\n${transcript.slice(0, 25000)}`,
      },
    ],
  });

  const json = extractText(message).match(/\{[\s\S]*\}/)?.[0] ?? "{}";
  return JSON.parse(json);
}

export async function generateStructuredLearningFile(
  text: string,
  title: string,
  language = "en"
) {
  const langName = LANG_NAMES[language] ?? "English";
  const message = await createWithRetry({
    model: "gpt-4o",
    max_tokens: 4096,
    system: `You are an expert study assistant. Generate a comprehensive structured learning file from a document.
Write ALL text in ${langName}.
Return ONLY valid JSON — no markdown, no code blocks, no commentary.
{
  "summary": string,
  "sections": [{ "heading": string, "bullets": string[] }],
  "keyTerms": [{ "term": string, "definition": string }],
  "formulas": string[],
  "examTips": string[],
  "practiceQuestions": [{ "question": string, "answer": string }]
}
Be thorough. Include 4-6 sections, 5-10 key terms, all formulas, 5 exam tips, 5 practice questions.`,
    messages: [
      {
        role: "user",
        content: `Document: "${title}"\n\nContent:\n${text.slice(0, 15000)}`,
      },
    ],
  });

  const json = extractText(message).match(/\{[\s\S]*\}/)?.[0] ?? "{}";
  return JSON.parse(json);
}

export async function generateStudyBook(transcript: string, lectureTitle: string, language = "en") {
  const langName = LANG_NAMES[language] ?? "English";
  // If still very large after condensing, do a second-pass condensation
  let transcriptInput = transcript;
  if (transcriptInput.length > 80000) {
    transcriptInput = await condenseTranscript(transcriptInput, [], lectureTitle, language);
  }
  transcriptInput = transcriptInput.slice(0, 80000);
  const len = transcriptInput.length;

  // Scale depth and token budget to actual content length
  const tier: "short" | "medium" | "long" =
    len < 8000 ? "short" : len < 30000 ? "medium" : "long";

  const depth = {
    short:  { maxTokens: 7000,  chapters: "3",   explanation: "2",   keyPoints: "3-4",  flashcards: "2",   glossary: "6-8"  },
    medium: { maxTokens: 10000, chapters: "4-5", explanation: "2-3", keyPoints: "4-5",  flashcards: "2-3", glossary: "8-12" },
    long:   { maxTokens: 14000, chapters: "6-7", explanation: "3",   keyPoints: "5-6",  flashcards: "3",   glossary: "12-16"},
  }[tier];

  const msg = await createWithRetry({
    model: "gpt-4o",
    max_tokens: depth.maxTokens,
    system: `You are an expert Instructional Designer creating comprehensive study materials.
Your primary goal: if the speaker explains something in depth, YOU explain it in depth too. Never summarise what can be detailed.
Write ALL text in ${langName}.
Return ONLY valid JSON — no markdown, no commentary.

Schema (output fields in THIS exact order):
{
  "_type": "studybook",
  "chapters": [{
    "number": number,
    "title": string,
    "timestamp": string,
    "explanation": string,
    "keyPoints": string[],
    "keyTerms": [{ "term": string, "definition": string }],
    "analogy": { "concept": string, "analogy": string },
    "flashcards": [{ "front": string, "back": string }],
    "examQuestions": [{
      "type": "mcq" | "short",
      "question": string,
      "options": string[] | null,
      "correctAnswer": string,
      "explanation": string
    }]
  }],
  "glossary": [{ "term": string, "definition": string, "highYield": boolean }],
  "tableOfContents": [{ "chapter": number, "title": string, "timestamp": string }],
  "executiveSummary": string
}

DEPTH REQUIREMENTS:
- Chapters: ${depth.chapters} chapters, one per distinct topic. Do not merge unrelated topics.
- explanation: ${depth.explanation} detailed paragraphs. Include examples, reasoning, elaborations.
- keyPoints: ${depth.keyPoints} complete sentences, each a standalone learning statement.
- keyTerms: 2-4 terms per chapter with clear 1-2 sentence definitions.
- analogy: one vivid everyday analogy per chapter.
- flashcards: ${depth.flashcards} per chapter. Specific fronts; complete, detailed backs.
- examQuestions: 1 MCQ + 1 short-answer per chapter.
- glossary: ${depth.glossary} terms across the full lecture.
- executiveSummary: 2-3 paragraphs covering the full arc.

Rules:
- MCQ options = ["A. ...", "B. ...", "C. ...", "D. ..."], correctAnswer = "A"/"B"/"C"/"D"
- Short answer: options = null, correctAnswer = thorough model answer (2-4 sentences)
- highYield = true for terms most likely on exams
- Timestamps in MM:SS format (estimate if not in transcript)`,
    messages: [{
      role: "user",
      content: `Lecture: "${lectureTitle}"\n\nTranscript:\n${transcriptInput}`,
    }],
  });
  const raw = extractText(msg);
  const json = raw.match(/\{[\s\S]*\}/)?.[0] ?? "{}";
  let parsed: any = {};
  try {
    parsed = JSON.parse(json);
  } catch {
    // JSON was cut off — try to recover partial output
    const partial = json.replace(/,?\s*[\[{][^{}\[\]]*$/, "") + "]}]}";
    try { parsed = JSON.parse(partial); } catch { /* unrecoverable */ }
  }
  if (!parsed.chapters?.length) {
    console.error("[generateStudyBook] no chapters in response, raw:", raw.slice(0, 500));
    throw new Error("Study book generation failed — please try again.");
  }
  return parsed;
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
Questions should test deep understanding, not just memorization.`,
    messages: [
      {
        role: "user",
        content: `Lecture: "${lectureTitle}"\n\nTranscript:\n${transcript.slice(0, 12000)}`,
      },
    ],
  });

  const json = extractText(message).match(/\[[\s\S]*\]/)?.[0] ?? "[]";
  return JSON.parse(json);
}

export async function summarizeTranscript(transcript: string, title: string, language = "en"): Promise<string> {
  const langName = LANG_NAMES[language] ?? "English";
  const msg = await createWithRetry({
    model: "gpt-3.5-turbo",
    max_tokens: 400,
    system: `You are a study assistant. Write a short 2-paragraph summary of the lecture in ${langName}. First paragraph: what the lecture was about. Second paragraph: the 2-3 most important takeaways. Be brief and direct. Never refuse or comment on transcript quality.`,
    messages: [{ role: "user", content: `Lecture: "${title}"\n\nTranscript:\n${transcript.slice(0, 12000)}` }],
  });
  return extractText(msg);
}

export async function generateFlashcardsFromTranscript(transcript: string, language = "en"): Promise<{ front: string; back: string }[]> {
  const langName = LANG_NAMES[language] ?? "English";
  const msg = await createWithRetry({
    model: "gpt-3.5-turbo",
    max_tokens: 2000,
    system: `Generate 8-12 flashcards from this lecture in ${langName}. Return ONLY valid JSON array — no markdown, no code blocks.\n[{"front": string, "back": string}]`,
    messages: [{ role: "user", content: `Transcript:\n${transcript.slice(0, 12000)}` }],
  });
  const json = extractText(msg).match(/\[[\s\S]*\]/)?.[0] ?? "[]";
  return JSON.parse(json);
}

export async function answerVideoQuestion(
  transcript: string,
  title: string,
  messages: { role: "user" | "assistant"; content: string }[],
  language = "en"
): Promise<string> {
  const langName = LANG_NAMES[language] ?? "English";
  const msg = await createWithRetry({
    model: "gpt-3.5-turbo",
    max_tokens: 512,
    system: `You are a helpful tutor for the lecture "${title}". Answer questions about it clearly and concisely in ${langName}. Only use information from the transcript.\n\nTranscript:\n${transcript.slice(0, 8000)}`,
    messages,
  });
  return extractText(msg);
}
