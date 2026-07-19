import { Router } from "express";
import { quotaMiddleware } from "../services/usage";
import multer from "multer";
import fs from "fs";
import os from "os";
import path from "path";
import { prisma } from "../lib/prisma";
import { generateStructuredLearningFile } from "../services/claude";
import { indexSource } from "../services/memory";
import OpenAI from "openai";

const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (buf: Buffer) => Promise<{ text: string }>;
const mammoth = require("mammoth") as { extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }> };
const officeparser = require("officeparser") as { parseOfficeAsync: (input: Buffer | string, config?: any) => Promise<string> };

// Manual PPTX text extraction — reads slide XML from ZIP without extra deps
async function extractPptxText(buffer: Buffer): Promise<string> {
  const AdmZip = require("adm-zip");
  const zip = new AdmZip(buffer);
  const entries: any[] = zip.getEntries();
  const slideEntries = entries
    .filter((e: any) => /^ppt\/slides\/slide\d+\.xml$/.test(e.entryName))
    .sort((a: any, b: any) => a.entryName.localeCompare(b.entryName));
  const texts = slideEntries.map((e: any) => {
    const xml: string = e.getData().toString("utf-8");
    return [...xml.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)]
      .map(m => m[1].trim()).filter(Boolean).join(" ");
  }).filter(Boolean);
  return texts.join("\n\n");
}

async function parseOfficeFile(buffer: Buffer, originalName: string): Promise<string> {
  const ext = path.extname(originalName).toLowerCase() || ".pptx";
  const tmpPath = path.join(os.tmpdir(), `upload_${Date.now()}${ext}`);

  // Strategy 1: officeparser via temp file
  try {
    fs.writeFileSync(tmpPath, buffer);
    const result = await officeparser.parseOfficeAsync(tmpPath, { outputErrorToConsole: false });
    if (result?.trim()) { console.log("[officeparser] success"); return result; }
  } catch (err: any) {
    console.error("[officeparser] failed:", err?.message);
  } finally {
    fs.unlink(tmpPath, () => {});
  }

  // Strategy 2: manual ZIP/XML extraction — pptx only (not old .ppt binary)
  if (/\.pptx$/i.test(originalName)) {
    try {
      const manual = await extractPptxText(buffer);
      if (manual.trim()) { console.log("[manual-pptx] success"); return manual; }
    } catch (_) {}
  }

  // Strategy 3: GPT-4o file extraction — handles old .ppt, .xls, etc.
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const mimeTypes: Record<string, string> = {
      ".ppt":  "application/vnd.ms-powerpoint",
      ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ".xls":  "application/vnd.ms-excel",
      ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ".doc":  "application/msword",
      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
    const mime = mimeTypes[ext] ?? "application/octet-stream";
    const uploaded = await openai.files.create({
      file: new File([buffer], originalName, { type: mime }),
      purpose: "user_data" as any,
    });
    try {
      const res = await openai.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 4000,
        messages: [{
          role: "user",
          content: [
            { type: "file", file: { file_id: uploaded.id } } as any,
            { type: "text", text: "Extract ALL text from this file exactly as written — every title, bullet point, label, and body text. Output plain text only." },
          ],
        }],
      });
      const text = res.choices[0]?.message?.content ?? "";
      if (text.trim()) { console.log("[gpt4o-file] success"); return text; }
    } finally {
      openai.files.del(uploaded.id).catch(() => {});
    }
  } catch (err: any) {
    console.error("[gpt4o-file] failed:", err?.message);
  }

  throw new Error("Couldn't read this file. Old .ppt/.doc/.xls files aren't supported — open it and use File → Save As to make a .pptx/.docx/.xlsx or PDF, then re-upload.");
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"]);

// Extract plain text from any supported upload. Throws a user-friendly Error on failure.
async function extractTextFromFile(file: Express.Multer.File, title: string): Promise<string> {
  let text = "";

  if (file.mimetype === "application/pdf") {
    try {
      const parsed = await pdfParse(file.buffer);
      text = parsed.text ?? "";
    } catch { /* fall through to vision OCR below */ }

    // Scanned PDF — no selectable text — send to GPT-4o for OCR
    if (!text.trim()) {
      try {
        const uploaded = await openai.files.create({
          file: new File([file.buffer], `${title}.pdf`, { type: "application/pdf" }),
          purpose: "user_data" as any,
        });
        try {
          const vision = await openai.chat.completions.create({
            model: "gpt-4o",
            max_tokens: 4000,
            messages: [{
              role: "user",
              content: [
                { type: "file", file: { file_id: uploaded.id } } as any,
                { type: "text", text: "Extract ALL text from this document exactly as written. Include every word, heading, bullet, number, and formula. Output plain text only." },
              ],
            }],
          });
          text = vision.choices[0]?.message?.content ?? "";
        } finally {
          openai.files.del(uploaded.id).catch(() => {});
        }
      } catch {
        throw new Error("Could not read this PDF. If it is scanned, try uploading a photo of it instead.");
      }
    }
  } else if (
    file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.originalname?.toLowerCase().endsWith(".docx")
  ) {
    try {
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      text = result.value ?? "";
    } catch {
      throw new Error("Could not read this Word document.");
    }
  } else if (
    /\.(pptx|ppt|xlsx|xls|odt|odp|ods|odg|doc)$/i.test(file.originalname ?? "") ||
    [
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "application/vnd.oasis.opendocument.text",
      "application/vnd.oasis.opendocument.presentation",
      "application/vnd.oasis.opendocument.spreadsheet",
      "application/msword",
    ].includes(file.mimetype)
  ) {
    try {
      text = await parseOfficeFile(file.buffer, file.originalname ?? "file.pptx");
    } catch {
      throw new Error("Couldn't read this file. Old .ppt/.doc/.xls files aren't supported — open it and use File → Save As to make a .pptx/.docx/.xlsx or PDF, then re-upload.");
    }
  } else if (IMAGE_MIMES.has(file.mimetype) || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.originalname ?? "")) {
    try {
      const b64 = file.buffer.toString("base64");
      const mime = IMAGE_MIMES.has(file.mimetype) ? file.mimetype : "image/jpeg";
      const vision = await openai.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 2000,
        messages: [{
          role: "user",
          content: [
            {
              type: "text",
              text: "This is a study image (lecture slide, textbook page, handwritten note, diagram, etc.). Extract and describe ALL content in detail: every word of text, every formula, every diagram label, every bullet point. Be thorough — this output will be used to generate study materials.",
            },
            { type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } },
          ],
        }],
      });
      text = vision.choices[0]?.message?.content ?? "";
    } catch (err: any) {
      throw new Error(`Could not analyse image: ${err.message}`);
    }
  } else {
    text = file.buffer.toString("utf-8");
  }

  return text;
}

const router = Router();
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB) || 100;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 } });

// Temp store for extracted text (for regeneration without re-uploading)
const docStore = new Map<string, { text: string; title: string; userId: string }>();

// POST /api/documents — parse + generate, no DB save
router.post("/", quotaMiddleware("gen"), upload.single("document"), async (req, res) => {
  const user = (req as any).user;
  const file = req.file;
  const title = (req.body.title as string)?.trim() || file?.originalname?.replace(/\.[^.]+$/, "") || "Uploaded Document";

  if (!file) return res.status(400).json({ error: "No file uploaded" });

  let text = "";
  try {
    text = await extractTextFromFile(file, title);
  } catch (err: any) {
    return res.status(400).json({ error: err?.message ?? "Could not read this file." });
  }
  // Some PDFs extract NUL bytes — Postgres rejects them, killing the save
  text = text.replace(/\u0000/g, " ");

  if (!text.trim()) {
    return res.status(400).json({
      error: "No content found in this file. For scanned PDFs, try a version with selectable text.",
    });
  }

  const content = await generateStructuredLearningFile(text, title, user.language ?? "en");

  const docId = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  docStore.set(docId, { text, title, userId: user.id });
  setTimeout(() => docStore.delete(docId), 60 * 60 * 1000); // expire after 1 hour

  res.json({ data: content, docId, title });
});

// POST /api/documents/regenerate — re-generate from stored text
router.post("/regenerate", quotaMiddleware("gen"), async (req, res) => {
  const user = (req as any).user;
  const { docId } = req.body as { docId: string };

  const stored = docStore.get(docId);
  if (!stored || stored.userId !== user.id) return res.status(404).json({ error: "Document session expired. Please re-upload the file." });

  const content = await generateStructuredLearningFile(stored.text, stored.title, user.language ?? "en");
  res.json({ data: content, docId, title: stored.title });
});

// POST /api/documents/save — explicit save to Study Book
router.post("/save", async (req, res) => {
  const user = (req as any).user;
  const { title, content, courseId, docId } = req.body as { title: string; content: any; courseId?: string; docId?: string };

  if (!title || !content) return res.status(400).json({ error: "title and content are required" });

  const storedDoc = docId ? docStore.get(docId) : null;
  const transcript = storedDoc?.text ?? "";

  let course: any = courseId
    ? await prisma.course.findFirst({ where: { id: courseId, userId: user.id } })
    : null;

  if (!course) {
    course = await prisma.course.findFirst({ where: { userId: user.id } });
    if (!course) course = await prisma.course.create({ data: { userId: user.id, name: "General", code: "GEN" } });
  }

  const lecture = await prisma.lecture.create({
    data: { userId: user.id, courseId: course.id, title, transcript, status: "ready" },
  });

  const existing = await prisma.cheatSheet.findFirst({
    where: { lectureId: lecture.id, userId: user.id },
  });

  const cheatSheet = existing
    ? await prisma.cheatSheet.update({ where: { id: existing.id }, data: { content } })
    : await prisma.cheatSheet.create({
        // Uploaded files live in the "Upload Files" tab — plain title (no "Study Book:" prefix)
        data: { userId: user.id, lectureId: lecture.id, title, content: { _type: "file", ...content } },
      });

  // Index into course memory (non-fatal) — prefer the raw extracted text over the generated summary
  try {
    const memoryText = transcript || [
      content?.summary ?? "",
      ...(content?.sections ?? []).flatMap((s: any) => [s.heading, ...(s.bullets ?? [])]),
      ...(content?.keyTerms ?? []).map((kt: any) => `${kt.term}: ${kt.definition}`),
    ].filter(Boolean).join("\n");
    if (memoryText.trim()) {
      await indexSource({ userId: user.id, courseId: course.id, sourceType: "file", sourceId: lecture.id, sourceTitle: title, text: memoryText });
    }
  } catch (e: any) { console.error("[documents/save] indexing failed:", e?.message); }

  res.json({ data: cheatSheet, lectureId: lecture.id });
});

// POST /api/documents/quick-save — store the uploaded files (text extracted &
// indexed into course memory) WITHOUT generating AI study materials. Each file
// becomes a visible "Saved File" in the Upload Files tab.
router.post("/quick-save", quotaMiddleware("gen"), upload.array("documents", 50), async (req, res) => {
  const user = (req as any).user;
  const courseId = req.body.courseId as string;
  const files = (req.files as Express.Multer.File[]) ?? [];

  let titles: string[] = [];
  try { titles = JSON.parse(req.body.titles ?? "[]"); } catch { /* ignore */ }

  if (!courseId) return res.status(400).json({ error: "courseId required" });

  // Backward-compatible path: titles only, no files attached.
  if (!files.length) {
    if (!titles.length) return res.status(400).json({ error: "No files or titles provided" });
    const saved = [];
    for (const title of titles) {
      const lecture = await prisma.lecture.create({ data: { userId: user.id, courseId, title, status: "ready" } });
      const cs = await prisma.cheatSheet.create({
        data: { userId: user.id, lectureId: lecture.id, title, content: { _type: "file", summary: "", sections: [], keyTerms: [], rawText: "" } },
      });
      saved.push({ id: cs.id, lectureId: lecture.id, title });
    }
    return res.json({ data: saved });
  }

  const saved = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const title = (titles[i] || file.originalname?.replace(/\.[^.]+$/, "") || "Uploaded File").trim();

    // Extract text — but never block the save: store the file even if parsing fails.
    let text = "";
    try { text = await extractTextFromFile(file, title); } catch (e: any) { console.error("[quick-save] extract failed:", e?.message); }
    text = text.replace(/\u0000/g, " ");

    const lecture = await prisma.lecture.create({
      data: { userId: user.id, courseId, title, transcript: text || null, status: "ready" },
    });

    const flat = text.replace(/\s+/g, " ").trim();
    const summary = flat ? flat.slice(0, 400) + (flat.length > 400 ? "…" : "") : "";
    const cheatSheet = await prisma.cheatSheet.create({
      data: {
        userId: user.id,
        lectureId: lecture.id,
        title,
        content: { _type: "file", summary, sections: [], keyTerms: [], rawText: text },
      },
    });

    // Feed course memory so "Ask your course" can use the file (non-fatal).
    if (text.trim()) {
      try {
        await indexSource({ userId: user.id, courseId, sourceType: "file", sourceId: lecture.id, sourceTitle: title, text });
      } catch (e: any) { console.error("[quick-save] indexing failed:", e?.message); }
    }

    saved.push({ id: cheatSheet.id, lectureId: lecture.id, title });
  }

  res.json({ data: saved });
});

export { router as documentRouter };
