import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { processLecture } from "../services/lectureProcessor";

export const lectureRouter = Router();

const upload = multer({ dest: "/tmp/studyagent" });

lectureRouter.get("/", async (req, res) => {
  const user = (req as any).user;
  const { courseId } = req.query;
  const lectures = await prisma.lecture.findMany({
    where: { userId: user.id, ...(courseId ? { courseId: String(courseId) } : {}) },
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

lectureRouter.get("/:id/status", async (req, res) => {
  const user = (req as any).user;
  const lecture = await prisma.lecture.findFirst({
    where: { id: req.params.id, userId: user.id },
    select: { id: true, status: true, title: true },
  });
  if (!lecture) return res.status(404).json({ error: "Not found" });
  res.json({ data: lecture });
});

lectureRouter.delete("/:id", async (req, res) => {
  const user = (req as any).user;
  await prisma.lecture.deleteMany({ where: { id: req.params.id, userId: user.id } });
  res.json({ data: { deleted: true } });
});
