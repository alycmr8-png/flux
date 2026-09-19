import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

export const courseRouter = Router();

const CourseSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  color: z.string().optional(),
});

courseRouter.get("/", async (req, res) => {
  const user = (req as any).user;
  const courses = await prisma.course.findMany({
    where: { userId: user.id },
    include: { _count: { select: { lectures: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json({ data: courses });
});

courseRouter.post("/", async (req, res) => {
  const user = (req as any).user;
  const body = CourseSchema.parse(req.body);
  const course = await prisma.course.create({ data: { ...body, userId: user.id } });
  res.status(201).json({ data: course });
});

courseRouter.delete("/:id", async (req, res) => {
  const user = (req as any).user;
  const gone = await prisma.course.deleteMany({ where: { id: req.params.id, userId: user.id } });
  // MemoryChunk holds courseId as a plain column, not a relation, so nothing
  // cascades — the course's memory has to be cleared by hand or it lingers
  // forever, still holding the transcript text it was built from.
  if (gone.count) {
    await prisma.memoryChunk.deleteMany({ where: { courseId: req.params.id, userId: user.id } });
  }
  res.json({ data: { deleted: true } });
});
