import { Router } from "express";
import { prisma } from "../lib/prisma";
import { indexSource, deleteSource } from "../services/memory";

const router = Router();

// Debounced memory indexing — notes auto-save while typing; only index after edits settle
const indexTimers = new Map<string, ReturnType<typeof setTimeout>>();
function scheduleNoteIndexing(note: { id: string; userId: string; courseId: string; name: string; text: string }) {
  const existing = indexTimers.get(note.id);
  if (existing) clearTimeout(existing);
  indexTimers.set(note.id, setTimeout(async () => {
    indexTimers.delete(note.id);
    try {
      const fresh = await prisma.note.findUnique({ where: { id: note.id } });
      if (!fresh?.text?.trim()) return;
      await indexSource({
        userId: fresh.userId,
        courseId: fresh.courseId,
        sourceType: "note",
        sourceId: fresh.id,
        sourceTitle: fresh.name,
        text: fresh.text,
      });
    } catch (e: any) { console.error("[notes] indexing failed:", e?.message); }
  }, 3000));
}

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
  if (text !== undefined) scheduleNoteIndexing(note);
  res.json({ data: note });
});

router.delete("/:id", async (req, res) => {
  const user = (req as any).user;
  await prisma.note.delete({ where: { id: req.params.id, userId: user.id } });
  try { await deleteSource(req.params.id, user.id); } catch {}
  res.json({ data: { ok: true } });
});

export { router as noteRouter };
