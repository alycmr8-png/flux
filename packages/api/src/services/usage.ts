import { prisma } from "../lib/prisma";

// Monthly quotas per plan. Free is a real taste of the product (about two
// recorded lectures a week); paid limits exist only to stop abuse, and are
// high enough that an honest heavy user never sees them.
export type UsageKind = "lecture" | "ask" | "gen";

const LIMITS: Record<"free" | "paid", Record<UsageKind, number>> = {
  free: { lecture: 8, ask: 30, gen: 15 },
  paid: { lecture: 120, ask: 1000, gen: 300 },
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

async function planFor(userId: string): Promise<"free" | "paid"> {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  const active = sub && ["active", "trialing"].includes(sub.status) && sub.currentPeriodEnd > new Date();
  return active ? "paid" : "free";
}

const KIND_FIELD: Record<UsageKind, "lectureCount" | "askCount" | "genCount"> = {
  lecture: "lectureCount",
  ask: "askCount",
  gen: "genCount",
};

// Throws QuotaError when the user is at their monthly limit; otherwise counts
// this use. Small races just overshoot by one — fine for cost control.
export async function consumeQuota(userId: string, kind: UsageKind): Promise<void> {
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
  };
}

// Route middleware: counts one use of `kind`, or answers 429 at the limit.
export function quotaMiddleware(kind: UsageKind) {
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
