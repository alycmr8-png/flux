import { Router } from "express";
import fs from "fs";
import { prisma } from "../lib/prisma";
import { createClerkClient } from "@clerk/backend";
import { stripe } from "../lib/stripe";
import { resolveStoredPath } from "../lib/storage";

export const accountRouter = Router();

/**
 * DELETE /api/account — erase everything belonging to the signed-in student.
 *
 * Order matters, and it is the opposite of the obvious one:
 *
 *  1. Cancel billing FIRST. The Stripe ids live on the Subscription row, and
 *     that row is cascade-deleted with the user — cancel afterwards and the
 *     card keeps being charged for an account that no longer exists.
 *  2. Read the file paths while the rows are still there.
 *  3. Delete the User row; all 14 relations cascade, so the database is clear.
 *  4. Remove the audio and photos from disk, then the Clerk identity so the
 *     email can sign up again cleanly.
 *
 * Steps 4 onward are best-effort: once the row is gone the account is gone from
 * the student's point of view, and a leftover file must not turn into a 500 that
 * makes them think it failed.
 */
accountRouter.delete("/", async (req, res) => {
  const user = (req as any).user as { id: string; clerkId: string };

  const problems: string[] = [];

  // ── 1 · stop the money ──────────────────────────────────────────────────
  const sub = await prisma.subscription.findUnique({ where: { userId: user.id } });
  if (sub?.stripeSubscriptionId && process.env.STRIPE_SECRET_KEY) {
    try {
      await stripe().subscriptions.cancel(sub.stripeSubscriptionId);
    } catch (e: any) {
      // A subscription already cancelled in Stripe is fine; anything else is not,
      // so refuse rather than delete an account that could still be billed.
      const code = e?.raw?.code ?? e?.code;
      if (code !== "resource_missing") {
        console.error("[account] could not cancel subscription:", e?.message);
        return res.status(502).json({
          error: "We couldn't cancel your subscription, so nothing was deleted. Please try again.",
        });
      }
    }
  }

  // ── 2 · note the files before the rows vanish ───────────────────────────
  const lectures = await prisma.lecture.findMany({
    where: { userId: user.id },
    select: { audioUrl: true, slidesUrl: true, imageUrls: true },
  });
  const photos = await prisma.classPhoto.findMany({
    where: { userId: user.id },
    select: { filePath: true },
  });
  const files = [
    ...lectures.flatMap(l => [l.audioUrl, l.slidesUrl, ...(l.imageUrls ?? [])]),
    ...photos.map(p => p.filePath),
  ].filter((p): p is string => !!p && !/^https?:/i.test(p));

  // ── 3 · the point of no return ──────────────────────────────────────────
  // MemoryChunk stores userId as a plain column rather than a relation, so it is
  // NOT covered by the cascade. It holds transcript and note text verbatim, so it
  // has to go first — otherwise "delete my account" quietly leaves the content behind.
  await prisma.memoryChunk.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });

  // ── 4 · best-effort cleanup ─────────────────────────────────────────────
  let filesDeleted = 0;
  for (const stored of files) {
    const path = resolveStoredPath(stored);
    if (!path) continue;
    try {
      await fs.promises.unlink(path);
      filesDeleted++;
    } catch (e: any) {
      if (e?.code !== "ENOENT") problems.push(`file ${stored}`);
    }
  }

  if (process.env.CLERK_SECRET_KEY && user.clerkId) {
    try {
      await createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY }).users.deleteUser(user.clerkId);
    } catch (e: any) {
      console.error("[account] could not delete the Clerk user:", e?.message);
      problems.push("sign-in identity");
    }
  }

  if (problems.length) console.error("[account] deleted with leftovers:", problems.join(", "));
  console.log(`[account] deleted user ${user.id} — ${filesDeleted} file(s) removed`);

  res.json({ data: { deleted: true } });
});
