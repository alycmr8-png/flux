import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

export const settingsRouter = Router();

settingsRouter.get("/", async (req, res) => {
  const user = (req as any).user;
  res.json({
    data: {
      language: user.language ?? "en",
      avatar: user.avatar ?? null,
      avatarColor: user.avatarColor ?? null,
    },
  });
});

settingsRouter.patch("/avatar", async (req, res) => {
  const user = (req as any).user;
  // An avatar seed plus a hex background. The seed is alphanumeric only so it
  // can be dropped straight into the avatar image URL.
  const { avatar, avatarColor } = z
    .object({
      avatar: z.string().min(1).max(64).regex(/^[A-Za-z0-9-]+$/),
      avatarColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    })
    .parse(req.body);
  await prisma.user.update({ where: { id: user.id }, data: { avatar, avatarColor } });
  res.json({ data: { avatar, avatarColor } });
});

settingsRouter.patch("/language", async (req, res) => {
  const user = (req as any).user;
  const { language } = z.object({ language: z.enum(["en", "fr", "ar", "es", "pt"]) }).parse(req.body);
  await prisma.user.update({ where: { id: user.id }, data: { language } });
  res.json({ data: { language } });
});
