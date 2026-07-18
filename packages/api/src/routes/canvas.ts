import { Router } from "express";
import { prisma } from "../lib/prisma";
import { isSyncing, normalizeBaseUrl, runCanvasSync, validateCanvas } from "../services/canvas";

export const canvasRouter = Router();

// GET /api/canvas/status
canvasRouter.get("/status", async (req, res) => {
  const user = (req as any).user;
  const conn = await prisma.canvasConnection.findUnique({
    where: { userId: user.id },
    select: { baseUrl: true, lastSyncAt: true, lastResult: true },
  });
  res.json({
    data: {
      connected: !!conn,
      baseUrl: conn?.baseUrl ?? null,
      lastSyncAt: conn?.lastSyncAt ?? null,
      lastResult: conn?.lastResult ?? null,
      syncing: isSyncing(user.id),
    },
  });
});

// POST /api/canvas/connect { baseUrl, token }
canvasRouter.post("/connect", async (req, res) => {
  const user = (req as any).user;
  const { baseUrl: rawUrl, token } = req.body as { baseUrl?: string; token?: string };
  const baseUrl = normalizeBaseUrl(rawUrl ?? "");
  if (!baseUrl || !token?.trim()) {
    return res.status(400).json({ error: "invalid_input" });
  }

  try {
    await validateCanvas(baseUrl, token.trim());
  } catch {
    return res.status(400).json({ error: "invalid_credentials" });
  }

  await prisma.canvasConnection.upsert({
    where: { userId: user.id },
    create: { userId: user.id, baseUrl, token: token.trim() },
    update: { baseUrl, token: token.trim() },
  });

  // First sync runs in the background; the UI polls /status
  runCanvasSync(user.id).catch(e => console.error("[canvas] first sync failed:", e?.message));

  res.json({ data: { connected: true } });
});

// POST /api/canvas/sync — manual refresh
canvasRouter.post("/sync", async (req, res) => {
  const user = (req as any).user;
  const conn = await prisma.canvasConnection.findUnique({ where: { userId: user.id } });
  if (!conn) return res.status(400).json({ error: "not_connected" });
  if (isSyncing(user.id)) return res.json({ data: { started: false, alreadyRunning: true } });
  runCanvasSync(user.id).catch(e => console.error("[canvas] sync failed:", e?.message));
  res.json({ data: { started: true } });
});

// DELETE /api/canvas — disconnect; imported content stays
canvasRouter.delete("/", async (req, res) => {
  const user = (req as any).user;
  await prisma.canvasConnection.deleteMany({ where: { userId: user.id } });
  res.json({ data: { connected: false } });
});
