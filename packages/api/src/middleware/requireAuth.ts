import { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";

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
  const clerkUserId = req.headers["x-clerk-user-id"] as string;
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
