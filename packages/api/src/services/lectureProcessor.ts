import fs from "fs";
import path from "path";
import { prisma } from "../lib/prisma";
import { transcribeAudio } from "./whisper";
import { condenseTranscript, generateCheatSheet, generateQuiz, alignSlidesToTranscript } from "./claude";
import { syncToDrive } from "./google";
import { scheduleSpacedRepetition } from "./spaced-repetition";

async function safeStatusUpdate(lectureId: string, data: object) {
  try {
    await prisma.lecture.update({ where: { id: lectureId }, data });
  } catch {
    try {
      await prisma.$disconnect();
      await prisma.$connect();
      await prisma.lecture.update({ where: { id: lectureId }, data });
    } catch (e) {
      console.error("[safeStatusUpdate] failed after reconnect:", e);
    }
  }
}

export async function processLecture(lectureId: string, userId: string) {
  try {
    const lecture = await prisma.lecture.findUniqueOrThrow({ where: { id: lectureId } });

    await safeStatusUpdate(lectureId, { status: "transcribing" });

    let transcript = "";
    let segments: { start: number; end: number; text: string }[] = [];

    if (!lecture.audioUrl || !fs.existsSync(lecture.audioUrl)) {
      throw new Error(`Audio file not found: ${lecture.audioUrl}`);
    }

    const result = await transcribeAudio(lecture.audioUrl);
    transcript = result.text;
    segments = result.segments;

    if (!transcript.trim()) throw new Error("Whisper returned empty transcript");

    await safeStatusUpdate(lectureId, { transcript, status: "generating" });

    const user = await prisma.user.findUnique({ where: { id: userId }, include: { googleTokens: true } });
    const language = user?.language ?? "en";

    // Condense long transcripts via Map-Reduce before passing to generate functions
    const source = await condenseTranscript(transcript, segments, lecture.title, language);

    const [cheatSheetContent, quizData] = await Promise.all([
      generateCheatSheet(source, lecture.title, language),
      generateQuiz(source, lecture.title, language),
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

    // ── Slide alignment (non-fatal) ──
    if (lecture.slidesUrl && fs.existsSync(lecture.slidesUrl)) {
      try {
        const pdfParse = (await import("pdf-parse")).default;
        const pdfBuffer = fs.readFileSync(lecture.slidesUrl);

        // Extract text per page via pagerender callback
        const pageTexts: string[] = [];
        await pdfParse(pdfBuffer, {
          pagerender: async (pageData: any) => {
            const content = await pageData.getTextContent();
            const text = (content.items as any[]).map((item: any) => item.str).join(" ").trim();
            pageTexts.push(text);
            return text;
          },
        });

        const slideCount = pageTexts.length;
        const totalDuration = lecture.durationSeconds || segments.reduce((m, s) => Math.max(m, s.end), 0);

        if (slideCount > 0) {
          const slideAlignment = await alignSlidesToTranscript(pageTexts, segments, totalDuration);
          await safeStatusUpdate(lectureId, { slideCount, slideAlignment: slideAlignment as any });
          console.log(`[processLecture] slide alignment done: ${slideCount} slides`);
        }
      } catch (slideErr) {
        console.error("[processLecture] slide alignment failed (non-fatal):", (slideErr as any)?.message);
      }
    }

    if (user?.googleTokens) {
      try {
        const driveUrl = await syncToDrive(user, cheatSheetContent, lecture.title);
        if (driveUrl) {
          await prisma.cheatSheet.update({ where: { id: cheatSheet.id }, data: { driveUrl } });
        }
        await scheduleSpacedRepetition(user, lectureId);
      } catch (driveErr) {
        console.error("[processLecture] Google Drive sync failed (non-fatal):", (driveErr as any)?.message);
      }
    }

    await safeStatusUpdate(lectureId, { status: "ready" });
  } catch (err) {
    console.error("Processing failed for lecture", lectureId, err);
    await safeStatusUpdate(lectureId, { status: "error" });
  }
}
