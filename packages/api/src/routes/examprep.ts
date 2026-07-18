import { Router } from "express";
import { quotaMiddleware } from "../services/usage";
import { prisma } from "../lib/prisma";
import { generateExamPack } from "../services/claude";

export const examPrepRouter = Router();

function fmtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

const TYPE_LABELS: Record<string, string> = { lecture: "Lecture", video: "Video", file: "File", note: "Your note" };

// GET /api/examprep?courseId= — the latest pack for a course
examPrepRouter.get("/", async (req, res) => {
  const user = (req as any).user;
  const { courseId } = req.query as { courseId?: string };
  if (!courseId) return res.status(400).json({ error: "courseId is required" });
  const pack = await prisma.examPack.findFirst({
    where: { userId: user.id, courseId },
    orderBy: { createdAt: "desc" },
  });
  res.json({ data: pack });
});

// POST /api/examprep/generate { courseId, examDate? }
// Builds an exam pack from the ENTIRE course memory — no source selection.
examPrepRouter.post("/generate", quotaMiddleware("gen"), async (req, res) => {
  const user = (req as any).user;
  const { courseId, examDate } = req.body as { courseId?: string; examDate?: string };
  if (!courseId) return res.status(400).json({ error: "courseId is required" });

  const course = await prisma.course.findFirst({ where: { id: courseId, userId: user.id } });
  if (!course) return res.status(404).json({ error: "Course not found" });

  // Everything in memory, cheap fields only — embeddings stay in the DB.
  const chunks = await prisma.memoryChunk.findMany({
    where: { userId: user.id, courseId },
    select: { sourceType: true, sourceId: true, sourceTitle: true, content: true, meta: true },
    orderBy: { createdAt: "asc" },
  });
  if (!chunks.length) {
    return res.status(400).json({ error: "empty_memory" });
  }

  // Pick a representative sample: every source is present, chunks spread evenly
  // across each source's timeline, total capped so the prompt stays affordable.
  const bySource = new Map<string, typeof chunks>();
  for (const c of chunks) {
    const arr = bySource.get(c.sourceId) ?? [];
    arr.push(c);
    bySource.set(c.sourceId, arr);
  }
  const MAX_CONTEXT = 60;
  const perSource = Math.max(2, Math.floor(MAX_CONTEXT / bySource.size));
  const selected: typeof chunks = [];
  for (const arr of bySource.values()) {
    if (arr.length <= perSource) {
      selected.push(...arr);
    } else {
      const step = arr.length / perSource;
      for (let i = 0; i < perSource; i++) selected.push(arr[Math.floor(i * step)]);
    }
  }

  const sources = selected.slice(0, MAX_CONTEXT + 20).map((c, i) => {
    const startSec = (c.meta as any)?.startSec ?? null;
    const time = startSec != null ? ` · ${fmtTime(startSec)}` : "";
    return {
      n: i + 1,
      sourceType: c.sourceType,
      sourceId: c.sourceId,
      sourceTitle: c.sourceTitle,
      startSec,
      label: `${TYPE_LABELS[c.sourceType] ?? "Source"}: ${c.sourceTitle}${time}`,
      content: c.content.slice(0, 700),
    };
  });

  const noteTitles = [...new Set(chunks.filter(c => c.sourceType === "note").map(c => c.sourceTitle))];

  const examDateObj = examDate ? new Date(examDate) : null;
  const daysUntilExam =
    examDateObj && !isNaN(examDateObj.getTime())
      ? Math.max(0, Math.ceil((examDateObj.getTime() - Date.now()) / 86_400_000))
      : null;

  let raw: any;
  try {
    raw = await generateExamPack(
      course.name,
      sources.map(s => ({ n: s.n, label: s.label, content: s.content })),
      noteTitles,
      daysUntilExam,
      user.language ?? "en"
    );
  } catch (e: any) {
    console.error("[examprep] generation failed:", e?.message);
    return res.status(502).json({ error: "Generation failed — please try again." });
  }

  // Map the model's [n] cites back to real sources in the same shape the Ask
  // tab's clickable citations use, so the web can reuse openCitation as-is.
  const byN = new Map(sources.map(s => [s.n, s]));
  const toCitations = (ns: unknown) =>
    (Array.isArray(ns) ? ns : [])
      .map(n => byN.get(Number(n)))
      .filter(Boolean)
      .map(s => ({
        n: s!.n,
        sourceType: s!.sourceType,
        sourceId: s!.sourceId,
        sourceTitle: s!.sourceTitle,
        startSec: s!.startSec,
        label: s!.label,
      }))
      // same source+moment cited twice on one item → keep one
      .filter((c, i, arr) => arr.findIndex(x => x.sourceId === c.sourceId && x.startSec === c.startSec) === i);

  const content = {
    generatedAt: new Date().toISOString(),
    examDate: examDateObj && !isNaN(examDateObj.getTime()) ? examDateObj.toISOString() : null,
    sourceCount: bySource.size,
    chunkCount: chunks.length,
    topics: (raw.topics ?? []).map((t: any) => ({
      name: String(t.name ?? ""),
      importance: Math.min(5, Math.max(1, Number(t.importance) || 3)),
      why: String(t.why ?? ""),
      citations: toCitations(t.cite),
    })),
    questions: (raw.questions ?? []).map((q: any) => ({
      type: q.type === "mcq" ? "mcq" : "short",
      question: String(q.question ?? ""),
      options: q.type === "mcq" && Array.isArray(q.options) ? q.options.map(String) : null,
      correctAnswer: String(q.correctAnswer ?? ""),
      explanation: String(q.explanation ?? ""),
      citations: toCitations(q.cite),
    })),
    gaps: (raw.gaps ?? []).map((g: any) => ({
      topic: String(g.topic ?? ""),
      evidence: String(g.evidence ?? ""),
      suggestion: String(g.suggestion ?? ""),
    })),
    plan: (raw.plan ?? []).map((p: any) => ({
      label: String(p.label ?? ""),
      focus: String(p.focus ?? ""),
      items: Array.isArray(p.items) ? p.items.map(String) : [],
    })),
  };

  const pack = await prisma.examPack.create({
    data: {
      userId: user.id,
      courseId,
      examDate: content.examDate ? new Date(content.examDate) : null,
      content: content as any,
    },
  });

  res.json({ data: pack });
});
