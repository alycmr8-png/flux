import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

router.get("/", async (req, res) => {
  const user = (req as any).user;
  const { from, to } = req.query as { from?: string; to?: string };
  const where: any = { userId: user.id };
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = new Date(from);
    if (to) where.date.lte = new Date(to);
  }
  const events = await prisma.calendarEvent.findMany({
    where,
    include: { course: { select: { id: true, name: true, code: true } } },
    orderBy: { date: "asc" },
  });
  res.json({ data: events });
});

router.post("/", async (req, res) => {
  const user = (req as any).user;
  const { title, date, type, courseId, description } = req.body as {
    title: string; date: string; type: string; courseId?: string; description?: string;
  };
  if (!title?.trim() || !date || !type) return res.status(400).json({ error: "title, date, and type are required" });
  const event = await prisma.calendarEvent.create({
    data: {
      userId: user.id,
      title: title.trim(),
      date: new Date(date),
      type,
      courseId: courseId || null,
      description: description?.trim() || null,
    },
    include: { course: { select: { id: true, name: true, code: true } } },
  });
  res.json({ data: event });
});

router.patch("/:id", async (req, res) => {
  const user = (req as any).user;
  const { title, date, type, courseId, description } = req.body as {
    title?: string; date?: string; type?: string; courseId?: string | null; description?: string | null;
  };
  const event = await prisma.calendarEvent.update({
    where: { id: req.params.id, userId: user.id },
    data: {
      ...(title !== undefined && { title: title.trim() }),
      ...(date !== undefined && { date: new Date(date) }),
      ...(type !== undefined && { type }),
      ...(courseId !== undefined && { courseId: courseId || null }),
      ...(description !== undefined && { description: description?.trim() || null }),
    },
    include: { course: { select: { id: true, name: true, code: true } } },
  });
  res.json({ data: event });
});

router.delete("/:id", async (req, res) => {
  const user = (req as any).user;
  await prisma.calendarEvent.delete({ where: { id: req.params.id, userId: user.id } });
  res.json({ data: { ok: true } });
});

export { router as eventRouter };
