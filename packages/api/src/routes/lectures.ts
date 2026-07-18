import { Router } from "express";
import { quotaMiddleware } from "../services/usage";
import multer from "multer";
import { z } from "zod";
import path from "path";
import os from "os";
import fs from "fs";
import { prisma } from "../lib/prisma";
import { processLecture } from "../services/lectureProcessor";
import { audioSig } from "../lib/audioSign";

export const lectureRouter = Router();

// UPLOAD_DIR should point at persistent storage in production (Railway volume);
// the OS temp dir fallback is for local dev only — it does not survive restarts.
const uploadDir = process.env.UPLOAD_DIR || path.join(os.tmpdir(), "sano");
fs.mkdirSync(uploadDir, { recursive: true });

// Older rows may store paths from before the persistent volume existed.
function resolveAudioPath(stored: string): string | null {
  if (fs.existsSync(stored)) return stored;
  const relocated = path.join(uploadDir, path.basename(stored));
  return fs.existsSync(relocated) ? relocated : null;
}

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || (file.mimetype.includes("webm") ? ".webm" : ".m4a");
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({ storage });

lectureRouter.get("/", async (req, res) => {
  const user = (req as any).user;
  const { courseId, archived } = req.query;
  const isArchived = archived === "true";
  const lectures = await prisma.lecture.findMany({
    where: {
      userId: user.id,
      archived: isArchived,
      ...(courseId ? { courseId: String(courseId) } : {}),
    },
    include: { course: true },
    orderBy: { recordedAt: "desc" },
  });
  res.json({ data: lectures });
});

lectureRouter.get("/:id", async (req, res) => {
  const user = (req as any).user;
  const lecture = await prisma.lecture.findFirst({
    where: { id: req.params.id, userId: user.id },
    include: { course: true, cheatSheets: true, quizzes: { include: { questions: true } } },
  });
  if (!lecture) return res.status(404).json({ error: "Not found" });
  res.json({ data: lecture });
});

lectureRouter.post(
  "/",
  quotaMiddleware("lecture"),
  upload.fields([{ name: "audio", maxCount: 1 }, { name: "slides", maxCount: 1 }]),
  async (req, res) => {
    const user = (req as any).user;
    const { courseId, title } = z
      .object({ courseId: z.string(), title: z.string().optional() })
      .parse(req.body);

    const files = req.files as Record<string, Express.Multer.File[]>;
    const audioFile = files?.audio?.[0];
    const slidesFile = files?.slides?.[0];

    const lecture = await prisma.lecture.create({
      data: {
        courseId,
        userId: user.id,
        title: title || "Untitled Lecture",
        status: "processing",
        audioUrl: audioFile?.path,
        slidesUrl: slidesFile?.path,
      },
    });

    processLecture(lecture.id, user.id).catch(console.error);

    res.status(201).json({ data: lecture });
  }
);

// Mint a signed streaming URL (6h) the <audio> element can use directly —
// it can't send Authorization headers, and Clerk session tokens expire in ~60s.
lectureRouter.get("/:id/audio-url", async (req, res) => {
  const user = (req as any).user;
  const lecture = await prisma.lecture.findFirst({
    where: { id: req.params.id, userId: user.id },
    select: { id: true, audioUrl: true },
  });
  if (!lecture?.audioUrl || !resolveAudioPath(lecture.audioUrl)) {
    return res.status(404).json({ error: "Audio not found" });
  }
  const exp = Date.now() + 6 * 60 * 60 * 1000;
  const sig = audioSig(lecture.id, user.id, exp);
  res.json({ data: { url: `/api/lectures/${lecture.id}/audio?uid=${encodeURIComponent(user.id)}&exp=${exp}&sig=${sig}` } });
});

lectureRouter.get("/:id/audio", async (req, res) => {
  const user = (req as any).user;
  const lecture = await prisma.lecture.findFirst({
    where: { id: req.params.id, userId: user.id },
    select: { audioUrl: true },
  });
  const audioPath = lecture?.audioUrl ? resolveAudioPath(lecture.audioUrl) : null;
  if (!audioPath) {
    return res.status(404).json({ error: "Audio not found" });
  }
  const ext = path.extname(audioPath).toLowerCase();
  const mime = ext === ".webm" ? "audio/webm" : ext === ".mp3" ? "audio/mpeg" : "audio/mp4";
  const stat = fs.statSync(audioPath);
  res.setHeader("Content-Type", mime);
  res.setHeader("Accept-Ranges", "bytes");

  // Honor Range requests so the browser can seek straight to the cited moment
  // instead of downloading the whole lecture first.
  const range = req.headers.range;
  const match = range ? /^bytes=(\d*)-(\d*)$/.exec(range) : null;
  if (match && (match[1] || match[2])) {
    const start = match[1] ? parseInt(match[1], 10) : Math.max(0, stat.size - parseInt(match[2], 10));
    const end = match[1] && match[2] ? Math.min(parseInt(match[2], 10), stat.size - 1) : stat.size - 1;
    if (start >= stat.size || start > end) {
      res.setHeader("Content-Range", `bytes */${stat.size}`);
      return res.status(416).end();
    }
    res.status(206);
    res.setHeader("Content-Range", `bytes ${start}-${end}/${stat.size}`);
    res.setHeader("Content-Length", end - start + 1);
    fs.createReadStream(audioPath, { start, end }).pipe(res);
    return;
  }

  res.setHeader("Content-Length", stat.size);
  fs.createReadStream(audioPath).pipe(res);
});

lectureRouter.get("/:id/status", async (req, res) => {
  const user = (req as any).user;
  const lecture = await prisma.lecture.findFirst({
    where: { id: req.params.id, userId: user.id },
    select: { id: true, status: true, title: true, transcript: true },
  });
  if (!lecture) return res.status(404).json({ error: "Not found" });
  const errorMessage = lecture.status === "error" && lecture.transcript?.startsWith("[ERROR]")
    ? lecture.transcript.replace("[ERROR] ", "")
    : null;
  res.json({ data: { id: lecture.id, status: lecture.status, title: lecture.title, errorMessage } });
});

lectureRouter.patch("/:id", async (req, res) => {
  const user = (req as any).user;
  const { title } = z.object({ title: z.string().min(1) }).parse(req.body);
  const lecture = await prisma.lecture.updateMany({
    where: { id: req.params.id, userId: user.id },
    data: { title },
  });
  res.json({ data: lecture });
});

lectureRouter.patch("/:id/archive", async (req, res) => {
  const user = (req as any).user;
  await prisma.lecture.updateMany({ where: { id: req.params.id, userId: user.id }, data: { archived: true } });
  res.json({ data: { archived: true } });
});

lectureRouter.patch("/:id/restore", async (req, res) => {
  const user = (req as any).user;
  await prisma.lecture.updateMany({ where: { id: req.params.id, userId: user.id }, data: { archived: false } });
  res.json({ data: { archived: false } });
});

lectureRouter.delete("/:id", async (req, res) => {
  const user = (req as any).user;
  await prisma.lecture.deleteMany({ where: { id: req.params.id, userId: user.id } });
  res.json({ data: { deleted: true } });
});

