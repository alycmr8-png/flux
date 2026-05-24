import { Router } from "express";
import { prisma } from "../lib/prisma";
import { streamSocraticResponse } from "../services/claude";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const router = Router();

router.post("/chat", async (req, res) => {
  const user = (req as any).user;
  const { lectureId, messages } = req.body as {
    lectureId: string;
    messages: { role: "user" | "assistant"; content: string }[];
  };

  const lecture = await prisma.lecture.findFirst({
    where: { id: lectureId, userId: user.id },
    include: { cheatSheets: { take: 1 } },
  });

  if (!lecture) return res.status(404).json({ error: "Lecture not found" });

  const context =
    lecture.transcript ??
    (lecture.cheatSheets[0] ? JSON.stringify(lecture.cheatSheets[0].content) : null);

  if (!context) {
    return res.status(400).json({ error: "Lecture is still processing. Try again once it's ready." });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    await streamSocraticResponse(context, lecture.title, messages, (chunk) => {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    });
    res.write("data: [DONE]\n\n");
  } catch (err: any) {
    res.write(`data: ${JSON.stringify({ error: err.message ?? "Stream failed" })}\n\n`);
  } finally {
    res.end();
  }
});

router.get("/lectures", async (req, res) => {
  const user = (req as any).user;
  const lectures = await prisma.lecture.findMany({
    where: { userId: user.id, status: "ready" },
    include: { course: true },
    orderBy: { recordedAt: "desc" },
  });
  res.json({ data: lectures });
});

// ── Full-context AI Tutor ──────────────────────────────────────────────────
router.post("/ask", async (req, res) => {
  const user = (req as any).user;
  const { message, history = [] } = req.body as {
    message: string;
    history: { role: "user" | "assistant"; content: string }[];
  };

  if (!message?.trim()) return res.status(400).json({ error: "Message is required" });

  const [courses, lectures, cheatSheets, calendarEvents, notes, quizzes] = await Promise.all([
    prisma.course.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    prisma.lecture.findMany({
      where: { userId: user.id, status: "ready" },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, title: true, transcript: true, courseId: true },
    }),
    prisma.cheatSheet.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { title: true, content: true },
    }),
    prisma.calendarEvent.findMany({
      where: { userId: user.id },
      orderBy: { date: "asc" },
      take: 30,
    }),
    prisma.note.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: { name: true, text: true, courseId: true },
    }),
    prisma.quiz.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { title: true, questions: true },
    }),
  ]);

  const courseMap = new Map(courses.map(c => [c.id, c.name]));

  const classesCtx = courses.map(c => `- ${c.name} (${c.code})`).join("\n");

  const lecturesCtx = lectures.map(l => {
    const course = courseMap.get(l.courseId) ?? "Unknown";
    const snippet = l.transcript ? l.transcript.slice(0, 500).replace(/\s+/g, " ") + "…" : "No transcript";
    return `[${course}] ${l.title}\n  ${snippet}`;
  }).join("\n\n");

  const studyBooksCtx = cheatSheets.map(cs => {
    try {
      const c = typeof cs.content === "string" ? JSON.parse(cs.content) : cs.content;
      const sections = (c.sections ?? []).slice(0, 3).map((s: any) =>
        `  ${s.heading}: ${(s.bullets ?? []).slice(0, 2).join("; ")}`
      ).join("\n");
      const terms = (c.keyTerms ?? []).slice(0, 5).map((t: any) => `${t.term}: ${t.definition}`).join("; ");
      return `[${cs.title}]\n${sections}${terms ? `\n  Terms: ${terms}` : ""}`;
    } catch { return `[${cs.title}]\n  ${String(cs.content).slice(0, 300)}`; }
  }).join("\n\n");

  const calendarCtx = calendarEvents.map(e =>
    `- ${e.date ? new Date(e.date).toDateString() : "TBD"}: ${e.title} (${e.type ?? "event"})${e.courseId ? ` — ${courseMap.get(e.courseId) ?? e.courseId}` : ""}`
  ).join("\n");

  const notesCtx = notes.map(n => {
    const course = n.courseId ? (courseMap.get(n.courseId) ?? "") : "";
    return `[${n.name}${course ? ` — ${course}` : ""}]\n  ${(n.text ?? "").slice(0, 300)}`;
  }).join("\n\n");

  const quizzesCtx = quizzes.map(q => {
    const qs = Array.isArray(q.questions)
      ? (q.questions as any[]).slice(0, 3).map((qq: any) => qq.question).join("; ")
      : "";
    return `- ${q.title}: ${qs}`;
  }).join("\n");

  const context = [
    classesCtx && `CLASSES:\n${classesCtx}`,
    lecturesCtx && `LECTURES:\n${lecturesCtx}`,
    studyBooksCtx && `STUDY BOOKS:\n${studyBooksCtx}`,
    calendarCtx && `CALENDAR:\n${calendarCtx}`,
    notesCtx && `NOTES:\n${notesCtx}`,
    quizzesCtx && `QUIZZES:\n${quizzesCtx}`,
  ].filter(Boolean).join("\n\n");

  const system = `You are Flux Tutor, a personal AI tutor built into the Flux study platform. You have full access to this student's academic data — their lectures, study books, calendar events, notes, and quizzes.

Help them understand their material, prepare for exams, answer questions about their lectures, and stay on top of deadlines. When referencing content, mention the class or lecture by name. Be concise, clear, and encouraging. Today: ${new Date().toDateString()}.

${context ? `=== STUDENT DATA ===\n${context}\n=== END ===` : "No data yet — encourage them to record a lecture or upload a file."}`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system,
    messages: [
      ...history.slice(-10).map((m: any) => ({ role: m.role, content: m.content })),
      { role: "user", content: message },
    ],
  });

  const reply = response.content[0].type === "text" ? response.content[0].text : "";
  res.json({ data: { reply } });
});

export { router as tutorRouter };
