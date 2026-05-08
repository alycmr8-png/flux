import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import path from "path";
import os from "os";
import fs from "fs";
import { prisma } from "../lib/prisma";
import { processLecture } from "../services/lectureProcessor";

export const lectureRouter = Router();

const uploadDir = path.join(os.tmpdir(), "sano");
fs.mkdirSync(uploadDir, { recursive: true });

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

lectureRouter.get("/:id/audio", async (req, res) => {
  const user = (req as any).user;
  const lecture = await prisma.lecture.findFirst({
    where: { id: req.params.id, userId: user.id },
    select: { audioUrl: true },
  });
  if (!lecture?.audioUrl || !fs.existsSync(lecture.audioUrl)) {
    return res.status(404).json({ error: "Audio not found" });
  }
  const ext = path.extname(lecture.audioUrl).toLowerCase();
  const mime = ext === ".webm" ? "audio/webm" : "audio/mp4";
  const stat = fs.statSync(lecture.audioUrl);
  res.setHeader("Content-Type", mime);
  res.setHeader("Content-Length", stat.size);
  res.setHeader("Accept-Ranges", "bytes");
  fs.createReadStream(lecture.audioUrl).pipe(res);
});

lectureRouter.get("/:id/status", async (req, res) => {
  const user = (req as any).user;
  const lecture = await prisma.lecture.findFirst({
    where: { id: req.params.id, userId: user.id },
    select: { id: true, status: true, title: true },
  });
  if (!lecture) return res.status(404).json({ error: "Not found" });
  res.json({ data: lecture });
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
