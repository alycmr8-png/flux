/**
 * Who is using Ucorns, and what they actually did.
 *
 * Clerk's dashboard lists signups; it cannot tell you who recorded a lecture. That
 * distinction is the whole question at launch — a signup who never recorded is a
 * different problem from one who recorded and didn't come back.
 *
 *   node packages/api/scripts/users.cjs
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const pad = (s, n) => String(s ?? "").padEnd(n).slice(0, n);

(async () => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      subscription: { select: { plan: true, status: true, currentPeriodEnd: true } },
      _count: { select: { courses: true, lectures: true, notes: true } },
    },
  });

  // Minutes recorded is the cost driver, so it's worth seeing per person.
  const minutes = new Map();
  for (const g of await prisma.lecture.groupBy({
    by: ["userId"],
    _sum: { durationSeconds: true },
  })) {
    minutes.set(g.userId, Math.round((g._sum.durationSeconds ?? 0) / 60));
  }

  console.log(
    pad("EMAIL", 34), pad("JOINED", 11), pad("PLAN", 10),
    pad("CLASSES", 8), pad("LECTURES", 9), pad("MIN", 6), "NOTES",
  );
  console.log("-".repeat(92));

  let active = 0;
  for (const u of users) {
    const sub = u.subscription;
    const paid = sub && ["active", "trialing"].includes(sub.status) && sub.currentPeriodEnd > new Date();
    if (u._count.lectures > 0) active++;
    console.log(
      pad(u.email, 34),
      pad(u.createdAt.toISOString().slice(0, 10), 11),
      pad(paid ? `${sub.plan} (${sub.status})` : "free", 10),
      pad(u._count.courses, 8),
      pad(u._count.lectures, 9),
      pad(minutes.get(u.id) ?? 0, 6),
      u._count.notes,
    );
  }

  const paying = users.filter((u) => {
    const s = u.subscription;
    return s && ["active", "trialing"].includes(s.status) && s.currentPeriodEnd > new Date();
  }).length;

  console.log("-".repeat(92));
  console.log(`${users.length} accounts · ${active} recorded at least one lecture · ${paying} paying`);
  const totalMin = [...minutes.values()].reduce((a, b) => a + b, 0);
  // Deepgram is ~92% of what a lecture costs, so this approximates total spend.
  console.log(`${totalMin} minutes of audio recorded in total (~$${(totalMin * 0.0059).toFixed(2)} of transcription)`);
})()
  .catch((e) => { console.error(e.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
