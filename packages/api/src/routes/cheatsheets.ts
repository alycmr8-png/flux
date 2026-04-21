import { Router } from "express";
import { prisma } from "../lib/prisma";

export const cheatSheetRouter = Router();

cheatSheetRouter.get("/", async (req, res) => {
  const user = (req as any).user;
  const { lectureId } = req.query;
  const cheatSheets = await prisma.cheatSheet.findMany({
    where: { userId: user.id, ...(lectureId ? { lectureId: String(lectureId) } : {}) },
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
