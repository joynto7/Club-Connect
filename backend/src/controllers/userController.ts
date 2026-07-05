import type { RequestHandler } from "express";
import { z } from "zod";
import { MembershipStatus, ClubRole } from "@prisma/client";
import prisma from "../prisma.ts";

const updateProfileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").optional(),
  department: z.string().optional(),
  year: z.string().optional(),
  interests: z.array(z.string()).optional(),
  avatarUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
});

// UC-1.4 — View own profile (full data from DB)
export const getMyProfile: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      year: true,
      interests: true,
      avatarUrl: true,
      emailVerified: true,
      isSuspended: true,
      createdAt: true,
    },
  });

  if (!user) return res.status(404).json({ error: "User not found" });

  return res.json({ user });
};

// UC-1.5 — Edit own profile
export const updateMyProfile: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const parseResult = updateProfileSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ errors: parseResult.error.format() });
  }

  const { name, department, year, interests, avatarUrl } = parseResult.data;

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: {
      ...(name !== undefined && { name }),
      ...(department !== undefined && { department }),
      ...(year !== undefined && { year }),
      ...(interests !== undefined && { interests }),
      ...(avatarUrl !== undefined && { avatarUrl: avatarUrl === "" ? null : avatarUrl }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      year: true,
      interests: true,
      avatarUrl: true,
      emailVerified: true,
      createdAt: true,
    },
  });

  return res.json({ user, message: "Profile updated successfully" });
};

// UC-1.6 — View participation history
export const getMyHistory: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const now = new Date();

  const attendances = await prisma.eventAttendance.findMany({
    where: { userId: req.user.id },
    include: {
      event: {
        include: {
          club: { select: { id: true, name: true, slug: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const clubsCreated = await prisma.club.findMany({
    where: { createdById: req.user.id },
    select: { id: true, name: true, slug: true, createdAt: true },
  });

  const upcomingEvents = attendances
    .filter((a) => a.event.startsAt >= now && a.status === "REGISTERED")
    .map((a) => ({
      registrationId: a.id,
      status: a.status,
      registeredAt: a.createdAt,
      event: {
        id: a.event.id,
        title: a.event.title,
        location: a.event.location,
        startsAt: a.event.startsAt,
        endsAt: a.event.endsAt,
        club: a.event.club,
      },
    }));

  const pastEvents = attendances
    .filter((a) => a.event.startsAt < now)
    .map((a) => ({
      registrationId: a.id,
      status: a.status,
      registeredAt: a.createdAt,
      event: {
        id: a.event.id,
        title: a.event.title,
        location: a.event.location,
        startsAt: a.event.startsAt,
        endsAt: a.event.endsAt,
        club: a.event.club,
      },
    }));

  return res.json({ clubsCreated, upcomingEvents, pastEvents });
};

// UC-5.5 — Get notification preferences
export const getNotificationPreferences: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const prefs = await prisma.notificationPreference.upsert({
    where: { userId: req.user.id },
    create: { userId: req.user.id },
    update: {},
  });

  return res.json({ preferences: prefs });
};

const prefsSchema = z.object({
  eventUpdates:   z.boolean().optional(),
  clubUpdates:    z.boolean().optional(),
  bookingUpdates: z.boolean().optional(),
  announcements:  z.boolean().optional(),
});

// UC-5.5 — Update notification preferences
export const updateNotificationPreferences: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const parsed = prefsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.format() });

  // Build update data filtering out undefined values (exactOptionalPropertyTypes)
  const updateData: Record<string, boolean> = {};
  if (parsed.data.eventUpdates   !== undefined) updateData["eventUpdates"]   = parsed.data.eventUpdates;
  if (parsed.data.clubUpdates    !== undefined) updateData["clubUpdates"]    = parsed.data.clubUpdates;
  if (parsed.data.bookingUpdates !== undefined) updateData["bookingUpdates"] = parsed.data.bookingUpdates;
  if (parsed.data.announcements  !== undefined) updateData["announcements"]  = parsed.data.announcements;

  const prefs = await prisma.notificationPreference.upsert({
    where: { userId: req.user.id },
    create: { userId: req.user.id, ...updateData },
    update: updateData,
  });

  return res.json({ preferences: prefs, message: "Preferences saved" });
};

// UC-4 — Clubs the current user is a member of (with officer metadata)
export const getMyClubs: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const memberships = await prisma.clubMembership.findMany({
    where: { userId: req.user.id, status: MembershipStatus.APPROVED },
    include: {
      club: {
        select: {
          id: true,
          name: true,
          slug: true,
          category: true,
          logoUrl: true,
          status: true,
          _count: {
            select: { memberships: { where: { status: MembershipStatus.APPROVED } } },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const clubs = await Promise.all(
    memberships.map(async (m) => {
      const isOfficer = m.role === ClubRole.PRESIDENT || m.role === ClubRole.COORDINATOR;
      const pendingCount = isOfficer
        ? await prisma.clubMembership.count({
            where: { clubId: m.club.id, status: MembershipStatus.PENDING },
          })
        : 0;
      return {
        id: m.club.id,
        name: m.club.name,
        slug: m.club.slug,
        category: m.club.category,
        logoUrl: m.club.logoUrl ?? null,
        status: m.club.status,
        role: m.role,
        memberCount: m.club._count.memberships,
        pendingCount,
      };
    })
  );

  return res.json({ clubs });
};

// U5 — My points + level + transaction history
export const getMyPoints: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const up = await prisma.userPoints.findUnique({
    where: { userId: req.user.id },
    include: {
      transactions: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  return res.json({
    points:       up?.points       ?? 0,
    level:        up?.level        ?? 1,
    transactions: up?.transactions ?? [],
  });
};

// U5 — My unlocked achievements
export const getMyAchievements: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const all = await prisma.achievement.findMany({ orderBy: { slug: "asc" } });
  const owned = await prisma.userAchievement.findMany({
    where: { userId: req.user.id },
    select: { achievementSlug: true, unlockedAt: true },
  });
  const ownedMap = Object.fromEntries(owned.map((u) => [u.achievementSlug, u.unlockedAt]));

  const achievements = all.map((a) => ({
    ...a,
    unlocked:   ownedMap[a.slug] !== undefined,
    unlockedAt: ownedMap[a.slug] ?? null,
  }));

  return res.json({ achievements });
};

// U4 — Public user directory
export const listUsers: RequestHandler = async (req, res) => {
  const search     = req.query["search"]     as string | undefined;
  const department = req.query["department"] as string | undefined;
  const year       = req.query["year"]       as string | undefined;

  const users = await prisma.user.findMany({
    where: {
      isSuspended: false,
      ...(search ? {
        OR: [
          { name:  { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      } : {}),
      ...(department ? { department: { equals: department, mode: "insensitive" } } : {}),
      ...(year       ? { year:       { equals: year,       mode: "insensitive" } } : {}),
    },
    select: {
      id: true,
      name: true,
      department: true,
      year: true,
      interests: true,
      avatarUrl: true,
      memberships: {
        where: { status: MembershipStatus.APPROVED },
        select: {
          role: true,
          club: { select: { id: true, name: true, slug: true } },
        },
        take: 3,
      },
    },
    orderBy: { name: "asc" },
    take: 100,
  });

  return res.json({ users });
};

// U4 — Public profile view for any user
export const getUserProfile: RequestHandler = async (req, res) => {
  const userId = req.params["userId"] as string;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      department: true,
      year: true,
      interests: true,
      avatarUrl: true,
      createdAt: true,
      memberships: {
        where: { status: MembershipStatus.APPROVED },
        select: {
          role: true,
          club: { select: { id: true, name: true, slug: true, logoUrl: true } },
        },
      },
      _count: {
        select: {
          attendances: { where: { checkedIn: true } },
          feedbacks: true,
        },
      },
    },
  });

  if (!user) return res.status(404).json({ error: "User not found" });
  return res.json({ user });
};

// U9 — Push subscription management
const pushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
  userAgent: z.string().optional(),
});

export const subscribePush: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const parse = pushSubscriptionSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: "Invalid subscription data" });

  const { endpoint, keys, userAgent } = parse.data;

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: {
      userId: req.user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: userAgent ?? null,
    },
    update: {
      userId: req.user.id,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: userAgent ?? null,
    },
  });

  return res.json({ success: true });
};

export const unsubscribePush: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const { endpoint } = req.body as { endpoint?: string };
  if (!endpoint) return res.status(400).json({ error: "endpoint is required" });

  await prisma.pushSubscription.deleteMany({
    where: { endpoint, userId: req.user.id },
  });

  return res.json({ success: true });
};
