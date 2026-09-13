// Per-lecture study helpers for the Record tab's opened-lecture detail view.
// Mounted at /api/studybook for backwards compatibility with existing clients.
// The Study Book feature itself has been removed.
import { Router } from "express";
import { quotaMiddleware, consumeQuota, sendQuotaError } from "../services/usage";
import { prisma } from "../lib/prisma";
import { answerVideoQuestion, generateKeyPoints, generateFlashcardsFromTranscript } from "../services/claude";

const router = Router();

// Key points and flashcards are produced once when the lecture is processed.
// These endpoints serve what was stored; they only generate for older lectures
// that predate that, and then save the result so it never costs twice.
router.post("/key-points", async (req, res, next) => {
  const user = (req as any).user;
  const { lectureId } = req.body;
  const lecture = await prisma.lecture.findFirst({ where: { id: lectureId, userId: user.id } });
  if (!lecture) return res.status(404).json({ error: "Lecture not found." });

  const stored = lecture.keyPoints as any;
  if (Array.isArray(stored) && stored.length) return res.json({ data: { points: stored } });

  if (!lecture.transcript) return res.status(400).json({ error: "No transcript available." });
  try { await consumeQuota(user.id, "gen"); } catch (e) { return sendQuotaError(res, e) ? undefined : next(e); }

  const points = await generateKeyPoints(lecture.transcript, user.language ?? "en");
  await prisma.lecture.update({ where: { id: lecture.id }, data: { keyPoints: points as any } });
  res.json({ data: { points } });
});

router.post("/chat", quotaMiddleware("ask"), async (req, res) => {
  const user = (req as any).user;
  const { lectureId, messages } = req.body;
  const lecture = await prisma.lecture.findFirst({ where: { id: lectureId, userId: user.id } });
  if (!lecture?.transcript) return res.status(400).json({ error: "No transcript available." });
  const reply = await answerVideoQuestion(lecture.transcript, lecture.title, messages, user.language ?? "en");
  res.json({ data: { reply } });
});

router.post("/flashcards", async (req, res, next) => {
  const user = (req as any).user;
  const { lectureId } = req.body;
  const lecture = await prisma.lecture.findFirst({ where: { id: lectureId, userId: user.id } });
  if (!lecture) return res.status(404).json({ error: "Lecture not found." });

  const stored = lecture.flashcards as any;
  if (Array.isArray(stored) && stored.length) return res.json({ data: { cards: stored } });

  if (!lecture.transcript) return res.status(400).json({ error: "No transcript available." });
  try { await consumeQuota(user.id, "gen"); } catch (e) { return sendQuotaError(res, e) ? undefined : next(e); }

  const cards = await generateFlashcardsFromTranscript(lecture.transcript, user.language ?? "en");
  await prisma.lecture.update({ where: { id: lecture.id }, data: { flashcards: cards as any } });
  res.json({ data: { cards } });
});

export { router as studyBookRouter };
