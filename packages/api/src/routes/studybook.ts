import { Router } from "express";
import { quotaMiddleware } from "../services/usage";
import { prisma } from "../lib/prisma";
import { generateStudyBook, condenseTranscript, summarizeTranscript, generateFlashcardsFromTranscript, answerVideoQuestion, generateInlineQuiz, generateKeyPoints } from "../services/claude";

const router = Router();

const ytJobs = new Map<string, { status: "processing" | "ready" | "error"; data?: any; title?: string; lectureId?: string; error?: string }>();

router.get("/list", async (req, res) => {
  const user = (req as any).user;
  const books = await prisma.cheatSheet.findMany({
    where: { userId: user.id, title: { startsWith: "Study Book:" } },
    orderBy: { createdAt: "desc" },
    include: { lecture: { select: { id: true, courseId: true } } },
  });
  res.json({
    data: books.map(b => ({
      id: b.id,
      title: (b.title as string).replace(/^Study Book:\s*/, ""),
      lectureId: b.lectureId,
      courseId: (b.lecture as any)?.courseId ?? null,
      createdAt: b.createdAt,
      chapters: (b.content as any)?.chapters?.length ?? 0,
      flashcards: (b.content as any)?.chapters?.reduce(
        (acc: number, ch: any) => acc + (ch.flashcards?.length ?? 0), 0
      ) ?? 0,
    })),
  });
});

router.get("/job/:jobId", (req, res) => {
  const job = ytJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json(job);
});

router.get("/:lectureId", async (req, res) => {
  const user = (req as any).user;
  const sheet = await prisma.cheatSheet.findFirst({
    where: { lectureId: req.params.lectureId, userId: user.id, title: { startsWith: "Study Book:" } },
  });
  res.json({ data: sheet ? { id: sheet.id, ...sheet.content as object } : null });
});

router.post("/summarize", quotaMiddleware("gen"), async (req, res) => {
  const user = (req as any).user;
  const { lectureId } = req.body;
  const lecture = await prisma.lecture.findFirst({ where: { id: lectureId, userId: user.id } });
  if (!lecture?.transcript) return res.status(400).json({ error: "No transcript available." });
  const summary = await summarizeTranscript(lecture.transcript, lecture.title, user.language ?? "en");
  res.json({ data: { summary } });
});

router.post("/flashcards", quotaMiddleware("gen"), async (req, res) => {
  const user = (req as any).user;
  const { lectureId } = req.body;
  const lecture = await prisma.lecture.findFirst({ where: { id: lectureId, userId: user.id } });
  if (!lecture?.transcript) return res.status(400).json({ error: "No transcript available." });
  const flashcards = await generateFlashcardsFromTranscript(lecture.transcript, user.language ?? "en");
  res.json({ data: { flashcards } });
});

router.post("/inline-quiz", quotaMiddleware("gen"), async (req, res) => {
  const user = (req as any).user;
  const { lectureId } = req.body;
  const lecture = await prisma.lecture.findFirst({ where: { id: lectureId, userId: user.id } });
  if (!lecture?.transcript) return res.status(400).json({ error: "No transcript available." });
  const questions = await generateInlineQuiz(lecture.transcript, user.language ?? "en");
  res.json({ data: { questions } });
});

router.post("/key-points", quotaMiddleware("gen"), async (req, res) => {
  const user = (req as any).user;
  const { lectureId } = req.body;
  const lecture = await prisma.lecture.findFirst({ where: { id: lectureId, userId: user.id } });
  if (!lecture?.transcript) return res.status(400).json({ error: "No transcript available." });
  const points = await generateKeyPoints(lecture.transcript, user.language ?? "en");
  res.json({ data: { points } });
});

router.post("/chat", quotaMiddleware("ask"), async (req, res) => {
  const user = (req as any).user;
  const { lectureId, messages } = req.body;
  const lecture = await prisma.lecture.findFirst({ where: { id: lectureId, userId: user.id } });
  if (!lecture?.transcript) return res.status(400).json({ error: "No transcript available." });
  const reply = await answerVideoQuestion(lecture.transcript, lecture.title, messages, user.language ?? "en");
  res.json({ data: { reply } });
});

router.post("/generate", quotaMiddleware("gen"), async (req, res) => {
  const user = (req as any).user;
  const { lectureId, transcript: transcriptOverride } = req.body as { lectureId: string; transcript?: string };

  const lecture = await prisma.lecture.findFirst({ where: { id: lectureId, userId: user.id } });
  if (!lecture) return res.status(404).json({ error: "Lecture not found" });

  const transcript = transcriptOverride ?? lecture.transcript ?? "";
  if (!transcript) return res.status(400).json({ error: "No transcript available." });

  // Persist edited transcript if provided
  if (transcriptOverride) {
    await prisma.lecture.update({ where: { id: lectureId }, data: { transcript: transcriptOverride } });
  }

  const source = await condenseTranscript(transcript, [], lecture.title, user.language ?? "en");
  const book = await generateStudyBook(source, lecture.title, user.language);

  const existing = await prisma.cheatSheet.findFirst({
    where: { lectureId, userId: user.id, title: { startsWith: "Study Book:" } },
  });

  if (existing) {
    await prisma.cheatSheet.update({ where: { id: existing.id }, data: { content: book } });
  } else {
    await prisma.cheatSheet.create({
      data: { lectureId, userId: user.id, title: `Study Book: ${lecture.title}`, content: book },
    });
  }

  res.json({ data: book });
});

router.post("/generate-from-course", quotaMiddleware("gen"), async (req, res) => {
  const user = (req as any).user;
  const { courseId, title, lectureIds, noteIds, notes } = req.body as {
    courseId: string;
    title?: string;
    lectureIds?: string[];
    noteIds?: string[];
    notes?: Array<{ name: string; text: string }>;
  };

  if (!courseId) return res.status(400).json({ error: "courseId is required" });

  const course = await prisma.course.findFirst({ where: { id: courseId, userId: user.id } });
  if (!course) return res.status(404).json({ error: "Course not found" });

  const lectureWhere: any = { courseId, userId: user.id, status: "ready", transcript: { not: null } };
  if (lectureIds?.length) lectureWhere.id = { in: lectureIds };

  const lectures = await prisma.lecture.findMany({
    where: lectureWhere,
    orderBy: { createdAt: "asc" },
  });

  let dbNotes: any[] = [];
  if (noteIds === undefined) {
    // "use all" mode — include every note in the course
    dbNotes = await prisma.note.findMany({ where: { userId: user.id, courseId } });
  } else if (noteIds.length) {
    dbNotes = await prisma.note.findMany({ where: { id: { in: noteIds }, userId: user.id, courseId } });
  }

  const inlineNotes = (notes ?? []).filter((n) => n.text?.trim());

  if (!lectures.length && !dbNotes.length && !inlineNotes.length) {
    return res.status(400).json({ error: "No materials found yet. Record a lecture, upload a file, or save a note first." });
  }

  // Uploaded files — cheat sheets from documents (not Study Books, not lecture cheat sheets)
  const uploadedFileSheets = await prisma.cheatSheet.findMany({
    where: {
      userId: user.id,
      title: { not: { startsWith: "Study Book:" } },
      lecture: { courseId, userId: user.id },
    },
    include: { lecture: { select: { id: true, title: true, audioUrl: true } } },
  });
  // Only keep sheets from uploaded documents (no audioUrl = uploaded file, not recording)
  const docSheets = uploadedFileSheets.filter(
    s => !s.lecture?.audioUrl && !s.title.includes("— Cheat Sheet")
  );

  // ── Separate recordings (long, need condensing) from notes/files (short, keep verbatim) ──
  const transcriptParts: string[] = [];
  const verbatimParts: string[] = [];

  for (const l of lectures) {
    if (l.transcript?.trim()) transcriptParts.push(`[Recording: ${l.title}]\n${l.transcript}`);
  }
  for (const s of docSheets) {
    const c = s.content as any;
    const text = [
      c?.summary ?? "",
      ...(c?.sections ?? []).flatMap((sec: any) => [sec.heading, ...(sec.bullets ?? [])]),
      ...(c?.keyTerms ?? []).map((kt: any) => `${kt.term}: ${kt.definition}`),
    ].filter(Boolean).join("\n");
    if (text.trim()) verbatimParts.push(`[Uploaded file: ${s.title}]\n${text}`);
  }
  // Notes always verbatim — never truncated
  const seenNoteIds = new Set<string>();
  for (const n of dbNotes) {
    if (n.text?.trim()) { seenNoteIds.add(n.id); verbatimParts.push(`[Note: ${n.name}]\n${n.text}`); }
  }
  for (const n of inlineNotes) {
    if (n.text?.trim()) verbatimParts.push(`[Note: ${n.name}]\n${n.text}`);
  }

  if (!transcriptParts.length && !verbatimParts.length) {
    return res.status(400).json({ error: "No content found for this class." });
  }

  const bookTitle = title?.trim() || `${course.name} — Study Book`;
  const jobId = `cb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  ytJobs.set(jobId, { status: "processing" });

  const deadline = setTimeout(() => {
    if (ytJobs.get(jobId)?.status === "processing")
      ytJobs.set(jobId, { status: "error", error: "Generation timed out — please try again." });
  }, 9 * 60 * 1000);

  (async () => {
    try {
      // Condense only the recording transcripts (the long content)
      const transcriptCombined = transcriptParts.join("\n\n---\n\n");
      const condensedTranscripts = transcriptCombined
        ? await condenseTranscript(transcriptCombined, [], bookTitle, user.language ?? "en")
        : "";

      // Notes and files are appended verbatim AFTER condensing — never truncated
      const source = [condensedTranscripts, ...verbatimParts]
        .filter(Boolean)
        .join("\n\n===\n\n")
        .slice(0, 100000);

      const book = await generateStudyBook(source, bookTitle, user.language ?? "en");

      // Need a lectureId — create a placeholder lecture if none exist for this course
      let saveLectureId = lectures[0]?.id;
      if (!saveLectureId) {
        const placeholder = await prisma.lecture.create({
          data: { userId: user.id, courseId, title: bookTitle, transcript: source, status: "ready" },
        });
        saveLectureId = placeholder.id;
      }

      const existingBook = await prisma.cheatSheet.findFirst({
        where: { userId: user.id, title: `Study Book: ${bookTitle}` },
      });
      if (existingBook) {
        await prisma.cheatSheet.update({ where: { id: existingBook.id }, data: { content: book } });
      } else {
        await prisma.cheatSheet.create({
          data: { lectureId: saveLectureId, userId: user.id, title: `Study Book: ${bookTitle}`, content: book },
        });
      }
      ytJobs.set(jobId, { status: "ready", data: book, title: bookTitle });
    } catch (e: any) {
      console.error("[generate-from-course] error:", e?.message);
      ytJobs.set(jobId, { status: "error", error: e?.message ?? "Generation failed — please try again." });
    } finally {
      clearTimeout(deadline);
    }
  })();

  res.json({ jobId });
});

export { router as studyBookRouter };
