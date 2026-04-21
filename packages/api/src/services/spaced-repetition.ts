import { prisma } from "../lib/prisma";
import { createCalendarEvent } from "./google";

// SM-2 inspired intervals in days
const INTERVALS = [1, 3, 7, 14, 30];

export async function scheduleSpacedRepetition(
  user: any,
  lectureId: string,
  examDate?: string
) {
  const lecture = await prisma.lecture.findUniqueOrThrow({
    where: { id: lectureId },
    include: { course: true },
  });

  const now = new Date();
  const exam = examDate ? new Date(examDate) : null;
  const sessions = [];

  for (const dayOffset of INTERVALS) {
    const scheduledAt = new Date(now);
    scheduledAt.setDate(scheduledAt.getDate() + dayOffset);
    scheduledAt.setHours(9, 0, 0, 0);

    if (exam && scheduledAt > exam) break;

    const type = dayOffset <= 3 ? "review" : dayOffset <= 14 ? "quiz" : "cheatsheet";
    const summary = `StudyAgent: ${type === "review" ? "Review" : type === "quiz" ? "Practice Quiz" : "Cheat Sheet"} — ${lecture.title}`;

    const calendarEventId = await createCalendarEvent(
      user,
      summary,
      `${lecture.course.name} · Spaced repetition day ${dayOffset}`,
      scheduledAt
    );

    const session = await prisma.studySession.create({
      data: { userId: user.id, lectureId, scheduledAt, type, calendarEventId },
    });

    sessions.push(session);
  }

  if (exam) {
    const countdownDate = new Date(exam);
    countdownDate.setDate(countdownDate.getDate() - 1);
    countdownDate.setHours(8, 0, 0, 0);
    if (countdownDate > now) {
      const calendarEventId = await createCalendarEvent(
        user,
        `Exam Tomorrow: ${lecture.course.code} — ${lecture.title}`,
        "Final review before your exam",
        countdownDate,
        60
      );
      await prisma.studySession.create({
        data: { userId: user.id, lectureId, scheduledAt: countdownDate, type: "review", calendarEventId },
      });
    }
  }

  return sessions;
}
