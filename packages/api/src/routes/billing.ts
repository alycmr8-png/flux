import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

// eslint-disable-next-line @typescript-eslint/no-require-imports
function stripe() {
  const Stripe = require("stripe");
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

async function getOrCreateCustomer(s: any, user: any): Promise<string> {
  const sub = await prisma.subscription.findUnique({ where: { userId: user.id } });
  if (sub?.stripeCustomerId) return sub.stripeCustomerId;
  const customer = await s.customers.create({
    email: user.email,
    name: user.name,
    metadata: { clerkId: user.clerkId },
  });
  return customer.id;
}

router.post("/checkout", async (req, res) => {
  const user = (req as any).user;
  const { plan } = req.body as { plan: "student" | "pro" };

  const priceIds: Record<string, string> = {
    student: process.env.STRIPE_STUDENT_PRICE_ID ?? "",
    pro: process.env.STRIPE_PRO_PRICE_ID ?? "",
  };

  const priceId = priceIds[plan];
  if (!priceId) return res.status(400).json({ error: "Invalid plan" });

  const s = stripe();
  const customerId = await getOrCreateCustomer(s, user);

  const session = await s.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: { trial_period_days: 7 },
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
