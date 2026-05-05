import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

router.get("/", async (req, res) => {
  const user = (req as any).user;
  const { courseId } = req.query as { courseId: string };
  if (!courseId) return res.status(400).json({ error: "courseId is required" });
  const notes = await prisma.note.findMany({
    where: { userId: user.id, courseId },
    orderBy: { updatedAt: "desc" },
  });
  res.json({ data: notes });
});

router.post("/", async (req, res) => {
  const user = (req as any).user;
  const { courseId, name } = req.body as { courseId: string; name: string };
  if (!courseId || !name?.trim()) return res.status(400).json({ error: "courseId and name are required" });
  const note = await prisma.note.create({
    data: { userId: user.id, courseId, name: name.trim(), text: "" },
  });
  res.json({ data: note });
});

router.patch("/:id", async (req, res) => {
  const user = (req as any).user;
  const { name, text } = req.body as { name?: string; text?: string };
  const note = await prisma.note.update({
    where: { id: req.params.id, userId: user.id },
    data: {
      ...(name !== undefined && { name }),
      ...(text !== undefined && { text }),
    },
  });
  res.json({ data: note });
});

router.delete("/:id", async (req, res) => {
  const user = (req as any).user;
  await prisma.note.delete({ where: { id: req.params.id, userId: user.id } });
  res.json({ data: { ok: true } });
});

export { router as noteRouter };
