import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

export const settingsRouter = Router();

settingsRouter.get("/", async (req, res) => {
  const user = (req as any).user;
  res.json({ data: { language: user.language ?? "en" } });
});

settingsRouter.patch("/language", async (req, res) => {
  const user = (req as any).user;
  const { language } = z.object({ language: z.enum(["en", "fr", "ar", "es", "pt"]) }).parse(req.body);
  await prisma.user.update({ where: { id: user.id }, data: { language } });
  res.json({ data: { language } });
});
