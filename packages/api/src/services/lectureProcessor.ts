import fs from "fs";
import { prisma } from "../lib/prisma";
import { transcribeAudio } from "./whisper";
import { condenseTranscript, generateCheatSheet, generateQuiz, generateKeyPoints, generateFlashcardsFromTranscript, correctTranscript, describeLectureImage } from "./claude";
import { syncToDrive } from "./google";
import { scheduleSpacedRepetition } from "./spaced-repetition";
import { indexSource } from "./memory";
import { withCostScope, recordAudioMinutes } from "../lib/cost";
import { resolveStoredPath } from "../lib/storage";
import { extractDocumentText, documentMimeForPath, originalNameFromPath } from "./documents";

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

/** Photos (and slides) are appended to the stored transcript under these headings. */
const APPENDED_SECTIONS = /\n\n\[(?:SLIDES|PHOTOS TAKEN IN CLASS|WRITTEN ON THE BOARD IN THIS LECTURE)\]\n[\s\S]*$/;

/** The most photos a single recording can carry — during recording and attached later. */
export const MAX_LECTURE_PHOTOS = 5;

/**
 * Processes a lecture inside a cost scope, so the log line at the end reports
 * what this lecture actually cost to turn into study material — the number the
 * plan prices have to clear.
 */
export async function processLecture(lectureId: string, userId: string, opts: { reprocess?: boolean } = {}) {
  const { result } = await withCostScope(
    `lecture ${lectureId}${opts.reprocess ? " (reprocess)" : ""}`,
    () => processLectureInner(lectureId, userId, opts),
  );
  return result;
}

async function processLectureInner(lectureId: string, userId: string, opts: { reprocess?: boolean } = {}) {
  try {
    const lecture = await prisma.lecture.findUniqueOrThrow({ where: { id: lectureId } });
    // Reprocessing (photos attached to a finished recording) starts from the transcript
    // already written and proofread, without the photo section added last time.
    const storedTranscript = (lecture.transcript ?? "").startsWith("[ERROR]") ? "" : (lecture.transcript ?? "");
    const reuse = !!opts.reprocess && storedTranscript.trim().length > 0;

    await safeStatusUpdate(lectureId, { status: "transcribing" });

    let transcript = "";
    let segments: { start: number; end: number; text: string }[] = [];

    if (!reuse && (!lecture.audioUrl || !fs.existsSync(lecture.audioUrl))) {
      throw new Error(`Audio file not found: ${lecture.audioUrl}`);
    }

    // ── Compress the stored recording (non-fatal) ──
    // Browser recordings arrive at ~64-128 kbps; 48 kbps mono mp3 is fully
    // clear for speech and roughly quadruples how many lectures fit on the
    // storage volume. Streaming/citations also get faster.
    let audioPath = lecture.audioUrl ?? "";
    if (!reuse) try {
      const compressed = await compressAudio(audioPath);
      if (compressed) {
        audioPath = compressed;
        await safeStatusUpdate(lectureId, { audioUrl: compressed });
      }
    } catch (e: any) {
      console.error("[processLecture] compression failed (non-fatal):", e?.message);
    }

    // Every recording is already transcribed live by Deepgram while it happens.
    // Paying Whisper to transcribe the same audio again doubled the per-minute
    // cost, so the live transcript is used whenever it plausibly covers the whole
    // lecture. If the stream dropped part-way (too few words for the length), or
    // there was no live transcript at all, Whisper runs as before.
    const live = (lecture.transcript ?? "").trim();
    const liveSegs = Array.isArray(lecture.segments) ? (lecture.segments as any[]) : [];
    const liveWords = live ? live.split(/\s+/).length : 0;
    const coveredSeconds = Math.max(lecture.durationSeconds || 0, liveSegs.length ? Number(liveSegs[liveSegs.length - 1]?.end) || 0 : 0);
    const minutes = Math.max(coveredSeconds / 60, 1);
    const liveIsComplete = liveWords >= 50 && liveWords / minutes >= 30;

    if (reuse) {
      transcript = storedTranscript.replace(APPENDED_SECTIONS, "");
      segments = liveSegs.map((x: any) => ({ start: Number(x.start) || 0, end: Number(x.end) || 0, text: String(x.text ?? "") }));
      console.log(`[processLecture] reprocessing with the stored transcript (${transcript.length} chars)`);
    } else if (liveIsComplete) {
      transcript = live;
      segments = liveSegs.map((x: any) => ({ start: Number(x.start) || 0, end: Number(x.end) || 0, text: String(x.text ?? "") }));
      // Already paid to Deepgram while recording; counted here so the lecture's
      // total reflects it, since the streaming happened on another connection.
      recordAudioMinutes("deepgram", minutes);
      console.log(`[processLecture] using live transcript (${liveWords} words over ${minutes.toFixed(1)} min) — Whisper skipped`);
    } else {
      if (live) console.log(`[processLecture] live transcript looks incomplete (${liveWords} words over ${minutes.toFixed(1)} min) — falling back to Whisper`);
      const spoken = (await prisma.user.findUnique({ where: { id: userId }, select: { language: true } }))?.language ?? "en";
      const result = await transcribeAudio(audioPath, spoken);
      transcript = result.text;
      segments = result.segments;
      // The worst case for margin: streamed live *and* re-transcribed in full.
      if (live) recordAudioMinutes("deepgram", minutes);
      recordAudioMinutes("whisper", minutes);
    }

    if (!transcript.trim()) throw new Error("Transcription returned an empty transcript");

    // ── Correct speech-to-text errors (punctuation, homophones, split words) ──
    // Already done for a reprocessed transcript.
    if (!reuse) try {
      transcript = await correctTranscript(transcript);
      console.log(`[processLecture] transcript corrected (${transcript.length} chars)`);
    } catch (corrErr) {
      console.error("[processLecture] correction failed (non-fatal):", (corrErr as any)?.message);
    }

    // ── Extract slide text and append to transcript (non-fatal) ──
    let extractedSlideText = "";
    if (lecture.slidesUrl && fs.existsSync(lecture.slidesUrl)) {
      try {
        const slidesMime = documentMimeForPath(lecture.slidesUrl);
        const slideText = slidesMime ? await extractDocumentText(lecture.slidesUrl, slidesMime) : "";

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
    const storedImages: string[] = ((lecture as any).imageUrls ?? []).filter(Boolean);
    const imagePaths: string[] = storedImages
      .map((f: string) => resolveStoredPath(f))
      .filter((f: string | null): f is string => !!f);
    const missingFiles = storedImages.length - imagePaths.length;
    if (imagePaths.length) {
      const lang = (await prisma.user.findUnique({ where: { id: userId }, select: { language: true } }))?.language ?? "en";
      const mimeFor = (f: string) => {
        const e = require("path").extname(f).toLowerCase();
        return e === ".png" ? "image/png" : e === ".webp" ? "image/webp" : e === ".heic" ? "image/heic" : "image/jpeg";
      };
      const parts: string[] = [];
      for (let i = 0; i < imagePaths.length; i++) {
        try {
          // A slide deck or handout carries its own text. Sending one to the vision
          // model gets it refused, and the refusal is non-fatal here, so the file
          // would silently contribute nothing to the summary or the quiz.
          const docMime = documentMimeForPath(imagePaths[i]);
          if (docMime) {
            const text = await extractDocumentText(imagePaths[i], docMime);
            const name = originalNameFromPath(imagePaths[i]);
            if (text.trim()) parts.push(`[${name ? `DOCUMENT: ${name}` : `DOCUMENT ${i + 1}`}]\n${text.trim()}`);
            continue;
          }
          const b64 = fs.readFileSync(imagePaths[i]).toString("base64");
          const text = await describeLectureImage(b64, mimeFor(imagePaths[i]), lang);
          if (text.trim()) parts.push(`[PHOTO ${i + 1}]\n${text.trim()}`);
        } catch (imgErr) {
          console.error(`[processLecture] attachment ${i + 1} unreadable (non-fatal):`, (imgErr as any)?.message);
        }
      }
      if (parts.length < imagePaths.length || missingFiles) {
        console.warn(
          `[processLecture] ${storedImages.length} photo(s) attached, ${parts.length} readable` +
          (missingFiles ? `, ${missingFiles} file(s) no longer on disk` : "") +
          " — the unreadable ones contribute nothing to the summary or quiz",
        );
      }
      if (parts.length) {
        extractedImageText = parts.join("\n\n");
        // One lecture: what was said and what was written on the board go into the
        // same transcript, so everything generated treats them as one source.
        transcript = `${transcript}\n\n[WRITTEN ON THE BOARD, AND IN FILES ATTACHED TO THIS LECTURE]\n${extractedImageText}`;
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
        // Board photos are filed under the recording itself, so Ask sees one lecture
        // (and cites it as one), not the lecture plus a separate photos source.
        extraText: extractedImageText,
      });
      console.log(`[processLecture] indexed ${count} memory chunks`);
      // Recordings processed before photos were folded in had them as their own source.
      await prisma.memoryChunk.deleteMany({ where: { sourceId: `${lectureId}_photos`, userId } }).catch(() => {});
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

    if (opts.reprocess) {
      // The fresh material replaces the old. Quizzes the student already took are
      // kept so their scores stay in Progress; clients always show the newest.
      await prisma.cheatSheet.deleteMany({ where: { lectureId, id: { not: cheatSheet.id } } }).catch(() => {});
      await prisma.quiz.deleteMany({ where: { lectureId, id: { not: quiz.id }, attempts: { none: {} } } }).catch(() => {});
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
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    console.error("[processLecture] failed for", lectureId, msg);
    // Store error reason in transcript so the frontend can display it
    await safeStatusUpdate(lectureId, { status: "error", transcript: `[ERROR] ${msg}` });
  }
}
