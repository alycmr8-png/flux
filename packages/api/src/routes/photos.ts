import { Router } from "express";
import multer from "multer";
import path from "path";
import os from "os";
import fs from "fs";
import { prisma } from "../lib/prisma";
import { describeLectureImage } from "../services/claude";
import { indexSource, deleteSource } from "../services/memory";
import { consumeQuota, sendQuotaError } from "../services/usage";
import { photoSig } from "../lib/audioSign";
import { ensureUploadDir } from "../lib/storage";

export const photoRouter = Router();

// Same storage as lecture audio — see lib/storage.ts.
const uploadDir = ensureUploadDir();

// The vision model reads these formats; HEIC has to be converted on the device first.
const READABLE = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_PHOTOS = 10;

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || `.${file.mimetype.split("/")[1] ?? "jpg"}`;
      cb(null, `photo-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024, files: MAX_PHOTOS },
});

function signedImageUrl(photoId: string, userId: string) {
  const exp = Date.now() + 6 * 60 * 60 * 1000;
  return `/api/photos/${photoId}/image?uid=${encodeURIComponent(userId)}&exp=${exp}&sig=${photoSig(photoId, userId, exp)}`;
}

function present(photo: { id: string; courseId: string; text: string; status: string; createdAt: Date }, userId: string) {
  return {
    id: photo.id,
    courseId: photo.courseId,
    text: photo.text,
    status: photo.status,
    createdAt: photo.createdAt,
    imageUrl: signedImageUrl(photo.id, userId),
  };
}

function photoTitle(date: Date) {
  return `Photo — ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

/** Reads a stored photo and files what it shows into the class's memory. Runs after the upload responds. */
async function readPhoto(photoId: string, userId: string) {
  const photo = await prisma.classPhoto.findUnique({ where: { id: photoId } });
  if (!photo) return;
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { language: true } });
    const base64 = fs.readFileSync(photo.filePath).toString("base64");
    const text = await describeLectureImage(base64, photo.mimeType, user?.language ?? "en");
    await prisma.classPhoto.update({ where: { id: photoId }, data: { text, status: "ready" } });
    if (text.trim()) {
      await indexSource({
        userId,
        courseId: photo.courseId,
        sourceType: "photo",
        sourceId: photo.id,
        sourceTitle: photoTitle(photo.createdAt),
        text,
      });
    }
  } catch (err: any) {
    console.error(`[photos] could not read ${photoId}:`, err?.message);
    await prisma.classPhoto.update({ where: { id: photoId }, data: { status: "error" } }).catch(() => {});
  }
}

// POST /api/photos — multipart: courseId, photos[] (up to 10)
photoRouter.post("/", upload.array("photos", MAX_PHOTOS), async (req, res, next) => {
  const user = (req as any).user;
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const discard = () => files.forEach(f => fs.promises.unlink(f.path).catch(() => {}));

  const courseId = String(req.body.courseId ?? "");
  const course = courseId ? await prisma.course.findFirst({ where: { id: courseId, userId: user.id } }) : null;
  if (!course) { discard(); return res.status(404).json({ error: "Class not found" }); }
  if (!files.length) return res.status(400).json({ error: "Add at least one photo." });
  if (files.some(f => !READABLE.has(f.mimetype))) {
    discard();
    return res.status(415).json({ error: "Photos must be JPEG, PNG, WebP or GIF." });
  }

  try {
    // One upload — however many photos — counts as one generation.
    await consumeQuota(user.id, "gen");
  } catch (e) {
    discard();
    return sendQuotaError(res, e) ? undefined : next(e);
  }

  const photos = await Promise.all(files.map(f =>
    prisma.classPhoto.create({
      data: { userId: user.id, courseId, filePath: f.path, mimeType: f.mimetype },
    })
  ));
  res.status(201).json({ data: photos.map(p => present(p, user.id)) });

  for (const p of photos) readPhoto(p.id, user.id);
});

// GET /api/photos?courseId=
photoRouter.get("/", async (req, res) => {
  const user = (req as any).user;
  const courseId = String(req.query.courseId ?? "");
  const photos = await prisma.classPhoto.findMany({
    where: { userId: user.id, ...(courseId ? { courseId } : {}) },
    orderBy: { createdAt: "desc" },
  });
  res.json({ data: photos.map(p => present(p, user.id)) });
});

// GET /api/photos/:id/image — reached through the signed URL (see requireAuth)
photoRouter.get("/:id/image", async (req, res) => {
  const user = (req as any).user;
  const photo = await prisma.classPhoto.findFirst({ where: { id: req.params.id, userId: user.id } });
  if (!photo || !fs.existsSync(photo.filePath)) return res.status(404).json({ error: "Photo not found" });
  res.setHeader("Content-Type", photo.mimeType);
  res.setHeader("Cache-Control", "private, max-age=21600");
  fs.createReadStream(photo.filePath).pipe(res);
});

// POST /api/photos/:id/retry — read a photo again after an error
photoRouter.post("/:id/retry", async (req, res) => {
  const user = (req as any).user;
  const photo = await prisma.classPhoto.findFirst({ where: { id: req.params.id, userId: user.id } });
  if (!photo) return res.status(404).json({ error: "Photo not found" });
  await prisma.classPhoto.update({ where: { id: photo.id }, data: { status: "reading" } });
  res.json({ data: present({ ...photo, status: "reading" }, user.id) });
  readPhoto(photo.id, user.id);
});

// DELETE /api/photos/:id
photoRouter.delete("/:id", async (req, res) => {
  const user = (req as any).user;
  const photo = await prisma.classPhoto.findFirst({ where: { id: req.params.id, userId: user.id } });
  if (!photo) return res.status(404).json({ error: "Photo not found" });
  await prisma.classPhoto.delete({ where: { id: photo.id } });
  await deleteSource(photo.id, user.id).catch(() => {});
  fs.promises.unlink(photo.filePath).catch(() => {});
  res.json({ data: { ok: true } });
});
