import { Router } from "express";
import { prisma } from "../lib/prisma";

export const cheatSheetRouter = Router();

cheatSheetRouter.get("/", async (req, res) => {
  const user = (req as any).user;
  const { lectureId, courseId } = req.query;
  const cheatSheets = await prisma.cheatSheet.findMany({
    where: {
      userId: user.id,
      ...(lectureId ? { lectureId: String(lectureId) } : {}),
      ...(courseId ? { lecture: { courseId: String(courseId) } } : {}),
    },
    include: { lecture: { select: { title: true, course: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json({ data: cheatSheets });
});

cheatSheetRouter.get("/:id", async (req, res) => {
  const user = (req as any).user;
  const cheatSheet = await prisma.cheatSheet.findFirst({
    where: { id: req.params.id, userId: user.id },
    include: { lecture: { select: { title: true, course: true } } },
  });
  if (!cheatSheet) return res.status(404).json({ error: "Not found" });
  res.json({ data: cheatSheet });
});

cheatSheetRouter.patch("/:id", async (req, res) => {
  const user = (req as any).user;
  const { title, content } = req.body as { title?: string; content?: any };
  const sheet = await prisma.cheatSheet.findFirst({ where: { id: req.params.id, userId: user.id } });
  if (!sheet) return res.status(404).json({ error: "Not found" });
  const updated = await prisma.cheatSheet.update({
    where: { id: req.params.id },
    data: { ...(title !== undefined ? { title } : {}), ...(content !== undefined ? { content } : {}) },
  });
  res.json({ data: updated });
});
