import type { RequestHandler } from "express";
import { z } from "zod";
import prisma from "../prisma.ts";

const searchSchema = z.object({
  q: z.string().min(1).max(200),
  type: z.enum(["all", "clubs", "events", "announcements"]).optional().default("all"),
});

// UC-9.1 — Global search across clubs, events, and announcements
export const globalSearch: RequestHandler = async (req, res) => {
  const parseResult = searchSchema.safeParse(req.query);
  if (!parseResult.success) {
    return res.status(400).json({ errors: parseResult.error.format() });
  }

  const { q, type } = parseResult.data;
  const term = `%${q}%`;

  const [clubs, events, announcements] = await Promise.all([
    type === "all" || type === "clubs"
      ? prisma.club.findMany({
          where: {
            status: "ACTIVE",
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
              { category: { contains: q, mode: "insensitive" } },
              { tags: { hasSome: [q] } },
            ],
          },
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            category: true,
            logoUrl: true,
            tags: true,
            _count: { select: { memberships: { where: { status: "APPROVED" } } } },
          },
          take: 10,
        })
      : [],

    type === "all" || type === "events"
      ? prisma.event.findMany({
          where: {
            status: "APPROVED",
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
              { location: { contains: q, mode: "insensitive" } },
              { category: { contains: q, mode: "insensitive" } },
            ],
          },
          select: {
            id: true,
            title: true,
            description: true,
            location: true,
            category: true,
            startsAt: true,
            endsAt: true,
            posterUrl: true,
            capacity: true,
            club: { select: { id: true, name: true, slug: true } },
            _count: {
              select: { attendees: { where: { status: "REGISTERED", isWaitlisted: false } } },
            },
          },
          orderBy: { startsAt: "asc" },
          take: 10,
        })
      : [],

    type === "all" || type === "announcements"
      ? prisma.announcement.findMany({
          where: {
            publishedAt: { lte: new Date() },
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { content: { contains: q, mode: "insensitive" } },
            ],
          },
          select: {
            id: true,
            title: true,
            content: true,
            priority: true,
            publishedAt: true,
            club: { select: { id: true, name: true, slug: true } },
            createdBy: { select: { id: true, name: true } },
          },
          orderBy: { publishedAt: "desc" },
          take: 10,
        })
      : [],
  ]);

  const formattedClubs = (clubs as any[]).map((c) => ({
    ...c,
    memberCount: c._count.memberships,
    _count: undefined,
  }));

  const formattedEvents = (events as any[]).map((e) => ({
    ...e,
    registeredCount: e._count.attendees,
    _count: undefined,
  }));

  return res.json({
    query: q,
    type,
    results: {
      clubs: formattedClubs,
      events: formattedEvents,
      announcements,
    },
    total: formattedClubs.length + formattedEvents.length + (announcements as any[]).length,
  });
};

// UC-9.3 / U7.2 — Smart recommended events with multi-signal scoring
export const getRecommendations: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const [user, memberships] = await Promise.all([
    prisma.user.findUnique({
      where: { id: req.user.id },
      select: { interests: true },
    }),
    prisma.clubMembership.findMany({
      where: { userId: req.user.id, status: "APPROVED" },
      select: { clubId: true },
    }),
  ]);

  const interests = user?.interests ?? [];
  const userClubIds = new Set(memberships.map((m) => m.clubId));
  const now = new Date();

  const candidates = await prisma.event.findMany({
    where: { status: "APPROVED", startsAt: { gte: now } },
    select: {
      id: true,
      title: true,
      description: true,
      location: true,
      category: true,
      tags: true,
      startsAt: true,
      endsAt: true,
      posterUrl: true,
      capacity: true,
      clubId: true,
      club: { select: { id: true, name: true, slug: true } },
      _count: {
        select: { attendees: { where: { status: "REGISTERED", isWaitlisted: false } } },
      },
    },
    orderBy: { startsAt: "asc" },
    take: 50,
  });

  const scored = candidates.map((event) => {
    let score = 0;
    const lowerInterests = interests.map((i) => i.toLowerCase());
    if (lowerInterests.some((i) => event.category.toLowerCase().includes(i))) score += 3;
    if (userClubIds.has(event.clubId)) score += 2;
    if (event.tags.some((t) => lowerInterests.includes(t.toLowerCase()))) score += 1;
    const daysAway = (new Date(event.startsAt).getTime() - now.getTime()) / 86_400_000;
    if (daysAway >= 1 && daysAway <= 7) score += 1;
    return { event, score };
  });

  scored.sort((a, b) => b.score - a.score || new Date(a.event.startsAt).getTime() - new Date(b.event.startsAt).getTime());

  const top = scored.slice(0, 8);
  const isPersonalized = interests.length > 0 && top.some((s) => s.score > 0);

  const formatted = top.map(({ event }) => ({
    ...event,
    registeredCount: event._count.attendees,
    _count: undefined,
    clubId: undefined,
    tags: undefined,
  }));

  return res.json({ interests, events: formatted, isPersonalized });
};
