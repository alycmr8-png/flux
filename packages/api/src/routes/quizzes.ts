import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { generateQuiz } from "../services/claude";

export const quizRouter = Router();

quizRouter.post("/generate", async (req, res) => {
  const user = (req as any).user;
  const { lectureId, title: customTitle } = z.object({
    lectureId: z.string(),
    title: z.string().optional(),
  }).parse(req.body);

  const lecture = await prisma.lecture.findFirst({
    where: { id: lectureId, userId: user.id },
    include: { cheatSheets: { take: 1, orderBy: { createdAt: "desc" } } },
  });
  if (!lecture) return res.status(404).json({ error: "Lecture not found" });

  let source = lecture.transcript;
  if (!source) {
    const sheet = (lecture as any).cheatSheets?.[0];
    if (sheet?.content) {
      const c = sheet.content as any;
      if (c._type === "studybook") {
        source = [
          c.executiveSummary ?? "",
          ...(c.chapters ?? []).flatMap((ch: any) => [ch.title, ch.explanation ?? "", ...(ch.keyPoints ?? [])]),
        ].join("\n\n");
      } else {
        source = [
          c.summary ?? "",
          ...(c.sections ?? []).flatMap((s: any) => [s.heading, ...(s.bullets ?? [])]),
          ...(c.keyTerms ?? []).map((kt: any) => `${kt.term}: ${kt.definition}`),
        ].join("\n\n");
      }
    }
  }
  if (!source) return res.status(400).json({ error: "Lecture has no content to generate a quiz from" });

  const questions = await generateQuiz(source, lecture.title, user.language ?? "en");

  const quiz = await prisma.quiz.create({
    data: {
      userId: user.id,
      lectureId: lecture.id,
      title: customTitle?.trim() || `Quiz — ${lecture.title}`,
      questions: {
        create: questions.map((q) => ({
          question: q.question,
          options: q.options,
          correctIndex: q.correctIndex,
          explanation: q.explanation,
          timestampSeconds: q.timestampSeconds ?? null,
        })),
      },
    },
  });

  res.status(201).json({ data: quiz });
});

quizRouter.get("/", async (req, res) => {
  const user = (req as any).user;
  const { lectureId, courseId } = req.query;
  const quizzes = await prisma.quiz.findMany({
    where: {
      userId: user.id,
      ...(lectureId ? { lectureId: String(lectureId) } : {}),
      ...(courseId ? { lecture: { courseId: String(courseId) } } : {}),
    },
    include: {
      lecture: { select: { title: true, course: true } },
      _count: { select: { questions: true, attempts: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json({ data: quizzes });
});

quizRouter.get("/:id", async (req, res) => {
  const user = (req as any).user;
  const quiz = await prisma.quiz.findFirst({
    where: { id: req.params.id, userId: user.id },
    include: { questions: true, lecture: { select: { title: true, course: true } } },
  });
  if (!quiz) return res.status(404).json({ error: "Not found" });
  res.json({ data: quiz });
});

quizRouter.post("/:id/attempt", async (req, res) => {
  const user = (req as any).user;
  const { answers } = z.object({ answers: z.array(z.number()) }).parse(req.body);

  const quiz = await prisma.quiz.findFirst({
    where: { id: req.params.id, userId: user.id },
    include: { questions: true },
  });
  if (!quiz) return res.status(404).json({ error: "Not found" });

  const correct = quiz.questions.filter((q, i) => q.correctIndex === answers[i]).length;
  const score = quiz.questions.length > 0 ? (correct / quiz.questions.length) * 100 : 0;

  const attempt = await prisma.quizAttempt.create({
    data: { quizId: quiz.id, userId: user.id, answers, score },
  });

  res.status(201).json({ data: { attempt, score, correct, total: quiz.questions.length } });
});

quizRouter.get("/:id/attempts", async (req, res) => {
  const user = (req as any).user;
  const attempts = await prisma.quizAttempt.findMany({
    where: { quizId: req.params.id, userId: user.id },
    orderBy: { completedAt: "desc" },
  });
  res.json({ data: attempts });
});
