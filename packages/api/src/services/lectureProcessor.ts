import fs from "fs";
import { prisma } from "../lib/prisma";
import { transcribeAudio } from "./whisper";
import { condenseTranscript, generateCheatSheet, generateQuiz, generateKeyPoints, generateFlashcardsFromTranscript, correctTranscript, describeLectureImage } from "./claude";
import { syncToDrive } from "./google";
import { scheduleSpacedRepetition } from "./spaced-repetition";
import { indexSource } from "./memory";

// Re-encodes a recording to 48 kbps mono mp3 next to the original, deletes the
// original, and returns the new path — or null when ffmpeg is unavailable.
async function compressAudio(inputPath: string): Promise<string | null> {
  const path = require("path");
  const { spawn } = require("child_process");
  const outPath = inputPath.replace(/\.[^.]+$/, "") + ".c.mp3";
  if (inputPath.endsWith(".c.mp3")) return null; // already compressed

  const ok = await new Promise<boolean>(resolve => {
    const proc = spawn("ffmpeg", ["-y", "-i", inputPath, "-ac", "1", "-ar", "16000", "-b:a", "48k", outPath]);
    proc.on("error", () => resolve(false)); // ffmpeg missing (local dev without it)
    proc.on("close", (code: number) => resolve(code === 0));
  });
  if (!ok || !fs.existsSync(outPath) || fs.statSync(outPath).size === 0) {
    try { fs.unlinkSync(outPath); } catch { /* may not exist */ }
    return null;
  }
  try { fs.unlinkSync(inputPath); } catch { /* original may be locked; not fatal */ }
  return outPath;
}

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

    // ── Compress the stored recording (non-fatal) ──
    // Browser recordings arrive at ~64-128 kbps; 48 kbps mono mp3 is fully
    // clear for speech and roughly quadruples how many lectures fit on the
    // storage volume. Streaming/citations also get faster.
    let audioPath = lecture.audioUrl;
    try {
      const compressed = await compressAudio(lecture.audioUrl);
      if (compressed) {
        audioPath = compressed;
        await safeStatusUpdate(lectureId, { audioUrl: compressed });
      }
    } catch (e: any) {
      console.error("[processLecture] compression failed (non-fatal):", e?.message);
    }

    const result = await transcribeAudio(audioPath);
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

    // ── Read photos taken during the lecture and append what they show (non-fatal) ──
    // Whiteboards and slides carry the formulas the lecturer never said out loud,
    // so this runs before generation and feeds the same transcript.
    let extractedImageText = "";
    const imagePaths: string[] = ((lecture as any).imageUrls ?? []).filter((f: string) => f && fs.existsSync(f));
    if (imagePaths.length) {
      const lang = (await prisma.user.findUnique({ where: { id: userId }, select: { language: true } }))?.language ?? "en";
      const mimeFor = (f: string) => {
        const e = require("path").extname(f).toLowerCase();
        return e === ".png" ? "image/png" : e === ".webp" ? "image/webp" : e === ".heic" ? "image/heic" : "image/jpeg";
      };
      const parts: string[] = [];
      for (let i = 0; i < imagePaths.length; i++) {
        try {
          const b64 = fs.readFileSync(imagePaths[i]).toString("base64");
          const text = await describeLectureImage(b64, mimeFor(imagePaths[i]), lang);
          if (text.trim()) parts.push(`[PHOTO ${i + 1}]\n${text.trim()}`);
        } catch (imgErr) {
          console.error(`[processLecture] photo ${i + 1} unreadable (non-fatal):`, (imgErr as any)?.message);
        }
      }
      if (parts.length) {
        extractedImageText = parts.join("\n\n");
        transcript = `${transcript}\n\n[PHOTOS TAKEN IN CLASS]\n${extractedImageText}`;
        console.log(`[processLecture] appended ${parts.length} photo transcription(s)`);
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
      if (extractedImageText.trim()) {
        await indexSource({
          userId,
          courseId: lecture.courseId,
          sourceType: "lecture",
          sourceId: `${lectureId}_photos`,
          sourceTitle: `${lecture.title} — photos`,
          text: extractedImageText,
        });
      }
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

    const [cheatSheetContent, quizData, keyPoints, flashcards] = await Promise.all([
      generateCheatSheet(source, lecture.title, language),
      generateQuiz(source, lecture.title, language),
      generateKeyPoints(source, language).catch(() => []),
      generateFlashcardsFromTranscript(source, language).catch(() => []),
    ]);

    await prisma.lecture.update({
      where: { id: lectureId },
      data: { keyPoints: keyPoints as any, flashcards: flashcards as any },
    });

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
