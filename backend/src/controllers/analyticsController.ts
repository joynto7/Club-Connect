import type { RequestHandler } from "express";
import { Role, EventStatus, ClubStatus, MembershipStatus, ClubRole } from "@prisma/client";
import prisma from "../prisma.ts";

function getLast6Months() {
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    months.push({
      label: d.toLocaleString("en-US", { month: "short", year: "numeric" }),
      year:  d.getFullYear(),
      month: d.getMonth() + 1,
    });
  }
  return months;
}

function countByMonth(
  records: { createdAt: Date }[],
  months: { label: string; year: number; month: number }[]
) {
  return months.map(({ label, year, month }) => ({
    month: label,
    count: records.filter((r) => {
      const d = new Date(r.createdAt);
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    }).length,
  }));
}

async function resolveClub(slugOrId: string) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId);
  return prisma.club.findFirst({ where: isUuid ? { id: slugOrId } : { slug: slugOrId } });
}

async function isClubOfficer(userId: string, userRole: string, clubId: string): Promise<boolean> {
  if (userRole === Role.UNIVERSITY_ADMIN || userRole === Role.SYSTEM_ADMIN) return true;
  const m = await prisma.clubMembership.findUnique({
    where: { clubId_userId: { clubId, userId } },
  });
  return (
    m?.status === MembershipStatus.APPROVED &&
    (m.role === ClubRole.PRESIDENT || m.role === ClubRole.COORDINATOR)
  );
}

// UC-6.3 — Club analytics (officer/admin)
export const getClubAnalytics: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  const slugOrId = req.params["id"] as string;

  const club = await resolveClub(slugOrId);
  if (!club) return res.status(404).json({ error: "Club not found" });

  const officer = await isClubOfficer(req.user.id, req.user.role, club.id);
  if (!officer) return res.status(403).json({ error: "Only club officers can view analytics" });

  const months = getLast6Months();
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const [
    totalMembers,
    recentMemberships,
    events,
    topEventsRaw,
    feedbackAgg,
    checkins,
  ] = await Promise.all([
    prisma.clubMembership.count({ where: { clubId: club.id, status: MembershipStatus.APPROVED } }),
    prisma.clubMembership.findMany({
      where: { clubId: club.id, status: MembershipStatus.APPROVED, createdAt: { gte: sixMonthsAgo } },
      select: { createdAt: true },
    }),
    prisma.event.findMany({
      where: { clubId: club.id },
      select: {
        id: true, title: true, status: true, startsAt: true,
        _count: { select: { attendees: { where: { status: "REGISTERED", isWaitlisted: false } } } },
      },
    }),
    prisma.event.findMany({
      where: { clubId: club.id, status: EventStatus.APPROVED },
      select: {
        id: true, title: true, startsAt: true,
        _count: { select: { attendees: { where: { status: "REGISTERED", isWaitlisted: false } } } },
      },
      orderBy: { attendees: { _count: "desc" } },
      take: 5,
    }),
    prisma.eventFeedback.aggregate({
      where: { event: { clubId: club.id } },
      _avg: { rating: true },
      _count: { rating: true },
    }),
    prisma.eventAttendance.count({
      where: { event: { clubId: club.id }, status: "REGISTERED", checkedIn: true },
    }),
  ]);

  const memberGrowth = countByMonth(
    recentMemberships.map((m) => ({ createdAt: m.createdAt })),
    months
  );

  const now = new Date();
  const approvedEvents = events.filter((e) => e.status === EventStatus.APPROVED);
  const upcomingEvents = approvedEvents.filter((e) => new Date(e.startsAt) >= now);
  const pastEvents     = approvedEvents.filter((e) => new Date(e.startsAt) <  now);

  const eventsByStatus: Record<string, number> = {};
  events.forEach((e) => {
    eventsByStatus[e.status] = (eventsByStatus[e.status] ?? 0) + 1;
  });

  const totalRegistrations = events.reduce((sum, e) => sum + e._count.attendees, 0);
  const avgAttendanceRate = totalRegistrations > 0
    ? Math.round((checkins / totalRegistrations) * 100)
    : 0;

  return res.json({
    club: { id: club.id, name: club.name, slug: club.slug },
    overview: {
      totalMembers,
      totalEvents: events.length,
      upcomingEvents: upcomingEvents.length,
      pastEvents:     pastEvents.length,
      totalRegistrations,
      totalCheckins: checkins,
      avgAttendanceRate,
    },
    memberGrowth,
    eventsByStatus,
    topEvents: topEventsRaw.map((e) => ({
      id: e.id, title: e.title,
      startsAt: e.startsAt,
      attendees: e._count.attendees,
    })),
    feedbackStats: {
      avgRating:     feedbackAgg._avg.rating ? Math.round(feedbackAgg._avg.rating * 10) / 10 : null,
      totalFeedback: feedbackAgg._count.rating,
    },
  });
};

// UC-6.4 — System-wide admin analytics
export const getAdminAnalytics: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const months = getLast6Months();
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const [
    totalUsers,
    totalClubs,
    totalEvents,
    totalAttendance,
    recentUsers,
    recentEvents,
    eventCategories,
    clubCategories,
    topClubs,
    topEvents,
    feedbackAgg,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.club.count({ where: { status: ClubStatus.ACTIVE } }),
    prisma.event.count({ where: { status: EventStatus.APPROVED } }),
    prisma.eventAttendance.count({ where: { status: "REGISTERED", isWaitlisted: false } }),
    prisma.user.findMany({
      where: { createdAt: { gte: sixMonthsAgo } },
      select: { createdAt: true },
    }),
    prisma.event.findMany({
      where: { status: EventStatus.APPROVED, createdAt: { gte: sixMonthsAgo } },
      select: { createdAt: true },
    }),
    prisma.event.groupBy({
      by: ["category"],
      where: { status: EventStatus.APPROVED },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 8,
    }),
    prisma.club.groupBy({
      by: ["category"],
      where: { status: ClubStatus.ACTIVE },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 8,
    }),
    prisma.club.findMany({
      where: { status: ClubStatus.ACTIVE },
      select: {
        id: true, name: true, slug: true, category: true,
        _count: { select: { memberships: { where: { status: MembershipStatus.APPROVED } } } },
      },
      orderBy: { memberships: { _count: "desc" } },
      take: 5,
    }),
    prisma.event.findMany({
      where: { status: EventStatus.APPROVED },
      select: {
        id: true, title: true, startsAt: true,
        club: { select: { id: true, name: true, slug: true } },
        _count: { select: { attendees: { where: { status: "REGISTERED", isWaitlisted: false } } } },
      },
      orderBy: { attendees: { _count: "desc" } },
      take: 5,
    }),
    prisma.eventFeedback.aggregate({
      _avg: { rating: true },
      _count: { rating: true },
    }),
  ]);

  const userGrowth  = countByMonth(recentUsers.map((u)  => ({ createdAt: u.createdAt })),  months);
  const eventGrowth = countByMonth(recentEvents.map((e) => ({ createdAt: e.createdAt })), months);

  return res.json({
    overview: {
      totalUsers,
      totalClubs,
      totalEvents,
      totalAttendance,
      avgRating:     feedbackAgg._avg.rating ? Math.round(feedbackAgg._avg.rating * 10) / 10 : null,
      totalFeedback: feedbackAgg._count.rating,
    },
    userGrowth,
    eventGrowth,
    eventsByCategory: eventCategories.map((c) => ({ category: c.category, count: c._count.id })),
    clubsByCategory:  clubCategories.map((c)  => ({ category: c.category, count: c._count.id })),
    topClubs: topClubs.map((c) => ({
      id: c.id, name: c.name, slug: c.slug, category: c.category,
      memberCount: c._count.memberships,
    })),
    topEvents: topEvents.map((e) => ({
      id: e.id, title: e.title, startsAt: e.startsAt,
      club: e.club, attendees: e._count.attendees,
    })),
  });
};
