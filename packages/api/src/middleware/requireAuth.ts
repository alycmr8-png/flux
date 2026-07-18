import { Request, Response, NextFunction } from "express";
import { verifyToken } from "@clerk/backend";
import { prisma } from "../lib/prisma";
import { verifyAudioSig } from "../lib/audioSign";

async function dbWithRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err: any) {
      const isUnreachable = err?.code === "P1001" || err?.code === "P1002";
      if (isUnreachable && i < attempts - 1) {
        // Neon is waking up — wait then retry
        await new Promise(r => setTimeout(r, 1500 * (i + 1)));
        continue;
      }
      throw err;
    }
  }
  throw new Error("Database unreachable after retries");
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  // Verify a real Clerk session token — never trust a client-supplied user id header.
  const authHeader = (req.headers["authorization"] || req.headers["Authorization"]) as string | undefined;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

  // Media elements (<audio src>) can't send Authorization headers, so lecture
  // audio streams through short-lived signed URLs minted by GET /:id/audio-url.
  if (!token) {
    const m = /^\/lectures\/([^/]+)\/audio$/.exec(req.path);
    const { uid, exp, sig } = req.query as Record<string, string | undefined>;
    if (m && uid && exp && sig && verifyAudioSig(m[1], uid, parseInt(exp, 10), sig)) {
      (req as any).user = { id: uid };
      return next();
    }
    return res.status(401).json({ error: "Unauthorized" });
  }

  let clerkUserId: string;
  try {
    const payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY! });
    clerkUserId = payload.sub as string;
  } catch {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });

  try {
    let user = await dbWithRetry(() =>
      prisma.user.findUnique({ where: { clerkId: clerkUserId } })
    );
    if (!user) {
      user = await dbWithRetry(() =>
        prisma.user.create({
          data: { clerkId: clerkUserId, email: `${clerkUserId}@clerk.local`, name: "Student" },
        })
      );
    }
    (req as any).user = user;
    next();
  } catch (err: any) {
    console.error("[requireAuth] DB error:", err?.message);
    res.status(503).json({ error: "Database is starting up — please retry in a few seconds." });
  }
}
