import { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const clerkUserId = req.headers["x-clerk-user-id"] as string;
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });

  const user = await prisma.user.findUnique({ where: { clerkId: clerkUserId } });
  if (!user) return res.status(401).json({ error: "User not found" });

  (req as any).user = user;
  next();
}
