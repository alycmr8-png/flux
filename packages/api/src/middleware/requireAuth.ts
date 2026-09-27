import { Request, Response, NextFunction } from "express";
import { verifyToken } from "@clerk/backend";
import { prisma } from "../lib/prisma";
import { verifyAudioSig, verifyPhotoSig } from "../lib/audioSign";
import { fetchClerkIdentity, isPlaceholderEmail, placeholderEmailFor } from "../lib/clerk";

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
    const photo = /^\/photos\/([^/]+)\/image$/.exec(req.path);
    const { uid, exp, sig } = req.query as Record<string, string | undefined>;
    if (m && uid && exp && sig && verifyAudioSig(m[1], uid, parseInt(exp, 10), sig)) {
      (req as any).user = { id: uid };
      return next();
    }
    if (photo && uid && exp && sig && verifyPhotoSig(photo[1], uid, parseInt(exp, 10), sig)) {
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
      // Ask Clerk for the real address rather than inventing one. This path runs
      // when a student reaches the API before the user.created webhook lands, which
      // in practice is every signup — so a placeholder here is not a rare edge
      // case, it becomes the email Stripe tries to send receipts to.
      const identity = await fetchClerkIdentity(clerkUserId);
      try {
        user = await dbWithRetry(() =>
          prisma.user.create({
            data: {
              clerkId: clerkUserId,
              // Only if Clerk is unreachable — sign-in must not fail over this, and
              // the repair below picks it up on a later request.
              email: identity?.email ?? placeholderEmailFor(clerkUserId),
              name: identity?.name ?? "Student",
            },
          })
        );
      } catch (err: any) {
        // email is unique, so a row already holds this address under a different
        // clerkId. That is the same person arriving with a new Clerk identity —
        // which is exactly what moving from a development to a production instance
        // does to every existing account. Adopt the row rather than refusing: their
        // classes, lectures and notes hang off it, and a failed create here leaves
        // them locked out of their own data with nothing they can do about it.
        //
        // Only ever on a verified address. An unverified one would let anyone who
        // types someone else's email claim their account.
        const emailTaken = err?.code === "P2002";
        if (!emailTaken || !identity?.email || !identity.verified) throw err;
        console.warn(
          `[requireAuth] adopting existing account for ${identity.email} into clerkId ${clerkUserId}`,
        );
        user = await dbWithRetry(() =>
          prisma.user.update({
            where: { email: identity.email },
            data: { clerkId: clerkUserId, name: identity.name },
          })
        );
      }
    } else if (isPlaceholderEmail(user.email)) {
      // Repair a row that was created without a real address, so existing accounts
      // heal themselves instead of needing a migration.
      const identity = await fetchClerkIdentity(clerkUserId);
      if (identity) {
        user = await dbWithRetry(() =>
          prisma.user.update({
            where: { id: user!.id },
            data: { email: identity.email, name: identity.name },
          })
        );
      }
    }
    (req as any).user = user;
    next();
  } catch (err: any) {
    // Only a genuinely unreachable database gets the "starting up, retry" message.
    // Reporting every failure that way was actively misleading: a unique-constraint
    // violation is permanent, and telling the student to wait a few seconds sends
    // them to retry something that can never succeed.
    const unreachable = err?.code === "P1001" || err?.code === "P1002";
    console.error(`[requireAuth] ${err?.code ?? "error"}: ${err?.message}`);
    if (unreachable) {
      return res.status(503).json({ error: "Database is starting up — please retry in a few seconds." });
    }
    res.status(500).json({ error: "We couldn't load your account. Please try again, or contact support if it persists." });
  }
}
