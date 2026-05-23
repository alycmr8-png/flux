import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

// Search users by email (to add connections)
router.get("/users/search", async (req, res) => {
  const me = (req as any).user;
  const q = (req.query.q as string)?.trim().toLowerCase();
  if (!q || q.length < 3) return res.json({ data: [] });

  const users = await prisma.user.findMany({
    where: {
      id: { not: me.id },
      OR: [
        { email: { contains: q, mode: "insensitive" } },
        { name:  { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, email: true },
    take: 8,
  });
  res.json({ data: users });
});

// GET my connections (accepted)
router.get("/connections", async (req, res) => {
  const me = (req as any).user;
  const [sent, received] = await Promise.all([
    prisma.connection.findMany({
      where: { fromUserId: me.id },
      include: { toUser: { select: { id: true, name: true, email: true } } },
    }),
    prisma.connection.findMany({
      where: { toUserId: me.id },
      include: { fromUser: { select: { id: true, name: true, email: true } } },
    }),
  ]);

  const connections = [
    ...sent.map(c => ({ id: c.id, status: c.status, user: c.toUser,   direction: "sent",     createdAt: c.createdAt })),
    ...received.map(c => ({ id: c.id, status: c.status, user: c.fromUser, direction: "received", createdAt: c.createdAt })),
  ];
  res.json({ data: connections });
});

// POST send connection request
router.post("/connections", async (req, res) => {
  const me = (req as any).user;
  const { toUserId } = req.body as { toUserId: string };
  if (!toUserId) return res.status(400).json({ error: "toUserId required" });
  if (toUserId === me.id) return res.status(400).json({ error: "Cannot connect with yourself" });

  const existing = await prisma.connection.findFirst({
    where: {
      OR: [
        { fromUserId: me.id, toUserId },
        { fromUserId: toUserId, toUserId: me.id },
      ],
    },
  });
  if (existing) return res.status(409).json({ error: "Connection already exists" });

  const conn = await prisma.connection.create({
    data: { fromUserId: me.id, toUserId, status: "pending" },
    include: { toUser: { select: { id: true, name: true, email: true } } },
  });
  res.json({ data: conn });
});

// PATCH accept or reject a connection request
router.patch("/connections/:id", async (req, res) => {
  const me = (req as any).user;
  const { status } = req.body as { status: "accepted" | "rejected" };
  const conn = await prisma.connection.findFirst({
    where: { id: req.params.id, toUserId: me.id, status: "pending" },
  });
  if (!conn) return res.status(404).json({ error: "Request not found" });
  const updated = await prisma.connection.update({
    where: { id: req.params.id },
    data: { status },
    include: { fromUser: { select: { id: true, name: true, email: true } } },
  });
  res.json({ data: updated });
});

// DELETE remove a connection
router.delete("/connections/:id", async (req, res) => {
  const me = (req as any).user;
  const conn = await prisma.connection.findFirst({
    where: { id: req.params.id, OR: [{ fromUserId: me.id }, { toUserId: me.id }] },
  });
  if (!conn) return res.status(404).json({ error: "Not found" });
  await prisma.connection.delete({ where: { id: req.params.id } });
  res.json({ data: { ok: true } });
});

// GET messages with a specific user
router.get("/messages/:userId", async (req, res) => {
  const me = (req as any).user;
  const otherId = req.params.userId;

  const messages = await prisma.message.findMany({
    where: {
      OR: [
        { fromUserId: me.id, toUserId: otherId },
        { fromUserId: otherId, toUserId: me.id },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  // Mark received messages as read
  await prisma.message.updateMany({
    where: { fromUserId: otherId, toUserId: me.id, read: false },
    data: { read: true },
  });

  res.json({ data: messages });
});

// POST send a message
router.post("/messages", async (req, res) => {
  const me = (req as any).user;
  const { toUserId, text } = req.body as { toUserId: string; text: string };
  if (!toUserId || !text?.trim()) return res.status(400).json({ error: "toUserId and text required" });

  // Verify they are connected
  const conn = await prisma.connection.findFirst({
    where: {
      status: "accepted",
      OR: [
        { fromUserId: me.id, toUserId },
        { fromUserId: toUserId, toUserId: me.id },
      ],
    },
  });
  if (!conn) return res.status(403).json({ error: "Not connected with this user" });

  const msg = await prisma.message.create({
    data: { fromUserId: me.id, toUserId, text: text.trim() },
  });
  res.json({ data: msg });
});

// GET unread message count (for badge)
router.get("/messages/unread/count", async (req, res) => {
  const me = (req as any).user;
  const count = await prisma.message.count({ where: { toUserId: me.id, read: false } });
  res.json({ data: count });
});

// POST share an item with a connection
router.post("/share", async (req, res) => {
  const me = (req as any).user;
  const { toUserId, itemType, itemId, title, note } = req.body as {
    toUserId: string; itemType: string; itemId: string; title: string; note?: string;
  };
  if (!toUserId || !itemType || !itemId || !title) return res.status(400).json({ error: "Missing fields" });

  const conn = await prisma.connection.findFirst({
    where: {
      status: "accepted",
      OR: [
        { fromUserId: me.id, toUserId },
        { fromUserId: toUserId, toUserId: me.id },
      ],
    },
  });
  if (!conn) return res.status(403).json({ error: "Not connected with this user" });

  const item = await prisma.sharedItem.create({
    data: { fromUserId: me.id, toUserId, itemType, itemId, title, note: note?.trim() || null },
    include: { fromUser: { select: { id: true, name: true } } },
  });
  res.json({ data: item });
});

// GET items shared with me
router.get("/shared", async (req, res) => {
  const me = (req as any).user;
  const items = await prisma.sharedItem.findMany({
    where: { toUserId: me.id },
    include: { fromUser: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json({ data: items });
});

export { router as networkRouter };
