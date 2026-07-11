import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

// eslint-disable-next-line @typescript-eslint/no-require-imports
function stripe() {
  const Stripe = require("stripe");
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

function planFromPriceId(priceId: string): string {
  if (priceId === process.env.STRIPE_MONTHLY_PRICE_ID) return "monthly";
  if (priceId === process.env.STRIPE_6MONTH_PRICE_ID) return "6month";
  if (priceId === process.env.STRIPE_YEARLY_PRICE_ID) return "yearly";
  return "monthly";
}

router.post("/", async (req, res) => {
  const sig = req.headers["stripe-signature"] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: any;

  if (webhookSecret && sig) {
    try {
      const s = stripe();
      event = s.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
      console.error("[stripe-webhook] signature verification failed:", err.message);
      return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }
  } else {
    try {
      event = JSON.parse(req.body.toString());
    } catch {
      return res.status(400).json({ error: "Invalid payload" });
    }
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.mode !== "subscription") break;

        const userId = session.metadata?.userId;
        const plan = session.metadata?.plan ?? "monthly";
        if (!userId) break;

        const s = stripe();
        const subscription = await s.subscriptions.retrieve(session.subscription);

        await prisma.subscription.upsert({
          where: { userId },
          create: {
            userId,
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
            plan,
            status: subscription.status,
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          },
          update: {
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
            plan,
            status: subscription.status,
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          },
        });
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const priceId = subscription.items.data[0]?.price?.id ?? "";
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: subscription.id },
          data: {
            plan: planFromPriceId(priceId),
            status: subscription.status,
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          },
        });
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: subscription.id },
          data: { status: "canceled" },
        });
        break;
      }
    }
  } catch (err: any) {
    console.error("[stripe-webhook] error processing event:", err.message);
    return res.status(500).json({ error: "Webhook handler failed" });
  }

  res.json({ received: true });
});

export { router as stripeWebhookRouter };
