import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

export const quizRouter = Router();

quizRouter.get("/", async (req, res) => {
  const user = (req as any).user;
  const { lectureId } = req.query;
  const quizzes = await prisma.quiz.findMany({
    where: { userId: user.id, ...(lectureId ? { lectureId: String(lectureId) } : {}) },
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
