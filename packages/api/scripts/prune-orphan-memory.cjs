/**
 * Removes MemoryChunk rows whose course or user no longer exists.
 *
 * MemoryChunk stores courseId and userId as plain columns rather than relations,
 * so deleting a class or an account never cleared its memory. Both paths now
 * clean up after themselves; this clears what the old behaviour left behind.
 *
 * Orphans are unreachable from the app (search is always scoped to a live course),
 * so they are pure dead weight — storage, and a larger pgvector index to search.
 *
 *   node --env-file=.env scripts/prune-orphan-memory.cjs          # report only
 *   node --env-file=.env scripts/prune-orphan-memory.cjs --delete # actually prune
 */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const DELETE = process.argv.includes("--delete");

(async () => {
  const [courses, users, groups] = await Promise.all([
    prisma.course.findMany({ select: { id: true } }),
    prisma.user.findMany({ select: { id: true } }),
    prisma.memoryChunk.groupBy({ by: ["courseId", "userId"], _count: { _all: true } }),
  ]);
  const liveCourses = new Set(courses.map(c => c.id));
  const liveUsers = new Set(users.map(u => u.id));

  const orphans = groups.filter(g => !liveUsers.has(g.userId) || !liveCourses.has(g.courseId));
  const kept = groups.filter(g => liveUsers.has(g.userId) && liveCourses.has(g.courseId));
  const orphanRows = orphans.reduce((n, g) => n + g._count._all, 0);
  const keptRows = kept.reduce((n, g) => n + g._count._all, 0);

  console.log(`keeping  ${keptRows} chunk(s) across ${kept.length} live course(s)`);
  console.log(`orphaned ${orphanRows} chunk(s) across ${orphans.length} dead course(s)`);

  if (!orphanRows) return console.log("nothing to prune.");
  if (!DELETE) return console.log("\ndry run — re-run with --delete to remove them.");

  let removed = 0;
  for (const g of orphans) {
    const { count } = await prisma.memoryChunk.deleteMany({
      where: { courseId: g.courseId, userId: g.userId },
    });
    removed += count;
  }
  console.log(`pruned ${removed} chunk(s).`);
})()
  .catch(e => { console.error("failed:", e.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
