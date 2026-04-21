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

  if (event.type === "user.created") {
    const { id, email_addresses, first_name, last_name } = event.data;
    await prisma.user.create({
      data: {
        clerkId: id,
        email: email_addresses[0].email_address,
        name: `${first_name ?? ""} ${last_name ?? ""}`.trim(),
      },
    });
  }

  res.json({ received: true });
});
