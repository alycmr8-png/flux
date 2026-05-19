import { Router } from "express";
import multer from "multer";
import { prisma } from "../lib/prisma";
import { generateStructuredLearningFile } from "../services/claude";

const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (buf: Buffer) => Promise<{ text: string }>;

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

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
    } catch {
      return res.status(400).json({
        error: "Could not read this PDF. Make sure it is not password-protected and contains selectable text (not a scanned image).",
      });
    }
  } else {
    text = file.buffer.toString("utf-8");
  }

  if (!text.trim()) {
    return res.status(400).json({
      error: "No text found in this file. If it is a scanned PDF, try a version with selectable text.",
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
