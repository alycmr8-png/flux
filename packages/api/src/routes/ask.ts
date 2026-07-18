import { Router } from "express";
import { quotaMiddleware } from "../services/usage";
import { prisma } from "../lib/prisma";
import { answerCourseQuestion } from "../services/claude";
import { indexSource, searchCourse, courseMemoryStatus, stripHtml } from "../services/memory";

const router = Router();

function fmtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

function lectureSourceType(l: { audioUrl: string | null }): "lecture" | "video" | "file" {
  if (!l.audioUrl) return "file";
  if (l.audioUrl.includes("youtube.com") || l.audioUrl.includes("youtu.be")) return "video";
  return "lecture";
}

// GET /api/ask/status?courseId= — how much memory this course has
router.get("/status", async (req, res) => {
  const user = (req as any).user;
  const { courseId } = req.query as { courseId: string };
  if (!courseId) return res.status(400).json({ error: "courseId is required" });
  const status = await courseMemoryStatus(user.id, courseId);
  res.json({ data: status });
});

// POST /api/ask/index — backfill: index everything already captured in a course
router.post("/index", async (req, res) => {
  const user = (req as any).user;
  const { courseId } = req.body as { courseId: string };
  if (!courseId) return res.status(400).json({ error: "courseId is required" });

  const course = await prisma.course.findFirst({ where: { id: courseId, userId: user.id } });
  if (!course) return res.status(404).json({ error: "Course not found" });

  const lectures = await prisma.lecture.findMany({
    where: { courseId, userId: user.id, status: "ready", transcript: { not: null } },
  });
  const notes = await prisma.note.findMany({ where: { courseId, userId: user.id } });

  let indexed = 0;
  for (const l of lectures) {
    if (!l.transcript?.trim() || l.transcript.startsWith("[ERROR]")) continue;
    try {
      const storedSegments = Array.isArray((l as any).segments) ? ((l as any).segments as { start: number; end: number; text: string }[]) : null;

      if (!storedSegments?.length) {
        // No stored segments: re-indexing from plain text would WIPE the
        // timestamps on existing chunks. If this source already has
        // timestamped chunks, leave them untouched.
        const existing = await prisma.memoryChunk.findFirst({
          where: { sourceId: l.id, userId: user.id },
          select: { meta: true },
        });
        if (existing?.meta && (existing.meta as any).startSec != null) continue;
      }

      indexed += await indexSource({
        userId: user.id,
        courseId,
        sourceType: lectureSourceType(l),
        sourceId: l.id,
        sourceTitle: l.title,
        text: l.transcript,
        segments: storedSegments?.length ? storedSegments : undefined,
      });
    } catch (e: any) {
      console.error(`[ask/index] lecture ${l.id} failed:`, e?.message);
    }
  }
  for (const n of notes) {
    if (!n.text?.trim()) continue;
    try {
      indexed += await indexSource({
        userId: user.id,
        courseId,
        sourceType: "note",
        sourceId: n.id,
        sourceTitle: n.name,
        text: stripHtml(n.text),
      });
    } catch (e: any) {
      console.error(`[ask/index] note ${n.id} failed:`, e?.message);
    }
  }

  // Uploaded files — index their saved content directly (covers files whose
  // lecture has no transcript, e.g. only generated study content was stored).
  const fileSheets = await prisma.cheatSheet.findMany({
    where: { userId: user.id, lecture: { courseId, userId: user.id, audioUrl: null } },
    include: { lecture: { select: { id: true, title: true, transcript: true } } },
  });
  for (const cs of fileSheets) {
    if (cs.lecture?.transcript?.trim()) continue; // already indexed via the lecture loop
    const c = cs.content as any;
    const text =
      typeof c?.rawText === "string" && c.rawText.trim()
        ? c.rawText
        : [
            c?.summary ?? "",
            ...(c?.sections ?? []).flatMap((s: any) => [s.heading, ...(s.bullets ?? [])]),
            ...(c?.keyTerms ?? []).map((kt: any) => `${kt.term}: ${kt.definition}`),
          ]
            .filter(Boolean)
            .join("\n");
    if (!text.trim()) continue;
    try {
      indexed += await indexSource({
        userId: user.id,
        courseId,
        sourceType: "file",
        sourceId: cs.lecture?.id ?? cs.id,
        sourceTitle: cs.lecture?.title ?? cs.title,
        text,
      });
    } catch (e: any) {
      console.error(`[ask/index] file sheet ${cs.id} failed:`, e?.message);
    }
  }

  const status = await courseMemoryStatus(user.id, courseId);
  res.json({ data: { indexed, ...status } });
});

// POST /api/ask — course-scoped RAG chat with citations
router.post("/", quotaMiddleware("ask"), async (req, res) => {
  const user = (req as any).user;
  const { courseId, messages } = req.body as {
    courseId: string;
    messages: { role: "user" | "assistant"; content: string }[];
  };
  if (!courseId || !messages?.length) {
    return res.status(400).json({ error: "courseId and messages are required" });
  }

  const course = await prisma.course.findFirst({ where: { id: courseId, userId: user.id } });
  if (!course) return res.status(404).json({ error: "Course not found" });

  const question = [...messages].reverse().find(m => m.role === "user")?.content ?? "";
  const chunks = await searchCourse(user.id, courseId, question, 8);

  if (!chunks.length) {
    return res.json({
      data: {
        reply: user.language === "fr"
          ? "Je n'ai encore rien en mémoire pour ce cours. Enregistre un cours, colle une vidéo, dépose un fichier ou prends une note — et je pourrai répondre."
          : "I don't have anything in memory for this course yet. Record a lecture, paste a video, drop a file, or take a note — then I can answer.",
        citations: [],
      },
    });
  }

  // Consolidate retrieved chunks that point to the same source (and timestamp)
  // so the same lecture/video/file isn't shown as many identical references.
  const typeLabels: Record<string, string> = { lecture: "Lecture", video: "Video", file: "File", note: "Your note" };
  const groups = new Map<string, {
    sourceType: string; sourceId: string; sourceTitle: string; startSec: number | null; contents: string[];
  }>();
  for (const c of chunks) {
    const startSec = c.meta?.startSec ?? null;
    const key = `${c.sourceId}::${startSec ?? ""}`;
    const g = groups.get(key);
    if (g) { g.contents.push(c.content); }
    else groups.set(key, { sourceType: c.sourceType, sourceId: c.sourceId, sourceTitle: c.sourceTitle, startSec, contents: [c.content] });
  }

  const sources = [...groups.values()].map((g, i) => {
    const n = i + 1;
    const time = g.startSec != null ? ` · ${fmtTime(g.startSec)}` : "";
    const label = `${typeLabels[g.sourceType] ?? "Source"}: ${g.sourceTitle}${time}`;
    return { n, ...g, label, content: g.contents.join("\n\n") };
  });

  const reply = await answerCourseQuestion(
    course.name,
    sources.map(s => ({ n: s.n, label: s.label, content: s.content })),
    messages,
    user.language ?? "en"
  );

  // Only return citations the model actually used
  const usedNs = new Set([...reply.matchAll(/\[(\d+)\]/g)].map(m => Number(m[1])));
  const citations = sources
    .filter(s => usedNs.has(s.n))
    .map(s => ({
      n: s.n,
      label: s.label,
      sourceType: s.sourceType,
      sourceId: s.sourceId,
      sourceTitle: s.sourceTitle,
      startSec: s.startSec,
      snippet: s.contents[0].slice(0, 200),
    }));

  res.json({ data: { reply, citations } });
});

export { router as askRouter };
