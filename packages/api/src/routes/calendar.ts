import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { getGoogleCalendarClient } from "../services/google";
import { scheduleSpacedRepetition } from "../services/spaced-repetition";

export const calendarRouter = Router();

calendarRouter.get("/sessions", async (req, res) => {
  const user = (req as any).user;
  const { from, to } = req.query;
  const sessions = await prisma.studySession.findMany({
    where: {
      userId: user.id,
      scheduledAt: {
        gte: from ? new Date(String(from)) : new Date(),
        ...(to ? { lte: new Date(String(to)) } : {}),
      },
    },
    include: { lecture: { select: { title: true, course: true } } },
    orderBy: { scheduledAt: "asc" },
  });
  res.json({ data: sessions });
});

calendarRouter.post("/connect", async (req, res) => {
  const { code } = z.object({ code: z.string() }).parse(req.body);
  const user = (req as any).user;
  const { oauth2Client } = getGoogleCalendarClient();
  const { tokens } = await oauth2Client.getToken(code);

  await prisma.googleToken.upsert({
    where: { userId: user.id },
    update: {
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token!,
      expiresAt: new Date(tokens.expiry_date!),
    },
    create: {
      userId: user.id,
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token!,
      expiresAt: new Date(tokens.expiry_date!),
    },
  });

  res.json({ data: { connected: true } });
});

calendarRouter.get("/auth-url", (_req, res) => {
  const { oauth2Client } = getGoogleCalendarClient();
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/drive.file",
    ],
  });
  res.json({ data: { url } });
});

calendarRouter.get("/status", async (req, res) => {
  const user = (req as any).user;
  const token = await prisma.googleToken.findUnique({ where: { userId: user.id } });
  res.json({ data: { connected: !!token } });
});

calendarRouter.post("/schedule/:lectureId", async (req, res) => {
  const user = (req as any).user;
  const { examDate } = z.object({ examDate: z.string().optional() }).parse(req.body);
  const sessions = await scheduleSpacedRepetition(user, req.params.lectureId, examDate);
  res.json({ data: sessions });
});
