/**
 * Replaces @clerk.local placeholder emails with the student's real address from
 * Clerk, and corrects the email on any Stripe customer already created with one.
 *
 * Every User row was created by requireAuth's fallback rather than the user.created
 * webhook (which used a bare `create` and collided), so all of them carried a
 * placeholder. The code no longer produces them; this repairs the rows that exist.
 *
 *   node packages/api/scripts/backfill-emails.cjs           # report only
 *   node packages/api/scripts/backfill-emails.cjs --write    # apply
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const { PrismaClient } = require("@prisma/client");
const { createClerkClient } = require("@clerk/backend");

const WRITE = process.argv.includes("--write");
const prisma = new PrismaClient();

function primaryEmail(u) {
  const p =
    u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId) ??
    u.emailAddresses.find((e) => e.verification?.status === "verified") ??
    u.emailAddresses[0];
  return p?.emailAddress ?? null;
}

(async () => {
  if (!process.env.CLERK_SECRET_KEY) throw new Error("CLERK_SECRET_KEY is not set");
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const stripe = stripeKey
    ? new (require("stripe"))(stripeKey, { apiVersion: "2025-03-31.basil" })
    : null;

  const rows = await prisma.user.findMany({
    where: { email: { endsWith: "@clerk.local" } },
    include: { subscription: { select: { stripeCustomerId: true } } },
  });

  console.log(`${rows.length} rows with a placeholder email${WRITE ? "" : "  (dry run)"}\n`);
  let fixed = 0;
  let missing = 0;

  for (const row of rows) {
    let email = null;
    let name = "Student";
    try {
      const u = await clerk.users.getUser(row.clerkId);
      email = primaryEmail(u);
      name = [u.firstName, u.lastName].filter(Boolean).join(" ") || "Student";
    } catch (e) {
      // A deleted Clerk user leaves an orphaned row; there is no address to recover.
      console.log(`  ${row.clerkId}  → not in Clerk (${e.message})`);
      missing++;
      continue;
    }
    if (!email) {
      console.log(`  ${row.clerkId}  → no email on the Clerk user`);
      missing++;
      continue;
    }

    const customer = row.subscription?.stripeCustomerId;
    console.log(`  ${row.clerkId}  → ${email}${customer ? `  + stripe ${customer}` : ""}`);

    if (WRITE) {
      await prisma.user.update({ where: { id: row.id }, data: { email, name } });
      if (customer && stripe) {
        try {
          await stripe.customers.update(customer, { email, name });
        } catch (e) {
          console.log(`      stripe update failed: ${e.message}`);
        }
      }
    }
    fixed++;
  }

  console.log(
    `\n${WRITE ? "updated" : "would update"} ${fixed}` +
      (missing ? `, ${missing} unrecoverable` : "") +
      (WRITE ? "" : "\nRe-run with --write to apply."),
  );
})()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
