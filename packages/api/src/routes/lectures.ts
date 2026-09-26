import { Router } from "express";
import { quotaMiddleware, planFor, MAX_RECORDING_MINUTES, assertMinutesAvailable, sendQuotaError } from "../services/usage";
import multer from "multer";
import { z } from "zod";
import path from "path";
import os from "os";
import fs from "fs";
import { prisma } from "../lib/prisma";
import { processLecture, MAX_LECTURE_PHOTOS } from "../services/lectureProcessor";
import { DOCUMENT_TYPES, isDocument, legacyOfficeName, storedFilename } from "../services/documents";

// Images the vision model reads, plus the documents that carry their own text.
const ATTACHABLE = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", ...Object.keys(DOCUMENT_TYPES)]);
import { audioSig } from "../lib/audioSign";
import { ensureUploadDir, resolveStoredPath } from "../lib/storage";

export const lectureRouter = Router();

const uploadDir = ensureUploadDir();

const resolveAudioPath = resolveStoredPath;

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_req, file, cb) => {
    // Documents carry the student's own filename in the stored path — the processor
    // reads it back to label the file in the transcript and in course memory.
    if (isDocument(file.mimetype)) return cb(null, storedFilename(file.originalname, file.mimetype));
    const ext = path.extname(file.originalname) || (file.mimetype.includes("webm") ? ".webm" : ".m4a");
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
// A 3-hour live transcript plus its timestamps can approach multer's 1 MB field default.
const upload = multer({ storage, limits: { fieldSize: 8 * 1024 * 1024 } });

lectureRouter.get("/", async (req, res) => {
  const user = (req as any).user;
  const { courseId, archived } = req.query;
  const isArchived = archived === "true";
  const lectures = await prisma.lecture.findMany({
    where: {
      userId: user.id,
      archived: isArchived,
      ...(courseId ? { courseId: String(courseId) } : {}),
    },
    include: { course: true },
    orderBy: { recordedAt: "desc" },
  });
  res.json({ data: lectures });
});

// POST /api/lectures/:id/photos — attach photos to a finished recording and reprocess it
// More files than the cap makes multer throw; answer with the limit instead of a 500.
const acceptLecturePhotos = (req: any, res: any, next: any) =>
  upload.array("images", MAX_LECTURE_PHOTOS)(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) return res.status(400).json({ error: `A recording can have up to ${MAX_LECTURE_PHOTOS} photos.` });
    next(err);
  });

/**
 * Rebuilding starts a short while after the last photo lands, not immediately.
 *
 * Students add board photos one at a time. Kicking off a rebuild on the first
 * one locked the recording as "processing", so the second photo was refused and
 * the work was redone for each photo besides. Each new photo now resets the
 * timer, so a burst of them costs one rebuild.
 */
const REPROCESS_DELAY_MS = 20_000;
const pendingReprocess = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleReprocess(lectureId: string, userId: string) {
  clearTimeout(pendingReprocess.get(lectureId));
  pendingReprocess.set(lectureId, setTimeout(() => {
    pendingReprocess.delete(lectureId);
    processLecture(lectureId, userId, { reprocess: true }).catch(console.error);
  }, REPROCESS_DELAY_MS));
}

lectureRouter.post("/:id/photos", acceptLecturePhotos, async (req, res) => {
  const user = (req as any).user;
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const discard = () => files.forEach(f => fs.promises.unlink(f.path).catch(() => {}));

  const lecture = await prisma.lecture.findFirst({ where: { id: String(req.params.id), userId: user.id } });
  if (!lecture) { discard(); return res.status(404).json({ error: "Recording not found" }); }
  if (!files.length) return res.status(400).json({ error: "Add at least one photo." });
  // "processing" only blocks when a rebuild is actually running; if one is merely
  // queued, this photo joins it rather than being turned away.
  if (!["ready", "error"].includes(lecture.status) && !pendingReprocess.has(lecture.id)) {
    discard();
    return res.status(409).json({ error: "This recording is still being processed — try again when it's ready." });
  }
  const rejected = files.find(f => !ATTACHABLE.has(f.mimetype));
  if (rejected) {
    discard();
    const legacy = legacyOfficeName(rejected.mimetype);
    return res.status(415).json({
      error: legacy
        ? `${legacy} can't be read. Save it as PDF or .pptx and try again.`
        : "Attach an image (JPEG, PNG, WebP, GIF) or a document (PDF, .pptx, .docx, .txt, .md, .csv).",
    });
  }
  const existing = (lecture.imageUrls ?? []).filter(p => fs.existsSync(p));
  if (existing.length + files.length > MAX_LECTURE_PHOTOS) {
    discard();
    const left = Math.max(0, MAX_LECTURE_PHOTOS - existing.length);
    return res.status(400).json({
      error: left ? `This recording can take ${left} more photo${left === 1 ? "" : "s"}.` : `This recording already has ${MAX_LECTURE_PHOTOS} photos.`,
      remaining: left,
    });
  }

  // Photos attached to a recording are part of that lecture — the recording was
  // already counted when it was uploaded, so this is not charged again. The
  // five-photo cap bounds how many times one recording can be rebuilt.
  const updated = await prisma.lecture.update({
    where: { id: lecture.id },
    data: { imageUrls: [...existing, ...files.map(f => f.path)], status: "processing" },
  });
  scheduleReprocess(lecture.id, user.id);
  res.status(202).json({
    data: {
      id: updated.id,
      status: updated.status,
      photoCount: updated.imageUrls.length,
      // The client can tell the student how long they have to add another.
      startsInMs: REPROCESS_DELAY_MS,
    },
  });
});

lectureRouter.get("/:id", async (req, res) => {
  const user = (req as any).user;
  const lecture = await prisma.lecture.findFirst({
    where: { id: req.params.id, userId: user.id },
    include: { course: true, cheatSheets: true, quizzes: { include: { questions: true } } },
  });
  if (!lecture) return res.status(404).json({ error: "Not found" });
  res.json({ data: lecture });
});

lectureRouter.post(
  "/",
  quotaMiddleware("lecture"),
  upload.fields([{ name: "audio", maxCount: 1 }, { name: "slides", maxCount: 1 }, { name: "images", maxCount: MAX_LECTURE_PHOTOS }]),
  async (req, res) => {
    const user = (req as any).user;
    const { courseId, title, durationSeconds, liveTranscript, liveSegments } = z
      .object({
        courseId: z.string(),
        title: z.string().optional(),
        durationSeconds: z.coerce.number().nonnegative().optional(),
        liveTranscript: z.string().optional(),
        liveSegments: z.string().optional(),
      })
      .parse(req.body);

    const files = req.files as Record<string, Express.Multer.File[]>;
    const audioFile = files?.audio?.[0];
    const slidesFile = files?.slides?.[0];
    const imageFiles = files?.images ?? [];

    // The app stops recording at the plan's limit; this backs that up for
    // anything that gets past it. Size is checked too, since duration is
    // client-reported — 12 kB/s leaves plenty of room above the 32 kbps we record at.
    const capMinutes = MAX_RECORDING_MINUTES[await planFor(user.id)];
    const capSeconds = capMinutes * 60;
    const tooLong = (durationSeconds ?? 0) > capSeconds + 120;
    const tooBig = (audioFile?.size ?? 0) > capSeconds * 12_000;
    if (tooLong || tooBig) {
      for (const f of [audioFile, slidesFile, ...imageFiles]) if (f?.path) fs.promises.unlink(f.path).catch(() => {});
      const hours = capMinutes >= 60 ? `${capMinutes / 60} hour${capMinutes === 60 ? "" : "s"}` : `${capMinutes} minutes`;
      return res.status(413).json({ error: `Recordings on your plan can be up to ${hours} long.` });
    }

    // Transcription is bought by the minute, so the month's total audio — not the
    // number of lectures — is what has to stay inside the plan.
    try {
      await assertMinutesAvailable(user.id, Math.round((durationSeconds ?? 0) / 60));
    } catch (e) {
      for (const f of [audioFile, slidesFile, ...imageFiles]) if (f?.path) fs.promises.unlink(f.path).catch(() => {});
      if (sendQuotaError(res, e)) return;
      throw e;
    }

    let segments: any = undefined;
    try { segments = liveSegments ? JSON.parse(liveSegments) : undefined; } catch { segments = undefined; }

    const lecture = await prisma.lecture.create({
      data: {
        courseId,
        userId: user.id,
        title: title || "Untitled Lecture",
        status: "processing",
        audioUrl: audioFile?.path,
        slidesUrl: slidesFile?.path,
        imageUrls: imageFiles.map(f => f.path),
        durationSeconds: Math.round(durationSeconds ?? 0),
        // Kept so processing can reuse it instead of transcribing the audio a second time.
        transcript: liveTranscript?.trim() || null,
        segments: Array.isArray(segments) ? segments : undefined,
      },
    });

    processLecture(lecture.id, user.id).catch(console.error);

    res.status(201).json({ data: lecture });
  }
);

// Mint a signed streaming URL (6h) the <audio> element can use directly —
// it can't send Authorization headers, and Clerk session tokens expire in ~60s.
lectureRouter.get("/:id/audio-url", async (req, res) => {
  const user = (req as any).user;
  const lecture = await prisma.lecture.findFirst({
    where: { id: req.params.id, userId: user.id },
    select: { id: true, audioUrl: true },
  });
  if (!lecture?.audioUrl || !resolveAudioPath(lecture.audioUrl)) {
    return res.status(404).json({ error: "Audio not found" });
  }
  const exp = Date.now() + 6 * 60 * 60 * 1000;
  const sig = audioSig(lecture.id, user.id, exp);
  res.json({ data: { url: `/api/lectures/${lecture.id}/audio?uid=${encodeURIComponent(user.id)}&exp=${exp}&sig=${sig}` } });
});

lectureRouter.get("/:id/audio", async (req, res) => {
  const user = (req as any).user;
  const lecture = await prisma.lecture.findFirst({
    where: { id: req.params.id, userId: user.id },
    select: { audioUrl: true },
  });
  const audioPath = lecture?.audioUrl ? resolveAudioPath(lecture.audioUrl) : null;
  if (!audioPath) {
    return res.status(404).json({ error: "Audio not found" });
  }
  const ext = path.extname(audioPath).toLowerCase();
  const mime = ext === ".webm" ? "audio/webm" : ext === ".mp3" ? "audio/mpeg" : "audio/mp4";
  const stat = fs.statSync(audioPath);
  res.setHeader("Content-Type", mime);
  res.setHeader("Accept-Ranges", "bytes");

  // Honor Range requests so the browser can seek straight to the cited moment
  // instead of downloading the whole lecture first.
  const range = req.headers.range;
  const match = range ? /^bytes=(\d*)-(\d*)$/.exec(range) : null;
  if (match && (match[1] || match[2])) {
    const start = match[1] ? parseInt(match[1], 10) : Math.max(0, stat.size - parseInt(match[2], 10));
    const end = match[1] && match[2] ? Math.min(parseInt(match[2], 10), stat.size - 1) : stat.size - 1;
    if (start >= stat.size || start > end) {
      res.setHeader("Content-Range", `bytes */${stat.size}`);
      return res.status(416).end();
    }
    res.status(206);
    res.setHeader("Content-Range", `bytes ${start}-${end}/${stat.size}`);
    res.setHeader("Content-Length", end - start + 1);
    fs.createReadStream(audioPath, { start, end }).pipe(res);
    return;
  }

  res.setHeader("Content-Length", stat.size);
  fs.createReadStream(audioPath).pipe(res);
});

lectureRouter.get("/:id/status", async (req, res) => {
  const user = (req as any).user;
  const lecture = await prisma.lecture.findFirst({
    where: { id: req.params.id, userId: user.id },
    select: { id: true, status: true, title: true, transcript: true },
  });
  if (!lecture) return res.status(404).json({ error: "Not found" });
  const errorMessage = lecture.status === "error" && lecture.transcript?.startsWith("[ERROR]")
    ? lecture.transcript.replace("[ERROR] ", "")
    : null;
  res.json({ data: { id: lecture.id, status: lecture.status, title: lecture.title, errorMessage } });
});

lectureRouter.patch("/:id", async (req, res) => {
  const user = (req as any).user;
  const { title } = z.object({ title: z.string().min(1) }).parse(req.body);
  const lecture = await prisma.lecture.updateMany({
    where: { id: req.params.id, userId: user.id },
    data: { title },
  });
  res.json({ data: lecture });
});

lectureRouter.patch("/:id/archive", async (req, res) => {
  const user = (req as any).user;
  await prisma.lecture.updateMany({ where: { id: req.params.id, userId: user.id }, data: { archived: true } });
  res.json({ data: { archived: true } });
});

lectureRouter.patch("/:id/restore", async (req, res) => {
  const user = (req as any).user;
  await prisma.lecture.updateMany({ where: { id: req.params.id, userId: user.id }, data: { archived: false } });
  res.json({ data: { archived: false } });
});

lectureRouter.delete("/:id", async (req, res) => {
  const user = (req as any).user;
  await prisma.lecture.deleteMany({ where: { id: req.params.id, userId: user.id } });
  res.json({ data: { deleted: true } });
});

