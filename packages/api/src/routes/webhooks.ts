import { Router } from "express";
import { Webhook } from "svix";
import { prisma } from "../lib/prisma";

export const webhookRouter = Router();

webhookRouter.post("/", async (req, res) => {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) return res.status(500).json({ error: "Webhook secret not configured" });

  const wh = new Webhook(secret);
  let event: any;

  try {
    event = wh.verify(req.body, {
      "svix-id": req.headers["svix-id"] as string,
      "svix-timestamp": req.headers["svix-timestamp"] as string,
      "svix-signature": req.headers["svix-signature"] as string,
    });
  } catch {
    return res.status(400).json({ error: "Invalid signature" });
  }

  if (event.type === "user.created" || event.type === "user.updated") {
    const { id, email_addresses, primary_email_address_id, first_name, last_name } = event.data;
    // Upsert, not create. requireAuth creates the row the moment a new student
    // makes their first API call, which usually beats this webhook — and a bare
    // create then threw a unique-constraint error, so the real email was never
    // written and every account kept its @clerk.local placeholder.
    const primary =
      email_addresses?.find((e: any) => e.id === primary_email_address_id) ??
      email_addresses?.[0];
    const email = primary?.email_address;
    if (!email) {
      console.error(`[clerk-webhook] ${event.type} for ${id} carried no email address`);
      return res.json({ received: true });
    }
    const name = `${first_name ?? ""} ${last_name ?? ""}`.trim() || "Student";
    await prisma.user.upsert({
      where: { clerkId: id },
      create: { clerkId: id, email, name },
      update: { email, name },
    });
  }

  res.json({ received: true });
});
