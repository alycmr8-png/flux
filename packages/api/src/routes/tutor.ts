import { Router } from "express";
import { prisma } from "../lib/prisma";
import { streamSocraticResponse } from "../services/claude";

const router = Router();

router.post("/chat", async (req, res) => {
  const user = (req as any).user;
  const { lectureId, messages } = req.body as {
    lectureId: string;
    messages: { role: "user" | "assistant"; content: string }[];
  };

  const lecture = await prisma.lecture.findFirst({
    where: { id: lectureId, userId: user.id },
    include: { cheatSheets: { take: 1 } },
  });

  if (!lecture) return res.status(404).json({ error: "Lecture not found" });

  const context =
    lecture.transcript ??
    (lecture.cheatSheets[0] ? JSON.stringify(lecture.cheatSheets[0].content) : null);

  if (!context) {
    return res.status(400).json({ error: "Lecture is still processing. Try again once it's ready." });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    await streamSocraticResponse(context, lecture.title, messages, (chunk) => {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    });
    res.write("data: [DONE]\n\n");
  } catch (err: any) {
    res.write(`data: ${JSON.stringify({ error: err.message ?? "Stream failed" })}\n\n`);
  } finally {
    res.end();
  }
});

router.get("/lectures", async (req, res) => {
  const user = (req as any).user;
  const lectures = await prisma.lecture.findMany({
    where: { userId: user.id, status: "ready" },
    include: { course: true },
    orderBy: { recordedAt: "desc" },
  });
  res.json({ data: lectures });
});

export { router as tutorRouter };
