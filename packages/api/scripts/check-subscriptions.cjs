/**
 * Read-only: shows what the Stripe webhook actually stored.
 *
 * The field that matters is currentPeriodEnd. On API version 2025-03-31.basil the
 * period moved onto the subscription item, so a handler reading the old top-level
 * field writes an Invalid Date — and planFor() compares that against now, which an
 * Invalid Date loses, leaving a paying student on the free plan. Checkout succeeds
 * either way, so this row is the only place the difference shows.
 *
 *   node packages/api/scripts/check-subscriptions.cjs
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

(async () => {
  const subs = await prisma.subscription.findMany({
    orderBy: { updatedAt: "desc" },
    take: 10,
    include: { user: { select: { email: true } } },
  });

  if (subs.length === 0) {
    console.log("No subscription rows. Checkout may have completed without the webhook firing.");
    return;
  }

  for (const s of subs) {
    const end = s.currentPeriodEnd;
    const valid = end instanceof Date && !Number.isNaN(end.getTime());
    const active = valid && ["active", "trialing"].includes(s.status) && end > new Date();
    console.log(
      [
        s.user?.email ?? s.userId,
        `plan=${s.plan}`,
        `status=${s.status}`,
        `periodEnd=${valid ? end.toISOString() : "INVALID DATE"}`,
        `→ ${active ? "reads as PAID" : "reads as FREE"}`,
      ].join("  "),
    );
  }
})()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
