import type { RequestHandler } from "express";
import prisma from "../prisma.ts";

// GET /notifications — list user's notifications (newest first, limit 50)
export const listNotifications: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const notifications = await prisma.notification.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const unreadCount = await prisma.notification.count({
    where: { userId: req.user.id, read: false },
  });

  return res.json({ notifications, unreadCount });
};

// PUT /notifications/:id/read — mark single notification as read
export const markRead: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  const id = req.params["id"] as string;

  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification || notification.userId !== req.user.id) {
    return res.status(404).json({ error: "Notification not found" });
  }

  await prisma.notification.update({ where: { id }, data: { read: true } });
  return res.json({ message: "Marked as read" });
};

// PUT /notifications/read-all — mark all as read
export const markAllRead: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  await prisma.notification.updateMany({
    where: { userId: req.user.id, read: false },
    data: { read: true },
  });

  return res.json({ message: "All notifications marked as read" });
};

// DELETE /notifications/:id — delete a single notification
export const deleteNotification: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  const id = req.params["id"] as string;

  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification || notification.userId !== req.user.id) {
    return res.status(404).json({ error: "Notification not found" });
  }

  await prisma.notification.delete({ where: { id } });
  return res.json({ message: "Notification deleted" });
};
