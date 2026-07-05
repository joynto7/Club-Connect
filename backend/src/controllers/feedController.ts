import type { RequestHandler } from "express";
import { EventStatus, MembershipStatus } from "@prisma/client";
import prisma from "../prisma.ts";

export type FeedItem = {
  type: "NEW_EVENT" | "ANNOUNCEMENT" | "REMINDER" | "NEW_MEMBER";
  id: string;
  title: string;
  subtitle: string;
  link: string;
  createdAt: string;
  image: string | null;
};

// GET /feed — auth
export const getFeed: RequestHandler = async (req, res) => {
  const userId = req.user!.id;
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
  const threeDaysLater = new Date(now.getTime() + 3 * 86400000);

  // Get clubs user is a member of or follows
  const [memberships, follows] = await Promise.all([
    prisma.clubMembership.findMany({
      where: { userId, status: MembershipStatus.APPROVED },
      select: { clubId: true },
    }),
    prisma.clubFollow.findMany({
      where: { userId },
      select: { clubId: true },
    }),
  ]);

  const clubIds = [...new Set([
    ...memberships.map((m) => m.clubId),
    ...follows.map((f) => f.clubId),
  ])];

  const feedItems: FeedItem[] = [];

  // 1 — New events from clubs user is member/follower of (last 30 days, APPROVED)
  if (clubIds.length > 0) {
    const newEvents = await prisma.event.findMany({
      where: {
        clubId: { in: clubIds },
        status: EventStatus.APPROVED,
        createdAt: { gte: thirtyDaysAgo },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        title: true,
        category: true,
        startsAt: true,
        location: true,
        posterUrl: true,
        createdAt: true,
        club: { select: { name: true, slug: true } },
      },
    });

    feedItems.push(
      ...newEvents.map((e) => ({
        type: "NEW_EVENT" as const,
        id: e.id,
        title: e.title,
        subtitle: `${e.club.name} · ${e.location}`,
        link: `/events/${e.id}`,
        createdAt: e.createdAt.toISOString(),
        image: e.posterUrl ?? null,
      }))
    );
  }

  // 2 — New announcements for user's clubs
  if (clubIds.length > 0) {
    const announcements = await prisma.announcement.findMany({
      where: {
        OR: [
          { clubId: null }, // global
          { clubId: { in: clubIds } },
        ],
        publishedAt: { lte: now, gte: thirtyDaysAgo },
      },
      orderBy: { publishedAt: "desc" },
      take: 10,
      select: {
        id: true,
        title: true,
        content: true,
        publishedAt: true,
        club: { select: { name: true } },
      },
    });

    feedItems.push(
      ...announcements.map((a) => ({
        type: "ANNOUNCEMENT" as const,
        id: a.id,
        title: a.title,
        subtitle: a.club ? `From ${a.club.name}` : "University-wide",
        link: "/announcements",
        createdAt: a.publishedAt.toISOString(),
        image: null,
      }))
    );
  }

  // 3 — Upcoming events user is registered for (next 3 days)
  const registrations = await prisma.eventAttendance.findMany({
    where: {
      userId,
      status: "REGISTERED",
      isWaitlisted: false,
      event: {
        status: EventStatus.APPROVED,
        startsAt: { gte: now, lte: threeDaysLater },
      },
    },
    take: 5,
    select: {
      event: {
        select: {
          id: true,
          title: true,
          startsAt: true,
          location: true,
          club: { select: { name: true } },
        },
      },
      createdAt: true,
    },
  });

  feedItems.push(
    ...registrations.map((r) => ({
      type: "REMINDER" as const,
      id: r.event.id,
      title: r.event.title,
      subtitle: `Starts soon · ${r.event.location}`,
      link: `/events/${r.event.id}`,
      createdAt: r.createdAt.toISOString(),
      image: null,
    }))
  );

  // 4 — New members who joined user's clubs (last 7 days)
  if (memberships.length > 0) {
    const memberClubIds = memberships.map((m) => m.clubId);
    const newMembers = await prisma.clubMembership.findMany({
      where: {
        clubId: { in: memberClubIds },
        status: MembershipStatus.APPROVED,
        userId: { not: userId },
        updatedAt: { gte: sevenDaysAgo },
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: {
        updatedAt: true,
        user: { select: { id: true, name: true, avatarUrl: true } },
        club: { select: { id: true, name: true, slug: true } },
      },
    });

    feedItems.push(
      ...newMembers.map((nm) => ({
        type: "NEW_MEMBER" as const,
        id: `${nm.user.id}-${nm.club.id}`,
        title: `${nm.user.name} joined ${nm.club.name}`,
        subtitle: nm.club.name,
        link: `/clubs/${nm.club.slug}`,
        createdAt: nm.updatedAt.toISOString(),
        image: null,
      }))
    );
  }

  // Sort all items by createdAt descending
  feedItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json(feedItems.slice(0, 50));
};
