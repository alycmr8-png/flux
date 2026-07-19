import { Router } from "express";
import { prisma } from "../lib/prisma";

// Public router — mounted BEFORE requireAuth so visitors can join without an
// account. Keep it tiny and unexciting: an email in, a row stored.

export const waitlistRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

waitlistRouter.post("/", async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase().slice(0, 254);
  const source = String(req.body?.source ?? "landing").slice(0, 60);
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: "invalid_email" });
  }
  try {
    await prisma.waitlistEmail.upsert({
      where: { email },
      create: { email, source },
      update: {}, // already on the list — treat as success, no dupes
    });
    res.json({ data: { joined: true } });
  } catch (e: any) {
    console.error("[waitlist] save failed:", e?.message);
    res.status(500).json({ error: "try_again" });
  }
});

// Founder-only CSV export, guarded by a secret key set in the environment.
waitlistRouter.get("/export", async (req, res) => {
  const key = process.env.WAITLIST_EXPORT_KEY;
  if (!key || req.query.key !== key) {
    return res.status(401).json({ error: "unauthorized" });
  }
  const rows = await prisma.waitlistEmail.findMany({ orderBy: { createdAt: "asc" } });
  const csv = ["email,source,joined_at", ...rows.map(r =>
    `${r.email},${r.source ?? ""},${r.createdAt.toISOString()}`
  )].join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=flux-waitlist.csv");
  res.send(csv);
});
