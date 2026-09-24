import { Router } from "express";
import { prisma } from "../lib/prisma";
import { stripe } from "../lib/stripe";
import { fetchClerkIdentity, isPlaceholderEmail } from "../lib/clerk";

const router = Router();

/**
 * The email on the Stripe customer is the only way Stripe can reach the student:
 * receipts, the trial-ending notice, and the dunning emails when a renewal fails.
 * A placeholder address there means a subscription can lapse in silence, so resolve
 * the real one from Clerk before handing anything to Stripe.
 */
async function billingIdentity(user: any): Promise<{ email: string; name: string }> {
  if (!isPlaceholderEmail(user.email)) return { email: user.email, name: user.name };
  const identity = await fetchClerkIdentity(user.clerkId);
  if (!identity) return { email: user.email, name: user.name };
  await prisma.user.update({ where: { id: user.id }, data: identity });
  return identity;
}

async function getOrCreateCustomer(s: any, user: any): Promise<string> {
  const sub = await prisma.subscription.findUnique({ where: { userId: user.id } });
  const { email, name } = await billingIdentity(user);

  if (sub?.stripeCustomerId) {
    // Customers created before the email was resolved still carry the placeholder,
    // and Stripe never revisits it on its own. Checkout is rare enough that one
    // extra call is cheaper than an undeliverable receipt.
    try {
      await s.customers.update(sub.stripeCustomerId, { email, name });
    } catch (e: any) {
      // A stale customer id must not block a student from paying.
      console.error("[billing] could not refresh customer email:", e?.message);
    }
    return sub.stripeCustomerId;
  }

  const customer = await s.customers.create({
    email,
    name,
    metadata: { clerkId: user.clerkId },
  });
  return customer.id;
}

router.post("/checkout", async (req, res) => {
  const user = (req as any).user;
  const { plan } = req.body as { plan: "student" | "semester" | "annual" };

  // $9.99 / month · $34.99 every 4 months · $69.99 / year — created in Stripe.
  const priceIds: Record<string, string> = {
    student: process.env.STRIPE_STUDENT_PRICE_ID ?? "",
    semester: process.env.STRIPE_SEMESTER_PRICE_ID ?? "",
    annual: process.env.STRIPE_ANNUAL_PRICE_ID ?? "",
  };

  const priceId = priceIds[plan];
  if (!priceId) return res.status(400).json({ error: "Invalid plan" });

  const s = stripe();
  const customerId = await getOrCreateCustomer(s, user);

  const session = await s.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    // payment_method_types is deliberately absent: Managed Payments is enabled on
    // the account and chooses the methods itself. Passing it is rejected outright,
    // and letting Stripe decide also surfaces wallets and local methods we would
    // otherwise have to enumerate by hand.
    line_items: [{ price: priceId, quantity: 1 }],
    // No trial: the card is charged today. The free tier is the trial — one full
    // lecture, no card — so a trial on top of it would be a second free period and
    // would also hand out a paid plan before any money arrived.
    metadata: { userId: user.id, plan },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?success=1`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
  });

  res.json({ data: { url: session.url } });
});

router.post("/portal", async (req, res) => {
  const user = (req as any).user;
  const sub = await prisma.subscription.findUnique({ where: { userId: user.id } });
  if (!sub?.stripeCustomerId) return res.status(400).json({ error: "No subscription found" });

  const s = stripe();
  const session = await s.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing`,
  });

  res.json({ data: { url: session.url } });
});

router.get("/status", async (req, res) => {
  const user = (req as any).user;
  const sub = await prisma.subscription.findUnique({ where: { userId: user.id } });

  if (!sub || sub.status === "canceled") {
    return res.json({ data: { plan: "free" } });
  }

  const active = sub.status === "active" || sub.status === "trialing";
  return res.json({ data: { plan: active ? sub.plan : "free", status: sub.status } });
});

export { router as billingRouter };
