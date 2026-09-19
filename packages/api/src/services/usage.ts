import { prisma } from "../lib/prisma";

// Monthly quotas per plan. Every paid plan (Student, Semester, Annual) gets the
// same limits and differs only on price — usage doesn't grow because someone
// paid upfront, and the cheapest-per-month plan must not carry the highest caps.
export type UsageKind = "lecture" | "ask" | "gen" | "minutes";

const LIMITS: Record<"free" | "paid", Record<UsageKind, number>> = {
  // `minutes` is total audio recorded in a month — see MONTHLY_MINUTES below.
  free: { lecture: 5, ask: 20, gen: 15, minutes: 120 },
  paid: { lecture: 30, ask: 150, gen: 300, minutes: 1200 },
};

/**
 * Total minutes of audio a plan may record per month.
 *
 * Measured, not guessed: live transcription is ~92% of what a lecture costs to
 * process (a 3.4-hour lecture measured at $1.30, of which $1.20 was streaming
 * and $0.10 was every AI generation combined). Counting lectures therefore does
 * not bound cost at all — 30 lectures at the 3-hour ceiling is 90 hours of audio,
 * several times a month's subscription. Minutes are what we actually buy, so
 * minutes are what we meter.
 */
export const MONTHLY_MINUTES: Record<"free" | "paid", number> = {
  free: LIMITS.free.minutes,
  paid: LIMITS.paid.minutes,
};

// Longest single recording per plan. Transcription is billed by the minute, so
// an uncapped recording is the one thing that can sink a subscription's margin.
export const MAX_RECORDING_MINUTES: Record<"free" | "paid", number> = {
  free: 60,
  paid: 180,
};

export class QuotaError extends Error {
  kind: UsageKind;
  limit: number;
  plan: "free" | "paid";
  constructor(kind: UsageKind, limit: number, plan: "free" | "paid") {
    super("quota_exceeded");
    this.kind = kind;
    this.limit = limit;
    this.plan = plan;
  }
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function planFor(userId: string): Promise<"free" | "paid"> {
  // Local testing treats everyone as paid so limits never get in the way. Never set in production.
  if (process.env.DISABLE_QUOTAS === "true") return "paid";
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  const active = sub && ["active", "trialing"].includes(sub.status) && sub.currentPeriodEnd > new Date();
  return active ? "paid" : "free";
}

const KIND_FIELD: Record<Exclude<UsageKind, "minutes">, "lectureCount" | "askCount" | "genCount"> = {
  lecture: "lectureCount",
  ask: "askCount",
  gen: "genCount",
};

/**
 * Minutes of audio already recorded this month, summed from the lectures
 * themselves rather than a counter — the durations are already stored, and a
 * separate tally would drift when a recording is deleted or re-uploaded.
 */
export async function recordedMinutesThisMonth(userId: string): Promise<number> {
  const d = new Date();
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const agg = await prisma.lecture.aggregate({
    where: { userId, recordedAt: { gte: start } },
    _sum: { durationSeconds: true },
  });
  return Math.round((agg._sum.durationSeconds ?? 0) / 60);
}

/**
 * Throws QuotaError when this recording would take the user past their monthly
 * audio allowance. Checked before accepting an upload, since the cost is
 * incurred the moment we send the audio for transcription.
 */
export async function assertMinutesAvailable(userId: string, incomingMinutes: number): Promise<void> {
  if (process.env.DISABLE_QUOTAS === "true") return;
  const plan = await planFor(userId);
  const limit = MONTHLY_MINUTES[plan];
  const used = await recordedMinutesThisMonth(userId);
  // Allow a recording that starts inside the allowance to finish, so nobody
  // loses a lecture they already sat through; only block starting past the cap.
  if (used >= limit) throw new QuotaError("minutes", limit, plan);
}

// Throws QuotaError when the user is at their monthly limit; otherwise counts
// this use. Small races just overshoot by one — fine for cost control.
export async function consumeQuota(userId: string, kind: Exclude<UsageKind, "minutes">): Promise<void> {
  // Local development would otherwise burn the founder's own monthly allowance
  // while testing. Never set this in production.
  if (process.env.DISABLE_QUOTAS === "true") return;

  const month = currentMonth();
  const plan = await planFor(userId);
  const limit = LIMITS[plan][kind];
  const field = KIND_FIELD[kind];

  const row = await prisma.usageMonth.upsert({
    where: { userId_month: { userId, month } },
    create: { userId, month },
    update: {},
  });
  if ((row as any)[field] >= limit) {
    throw new QuotaError(kind, limit, plan);
  }
  await prisma.usageMonth.update({
    where: { id: row.id },
    data: { [field]: { increment: 1 } },
  });
}

export async function usageSummary(userId: string) {
  const month = currentMonth();
  const plan = await planFor(userId);
  const row = await prisma.usageMonth.findUnique({ where: { userId_month: { userId, month } } });
  return {
    plan,
    month,
    lecture: { used: row?.lectureCount ?? 0, limit: LIMITS[plan].lecture },
    ask: { used: row?.askCount ?? 0, limit: LIMITS[plan].ask },
    gen: { used: row?.genCount ?? 0, limit: LIMITS[plan].gen },
    minutes: { used: await recordedMinutesThisMonth(userId), limit: MONTHLY_MINUTES[plan] },
    maxRecordingMinutes: MAX_RECORDING_MINUTES[plan],
  };
}

// Route middleware: counts one use of `kind`, or answers 429 at the limit.
// Minutes are not a per-request counter — see assertMinutesAvailable.
export function quotaMiddleware(kind: Exclude<UsageKind, "minutes">) {
  return async (req: any, res: any, next: any) => {
    try {
      await consumeQuota(req.user.id, kind);
      next();
    } catch (e) {
      if (!sendQuotaError(res, e)) next(e);
    }
  };
}

// Express helper: send the standard 429 for a QuotaError, or rethrow.
export function sendQuotaError(res: any, e: unknown): boolean {
  if (e instanceof QuotaError) {
    res.status(429).json({
      error: "quota_exceeded",
      kind: e.kind,
      limit: e.limit,
      plan: e.plan,
    });
    return true;
  }
  return false;
}
