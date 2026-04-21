import fs from "fs";
import { prisma } from "../lib/prisma";
import { transcribeAudio } from "./whisper";
import { generateCheatSheet } from "./claude";
import { generateQuiz } from "./claude";
import { syncToDrive } from "./google";
import { scheduleSpacedRepetition } from "./spaced-repetition";

export async function processLecture(lectureId: string, userId: string) {
  try {
    const lecture = await prisma.lecture.findUniqueOrThrow({ where: { id: lectureId } });

    await prisma.lecture.update({ where: { id: lectureId }, data: { status: "transcribing" } });

    let transcript = "";
    if (lecture.audioUrl && fs.existsSync(lecture.audioUrl)) {
      transcript = await transcribeAudio(lecture.audioUrl);
      await prisma.lecture.update({
        where: { id: lectureId },
        data: { transcript, status: "generating" },
      });
    }

    const [cheatSheetContent, quizData] = await Promise.all([
      generateCheatSheet(transcript, lecture.title),
      generateQuiz(transcript, lecture.title),
    ]);

    const [cheatSheet, quiz] = await Promise.all([
      prisma.cheatSheet.create({
        data: {
          lectureId,
          userId,
          title: `${lecture.title} — Cheat Sheet`,
          content: cheatSheetContent as any,
        },
      }),
      prisma.quiz.create({
        data: {
          lectureId,
          userId,
          title: `${lecture.title} — Practice Quiz`,
          questions: {
            create: quizData.map((q) => ({
              question: q.question,
              options: q.options,
              correctIndex: q.correctIndex,
              explanation: q.explanation,
              timestampSeconds: q.timestampSeconds,
            })),
          },
        },
      }),
    ]);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { googleTokens: true },
    });

    if (user?.googleTokens) {
      const driveUrl = await syncToDrive(user, cheatSheetContent, lecture.title);
      if (driveUrl) {
        await prisma.cheatSheet.update({ where: { id: cheatSheet.id }, data: { driveUrl } });
      }
      await scheduleSpacedRepetition(user, lectureId);
    }

    await prisma.lecture.update({ where: { id: lectureId }, data: { status: "ready" } });
  } catch (err) {
    console.error("Processing failed for lecture", lectureId, err);
    await prisma.lecture.update({ where: { id: lectureId }, data: { status: "error" } });
  }
}
