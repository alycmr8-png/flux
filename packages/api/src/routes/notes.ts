import { Router } from "express";
import { prisma } from "../lib/prisma";
import { indexSource, deleteSource, stripHtml, searchCourse } from "../services/memory";
import { completeNote, readHandwrittenMath } from "../services/claude";
import multer from "multer";

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
        text: stripHtml(fresh.text),
      });
    } catch (e: any) { console.error("[notes] indexing failed:", e?.message); }
  }, 3000));
}

// ── Autocomplete ──
// Clients ask only after a pause in typing; this also keeps a runaway client
// from turning every keystroke into a model call.
const completeLog = new Map<string, number[]>();
function allowCompletion(userId: string): boolean {
  const now = Date.now();
  const recent = (completeLog.get(userId) ?? []).filter(t => now - t < 60 * 60 * 1000);
  if ((recent.length && now - recent[recent.length - 1] < 1200) || recent.length >= 600) {
    completeLog.set(userId, recent);
    return false;
  }
  recent.push(now);
  completeLog.set(userId, recent);
  return true;
}

// POST /api/notes/read-math — multipart field "image": a data URL of the drawing → { latex }
// Sent as a form field rather than JSON so a drawing isn't cut off by the JSON body limit.
const drawingForm = multer({ limits: { fieldSize: 6 * 1024 * 1024 } }).none();
const drawingLog = new Map<string, number[]>();
router.post("/read-math", drawingForm, async (req, res) => {
  const user = (req as any).user;
  const now = Date.now();
  const recent = (drawingLog.get(user.id) ?? []).filter(t => now - t < 60 * 60 * 1000);
  if ((recent.length && now - recent[recent.length - 1] < 1500) || recent.length >= 200) {
    drawingLog.set(user.id, recent);
    return res.status(429).json({ error: "Give it a second, then try again." });
  }
  recent.push(now);
  drawingLog.set(user.id, recent);

  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(req.body?.image ?? ""));
  if (!match) return res.status(400).json({ error: "Draw something first." });
  try {
    const subject = String(req.body?.subject ?? "").slice(0, 200);
    const student = await prisma.user.findUnique({ where: { id: user.id }, select: { language: true } });
    const latex = await readHandwrittenMath(match[2], match[1], subject, student?.language ?? "en");
    res.json({ data: { latex } });
  } catch {
    res.status(502).json({ error: "Couldn't read that — try writing a little larger." });
  }
});

// POST /api/notes/complete — { courseId, noteId?, before } → { completion }
router.post("/complete", async (req, res) => {
  const user = (req as any).user;
  const { courseId, noteId, before } = req.body as { courseId?: string; noteId?: string; before?: string };
  const text = String(before ?? "").slice(-1500);
  if (!courseId || text.trim().length < 12) return res.json({ data: { completion: "" } });
  if (!allowCompletion(user.id)) return res.status(429).json({ error: "Slow down — suggestions pause for a moment." });

  const course = await prisma.course.findFirst({ where: { id: courseId, userId: user.id }, select: { id: true } });
  if (!course) return res.status(404).json({ error: "Class not found" });

  // What the class covered on this topic — skipped if the lookup is slow, so a
  // suggestion still arrives while the student is paused.
  let context: { label: string; content: string }[] = [];
  try {
    const hits = await Promise.race([
      searchCourse(user.id, courseId, text.slice(-400), 5),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("slow")), 1500)),
    ]);
    context = hits
      .filter(h => h.sourceId !== noteId && h.score > 0.2)
      .slice(0, 4)
      .map(h => ({ label: h.sourceTitle, content: h.content }));
  } catch { /* suggest from the notes alone */ }

  try {
    const student = await prisma.user.findUnique({ where: { id: user.id }, select: { language: true } });
    const completion = await completeNote(text, context, student?.language ?? "en");
    res.json({ data: { completion } });
  } catch {
    res.json({ data: { completion: "" } });
  }
});

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
