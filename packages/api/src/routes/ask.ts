import { Router } from "express";
import { prisma } from "../lib/prisma";
import { answerCourseQuestion } from "../services/claude";
import { indexSource, searchCourse, courseMemoryStatus } from "../services/memory";

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
      indexed += await indexSource({
        userId: user.id,
        courseId,
        sourceType: lectureSourceType(l),
        sourceId: l.id,
        sourceTitle: l.title,
        text: l.transcript,
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
        text: n.text,
      });
    } catch (e: any) {
      console.error(`[ask/index] note ${n.id} failed:`, e?.message);
    }
  }

  const status = await courseMemoryStatus(user.id, courseId);
  res.json({ data: { indexed, ...status } });
});

// POST /api/ask — course-scoped RAG chat with citations
router.post("/", async (req, res) => {
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

  const sources = chunks.map((c, i) => {
    const n = i + 1;
    const time = c.meta?.startSec != null ? ` · ${fmtTime(c.meta.startSec)}` : "";
    const typeLabel = { lecture: "Lecture", video: "Video", file: "File", note: "Your note" }[c.sourceType] ?? "Source";
    return { n, chunk: c, label: `${typeLabel}: ${c.sourceTitle}${time}` };
  });

  const reply = await answerCourseQuestion(
    course.name,
    sources.map(s => ({ n: s.n, label: s.label, content: s.chunk.content })),
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
      sourceType: s.chunk.sourceType,
      sourceId: s.chunk.sourceId,
      sourceTitle: s.chunk.sourceTitle,
      startSec: s.chunk.meta?.startSec ?? null,
      snippet: s.chunk.content.slice(0, 200),
    }));

  res.json({ data: { reply, citations } });
});

export { router as askRouter };
