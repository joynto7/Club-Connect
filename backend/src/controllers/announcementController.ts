import type { RequestHandler } from "express";
import { z } from "zod";
import { Role, MembershipStatus } from "@prisma/client";
import prisma from "../prisma.ts";
import { createBulkNotifications } from "../services/notificationService.ts";
import { fireWebhooks } from "../services/webhookService.ts";

const createSchema = z.object({
  title:       z.string().min(3, "Title must be at least 3 characters"),
  content:     z.string().min(10, "Content must be at least 10 characters"),
  priority:    z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  clubId:      z.string().uuid().optional(),
  scheduledAt: z.string().optional().refine((v) => !v || !isNaN(Date.parse(v)), "Invalid date"),
});

const updateSchema = z.object({
  title:    z.string().min(3).optional(),
  content:  z.string().min(10).optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
});

// GET /announcements — list announcements visible to the user
export const listAnnouncements: RequestHandler = async (req, res) => {
  const userId = req.user?.id;

  // Always include global announcements
  const clubIdFilter: string[] = [];

  if (userId) {
    const memberships = await prisma.clubMembership.findMany({
      where: { userId, status: MembershipStatus.APPROVED },
      select: { clubId: true },
    });
    clubIdFilter.push(...memberships.map((m) => m.clubId));
  }

  const now = new Date();

  const announcements = await prisma.announcement.findMany({
    where: {
      OR: [
        { clubId: null },
        ...(clubIdFilter.length > 0 ? [{ clubId: { in: clubIdFilter } }] : []),
      ],
      publishedAt: { lte: now },
    },
    include: {
      createdBy: { select: { id: true, name: true, avatarUrl: true } },
      club: { select: { id: true, name: true, slug: true } },
    },
    orderBy: [{ priority: "desc" }, { publishedAt: "desc" }],
    take: 30,
  });

  return res.json({ announcements });
};

// POST /announcements — create announcement
export const createAnnouncement: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.format() });

  const { title, content, priority, clubId, scheduledAt } = parsed.data;
  const isAdmin = req.user.role === Role.UNIVERSITY_ADMIN || req.user.role === Role.SYSTEM_ADMIN;

  // Club-specific announcement — must be club officer
  if (clubId) {
    const m = await prisma.clubMembership.findUnique({
      where: { clubId_userId: { clubId, userId: req.user.id } },
    });
    const isOfficer =
      isAdmin ||
      (m?.status === MembershipStatus.APPROVED &&
        (m.role === "PRESIDENT" || m.role === "COORDINATOR"));
    if (!isOfficer) {
      return res.status(403).json({ error: "Only club officers can post club announcements" });
    }
  } else {
    // Global announcement — admin only
    if (!isAdmin) {
      return res.status(403).json({ error: "Only admins can post global announcements" });
    }
  }

  const publishedAt = scheduledAt ? new Date(scheduledAt) : new Date();

  const announcement = await prisma.announcement.create({
    data: {
      title,
      content,
      priority: priority ?? "NORMAL",
      clubId:      clubId      ?? null,
      createdById: req.user.id,
      publishedAt,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
    },
    include: {
      createdBy: { select: { id: true, name: true } },
      club: { select: { id: true, name: true, slug: true } },
    },
  });

  // Fire notifications asynchronously
  void (async () => {
    try {
      let userIds: string[] = [];

      if (clubId) {
        const members = await prisma.clubMembership.findMany({
          where: { clubId, status: MembershipStatus.APPROVED, userId: { not: req.user!.id } },
          select: { userId: true },
        });
        userIds = members.map((m) => m.userId);
      } else {
        const users = await prisma.user.findMany({
          where: { id: { not: req.user!.id } },
          select: { id: true },
        });
        userIds = users.map((u) => u.id);
      }

      const clubLabel = announcement.club ? ` [${announcement.club.name}]` : "";
      await createBulkNotifications(
        userIds,
        "ANNOUNCEMENT",
        `New Announcement${clubLabel}: ${title}`,
        content.length > 120 ? content.slice(0, 120) + "…" : content,
        "/announcements"
      );
    } catch {
      // fire-and-forget
    }
  })();

  // U12.3 — Fire Slack/Discord webhook for club announcement
  if (clubId && announcement.club) {
    void fireWebhooks(clubId, "ANNOUNCEMENT", {
      message: `📢 ${title}`,
      link: `${process.env.FRONTEND_URL ?? "http://127.0.0.1:3000"}/announcements`,
    }, announcement.club.name);
  }

  return res.status(201).json({ announcement, message: "Announcement published" });
};

// PUT /announcements/:id — edit announcement
export const updateAnnouncement: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  const id = req.params["id"] as string;

  const ann = await prisma.announcement.findUnique({ where: { id } });
  if (!ann) return res.status(404).json({ error: "Announcement not found" });

  const isAdmin = req.user.role === Role.UNIVERSITY_ADMIN || req.user.role === Role.SYSTEM_ADMIN;
  if (ann.createdById !== req.user.id && !isAdmin) {
    return res.status(403).json({ error: "You cannot edit this announcement" });
  }

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.format() });

  const updated = await prisma.announcement.update({
    where: { id },
    data: {
      ...(parsed.data.title   !== undefined ? { title:   parsed.data.title   } : {}),
      ...(parsed.data.content !== undefined ? { content: parsed.data.content } : {}),
      ...(parsed.data.priority!== undefined ? { priority:parsed.data.priority} : {}),
    },
    include: {
      createdBy: { select: { id: true, name: true } },
      club: { select: { id: true, name: true, slug: true } },
    },
  });

  return res.json({ announcement: updated, message: "Announcement updated" });
};

// DELETE /announcements/:id — delete announcement
export const deleteAnnouncement: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  const id = req.params["id"] as string;

  const ann = await prisma.announcement.findUnique({ where: { id } });
  if (!ann) return res.status(404).json({ error: "Announcement not found" });

  const isAdmin = req.user.role === Role.UNIVERSITY_ADMIN || req.user.role === Role.SYSTEM_ADMIN;
  if (ann.createdById !== req.user.id && !isAdmin) {
    return res.status(403).json({ error: "You cannot delete this announcement" });
  }

  await prisma.announcement.delete({ where: { id } });
  return res.json({ message: "Announcement deleted" });
};
