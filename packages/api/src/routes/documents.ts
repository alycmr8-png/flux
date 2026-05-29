import { Router } from "express";
import multer from "multer";
import fs from "fs";
import os from "os";
import path from "path";
import { prisma } from "../lib/prisma";
import { generateStructuredLearningFile } from "../services/claude";
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
  try {
    fs.writeFileSync(tmpPath, buffer);
    const result = await officeparser.parseOfficeAsync(tmpPath, { outputErrorToConsole: false });
    if (result?.trim()) return result;
    throw new Error("empty result");
  } catch (err: any) {
    console.error("[officeparser] failed, trying manual parse:", err?.message);
    // Fallback: manual PPTX XML extraction
    if (/\.pptx?$/i.test(originalName)) {
      const manual = await extractPptxText(buffer);
      if (manual.trim()) return manual;
    }
    throw err;
  } finally {
    fs.unlink(tmpPath, () => {});
  }
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"]);

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// Temp store for extracted text (for regeneration without re-uploading)
const docStore = new Map<string, { text: string; title: string; userId: string }>();

// POST /api/documents — parse + generate, no DB save
router.post("/", upload.single("document"), async (req, res) => {
  const user = (req as any).user;
  const file = req.file;
  const title = (req.body.title as string)?.trim() || file?.originalname?.replace(/\.[^.]+$/, "") || "Uploaded Document";

  if (!file) return res.status(400).json({ error: "No file uploaded" });

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
      } catch (err: any) {
        return res.status(400).json({ error: "Could not read this PDF. If it is scanned, try uploading a photo of it instead." });
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
      return res.status(400).json({ error: "Could not read this Word document." });
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
      return res.status(400).json({ error: "Could not read this file. Try saving it as PDF and re-uploading." });
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
      return res.status(400).json({ error: `Could not analyse image: ${err.message}` });
    }
  } else {
    text = file.buffer.toString("utf-8");
  }

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
router.post("/regenerate", async (req, res) => {
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
    where: { lectureId: lecture.id, userId: user.id, title: { startsWith: "Study Book:" } },
  });

  const cheatSheet = existing
    ? await prisma.cheatSheet.update({ where: { id: existing.id }, data: { content } })
    : await prisma.cheatSheet.create({
        data: { userId: user.id, lectureId: lecture.id, title: `Study Book: ${title}`, content },
      });

  res.json({ data: cheatSheet });
});

// POST /api/documents/quick-save — save file titles as lecture records without AI processing
router.post("/quick-save", async (req, res) => {
  const user = (req as any).user;
  const { titles, courseId } = req.body as { titles: string[]; courseId: string };

  if (!titles?.length || !courseId) return res.status(400).json({ error: "titles and courseId required" });

  const saved = [];
  for (const title of titles) {
    const lecture = await prisma.lecture.create({
      data: { userId: user.id, courseId, title, status: "ready" },
    });
    saved.push(lecture);
  }

  res.json({ data: saved });
});

export { router as documentRouter };
