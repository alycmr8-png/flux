import { createClerkClient } from "@clerk/backend";

/**
 * Clerk is the only place a student's real email exists — our User row is a copy.
 * When that copy is wrong nobody notices in the app, but Stripe receipts, trial
 * reminders and failed-payment notices all bounce, so a subscription can lapse
 * with the student never hearing about it.
 */

let client: ReturnType<typeof createClerkClient> | undefined;

export function clerk() {
  if (!client) {
    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) throw new Error("CLERK_SECRET_KEY is not set");
    client = createClerkClient({ secretKey });
  }
  return client;
}

/**
 * Emails we generated ourselves as a stand-in. They are syntactically valid, which
 * is why they flow all the way into Stripe unchallenged, and deliverable nowhere.
 */
const PLACEHOLDER_DOMAIN = "@clerk.local";

export function isPlaceholderEmail(email: string | null | undefined): boolean {
  return !email || email.endsWith(PLACEHOLDER_DOMAIN);
}

export function placeholderEmailFor(clerkUserId: string): string {
  return `${clerkUserId}${PLACEHOLDER_DOMAIN}`;
}

/**
 * The student's real email and name from Clerk, or null when Clerk can't be
 * reached. Callers must treat null as "try again later" and never as "no email" —
 * sign-in has to keep working when Clerk is having a bad day.
 */
export async function fetchClerkIdentity(
  clerkUserId: string,
): Promise<{ email: string; name: string } | null> {
  try {
    const u = await clerk().users.getUser(clerkUserId);
    // Prefer the address Clerk treats as primary; fall back to the first verified
    // one, since that is what Stripe will actually be able to deliver to.
    const primary =
      u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId) ??
      u.emailAddresses.find((e) => e.verification?.status === "verified") ??
      u.emailAddresses[0];
    if (!primary?.emailAddress) return null;
    return {
      email: primary.emailAddress,
      name: [u.firstName, u.lastName].filter(Boolean).join(" ") || "Student",
    };
  } catch (e: any) {
    console.error(`[clerk] could not fetch identity for ${clerkUserId}:`, e?.message);
    return null;
  }
}
