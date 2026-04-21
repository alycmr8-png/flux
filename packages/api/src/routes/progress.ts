import { Router } from "express";
import { prisma } from "../lib/prisma";

export const progressRouter = Router();

progressRouter.get("/", async (req, res) => {
  const user = (req as any).user;

  const [lectureCount, attempts, sessions] = await Promise.all([
    prisma.lecture.count({ where: { userId: user.id, status: "ready" } }),
    prisma.quizAttempt.findMany({
      where: { userId: user.id },
      include: { quiz: { include: { lecture: { select: { courseId: true, course: true } } } } },
    }),
    prisma.studySession.findMany({
      where: { userId: user.id, completedAt: { not: null } },
      orderBy: { completedAt: "desc" },
      take: 30,
    }),
  ]);

  const avgScore =
    attempts.length > 0
      ? Math.round(attempts.reduce((acc, a) => acc + a.score, 0) / attempts.length)
      : 0;

  const retentionByCourse: Record<string, { name: string; code: string; avg: number; count: number }> = {};
  for (const attempt of attempts) {
    const course = attempt.quiz.lecture.course;
    if (!retentionByCourse[course.id]) {
      retentionByCourse[course.id] = { name: course.name, code: course.code, avg: 0, count: 0 };
    }
    retentionByCourse[course.id].avg += attempt.score;
    retentionByCourse[course.id].count++;
  }
  const courseRetention = Object.values(retentionByCourse).map((c) => ({
    ...c,
    avg: Math.round(c.avg / c.count),
  }));

  const streak = calculateStreak(sessions.map((s) => s.completedAt!));

  res.json({ data: { lectureCount, avgScore, streak, courseRetention } });
});

function calculateStreak(dates: Date[]): number {
  if (!dates.length) return 0;
  const days = new Set(dates.map((d) => d.toISOString().split("T")[0]));
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (days.has(d.toISOString().split("T")[0])) streak++;
    else break;
  }
  return streak;
}
