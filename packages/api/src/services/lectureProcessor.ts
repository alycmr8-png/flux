import fs from "fs";
import { prisma } from "../lib/prisma";
import { transcribeAudio } from "./whisper";
import { condenseTranscript, generateCheatSheet, generateQuiz, correctTranscript } from "./claude";
import { syncToDrive } from "./google";
import { scheduleSpacedRepetition } from "./spaced-repetition";
import { indexSource } from "./memory";

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

    // ── Correct speech-to-text errors (punctuation, homophones, split words) ──
    try {
      transcript = await correctTranscript(transcript);
      console.log(`[processLecture] transcript corrected (${transcript.length} chars)`);
    } catch (corrErr) {
      console.error("[processLecture] correction failed (non-fatal):", (corrErr as any)?.message);
    }

    // ── Extract slide text and append to transcript (non-fatal) ──
    let extractedSlideText = "";
    if (lecture.slidesUrl && fs.existsSync(lecture.slidesUrl)) {
      try {
        const ext = require("path").extname(lecture.slidesUrl).toLowerCase();
        let slideText = "";

        if (ext === ".pptx") {
          const AdmZip = require("adm-zip");
          const zip = new AdmZip(lecture.slidesUrl);
          const entries: any[] = zip.getEntries();
          const slideEntries = entries
            .filter((e: any) => /^ppt\/slides\/slide\d+\.xml$/.test(e.entryName))
            .sort((a: any, b: any) => a.entryName.localeCompare(b.entryName));
          slideText = slideEntries.map((e: any) => {
            const xml: string = e.getData().toString("utf-8");
            return [...xml.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)]
              .map(m => m[1].trim()).filter(Boolean).join(" ");
          }).filter(Boolean).join("\n");
        } else if (ext === ".pdf") {
          const pdfParse = require("pdf-parse/lib/pdf-parse.js");
          const buf = fs.readFileSync(lecture.slidesUrl);
          const parsed = await pdfParse(buf);
          slideText = parsed.text ?? "";
        }

        if (slideText.trim()) {
          extractedSlideText = slideText;
          transcript = `${transcript}\n\n[SLIDES]\n${slideText}`;
          console.log(`[processLecture] appended slide text (${slideText.length} chars)`);
        }
      } catch (slideErr) {
        console.error("[processLecture] slide text extraction failed (non-fatal):", (slideErr as any)?.message);
      }
    }

    await safeStatusUpdate(lectureId, { transcript, status: "generating", segments: (segments as any) ?? undefined } as any);

    // ── Index into course memory for "Ask your course" (non-fatal) ──
    try {
      const count = await indexSource({
        userId,
        courseId: lecture.courseId,
        sourceType: "lecture",
        sourceId: lectureId,
        sourceTitle: lecture.title,
        text: transcript,
        segments,
      });
      console.log(`[processLecture] indexed ${count} memory chunks`);
      if (extractedSlideText.trim()) {
        await indexSource({
          userId,
          courseId: lecture.courseId,
          sourceType: "file",
          sourceId: `${lectureId}_slides`,
          sourceTitle: `${lecture.title} — slides`,
          text: extractedSlideText,
        });
      }
    } catch (memErr) {
      console.error("[processLecture] memory indexing failed (non-fatal):", (memErr as any)?.message);
    }

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
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    console.error("[processLecture] failed for", lectureId, msg);
    // Store error reason in transcript so the frontend can display it
    await safeStatusUpdate(lectureId, { status: "error", transcript: `[ERROR] ${msg}` });
  }
}
