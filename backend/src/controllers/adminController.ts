import type { RequestHandler } from "express";
import { ClubStatus, EventStatus, BookingStatus, Role, ReportStatus } from "@prisma/client";
import { z } from "zod";
import prisma from "../prisma.ts";
import { log as auditLog } from "../lib/auditLog.ts";

export const getAdminStats: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const [
    pendingClubsCount,
    pendingEventsCount,
    pendingVenueBookingsCount,
    pendingResourceBookingsCount,
    totalUsers,
    totalActiveClubs,
    totalEvents,
  ] = await Promise.all([
    prisma.club.count({ where: { status: ClubStatus.PENDING } }),
    prisma.event.count({ where: { status: EventStatus.PENDING_APPROVAL } }),
    prisma.venueBooking.count({ where: { status: BookingStatus.PENDING } }),
    prisma.resourceBooking.count({ where: { status: BookingStatus.PENDING } }),
    prisma.user.count(),
    prisma.club.count({ where: { status: ClubStatus.ACTIVE } }),
    prisma.event.count({ where: { status: EventStatus.APPROVED } }),
  ]);

  const [pendingClubs, pendingEvents, pendingVenueBookings, pendingResourceBookings] =
    await Promise.all([
      prisma.club.findMany({
        where: { status: ClubStatus.PENDING },
        select: {
          id: true,
          name: true,
          slug: true,
          category: true,
          createdAt: true,
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "asc" },
        take: 10,
      }),
      prisma.event.findMany({
        where: { status: EventStatus.PENDING_APPROVAL },
        select: {
          id: true,
          title: true,
          category: true,
          startsAt: true,
          createdAt: true,
          club: { select: { id: true, name: true, slug: true } },
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "asc" },
        take: 10,
      }),
      prisma.venueBooking.findMany({
        where: { status: BookingStatus.PENDING },
        select: {
          id: true,
          purpose: true,
          startTime: true,
          endTime: true,
          createdAt: true,
          venue: { select: { id: true, name: true, location: true } },
          requestedBy: { select: { id: true, name: true } },
          club: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "asc" },
        take: 10,
      }),
      prisma.resourceBooking.findMany({
        where: { status: BookingStatus.PENDING },
        select: {
          id: true,
          purpose: true,
          quantity: true,
          startTime: true,
          endTime: true,
          createdAt: true,
          resource: { select: { id: true, name: true, category: true } },
          requestedBy: { select: { id: true, name: true } },
          club: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "asc" },
        take: 10,
      }),
    ]);

  const [recentClubs, recentEvents, recentUsers] = await Promise.all([
    prisma.club.findMany({
      select: { id: true, name: true, slug: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.event.findMany({
      where: { status: { not: EventStatus.DRAFT } },
      select: { id: true, title: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.user.findMany({
      select: { id: true, name: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const recentActivity = [
    ...recentClubs.map((c) => ({
      type: "CLUB_CREATED" as const,
      title: c.name,
      subtitle: "New club requested",
      link: `/clubs/${c.slug}`,
      createdAt: c.createdAt.toISOString(),
    })),
    ...recentEvents.map((e) => ({
      type: "EVENT_CREATED" as const,
      title: e.title,
      subtitle: "New event submitted",
      link: `/events/${e.id}`,
      createdAt: e.createdAt.toISOString(),
    })),
    ...recentUsers.map((u) => ({
      type: "USER_JOINED" as const,
      title: u.name,
      subtitle: "New user registered",
      link: `/profile`,
      createdAt: u.createdAt.toISOString(),
    })),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  return res.json({
    counts: {
      pendingClubs: pendingClubsCount,
      pendingEvents: pendingEventsCount,
      pendingVenueBookings: pendingVenueBookingsCount,
      pendingResourceBookings: pendingResourceBookingsCount,
      totalUsers,
      totalActiveClubs,
      totalEvents,
    },
    pendingClubs,
    pendingEvents,
    pendingVenueBookings,
    pendingResourceBookings,
    recentActivity,
  });
};

// ── UC-7.1 — List all users (search + filter + pagination) ──────────────────
export const listAdminUsers: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const page  = Math.max(1, parseInt(String(req.query["page"]  ?? "1"),  10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query["limit"] ?? "20"), 10)));
  const q     = typeof req.query["q"]    === "string" ? req.query["q"].trim()    : undefined;
  const role  = typeof req.query["role"] === "string" ? req.query["role"].trim() : undefined;
  const suspended = req.query["suspended"];

  const where: Record<string, unknown> = {};
  if (q) {
    where["OR"] = [
      { name:  { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }
  if (role && Object.values(Role).includes(role as Role)) {
    where["role"] = role as Role;
  }
  if (suspended === "true")  where["isSuspended"] = true;
  if (suspended === "false") where["isSuspended"] = false;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true, name: true, email: true, role: true,
        department: true, year: true, avatarUrl: true,
        isSuspended: true, suspendedReason: true,
        emailVerified: true, createdAt: true,
        _count: {
          select: {
            memberships:      { where: { status: "APPROVED" } },
            attendances:      true,
            contentReportsSubmitted: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip:  (page - 1) * limit,
      take:  limit,
    }),
    prisma.user.count({ where }),
  ]);

  return res.json({ users, total, page, limit, pages: Math.ceil(total / limit) });
};

// ── UC-7.2 — Suspend a user ─────────────────────────────────────────────────
const suspendSchema = z.object({ reason: z.string().min(1).optional() });

export const suspendUser: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const id = req.params["id"] as string;
  if (id === req.user.id) return res.status(400).json({ error: "Cannot suspend yourself" });

  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
  if (!target) return res.status(404).json({ error: "User not found" });
  if (target.role === Role.SYSTEM_ADMIN) return res.status(403).json({ error: "Cannot suspend a SYSTEM_ADMIN" });

  const parsed = suspendSchema.safeParse(req.body);
  const reason = parsed.success ? (parsed.data.reason ?? null) : null;

  const user = await prisma.user.update({
    where: { id },
    data: { isSuspended: true, suspendedReason: reason },
    select: { id: true, name: true, isSuspended: true, suspendedReason: true },
  });
  void auditLog(req.user.id, "SUSPEND_USER", "User", id, { reason }, req.ip);
  return res.json({ user, message: "User suspended" });
};

// ── UC-7.2 — Activate (un-suspend) a user ───────────────────────────────────
export const activateUser: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const id = req.params["id"] as string;
  const target = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!target) return res.status(404).json({ error: "User not found" });

  const user = await prisma.user.update({
    where: { id },
    data: { isSuspended: false, suspendedReason: null },
    select: { id: true, name: true, isSuspended: true },
  });
  void auditLog(req.user.id, "ACTIVATE_USER", "User", id, {}, req.ip);
  return res.json({ user, message: "User activated" });
};

// ── UC-7.2 — Change system role ─────────────────────────────────────────────
const roleSchema = z.object({ role: z.nativeEnum(Role) });

export const changeUserRole: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const id = req.params["id"] as string;
  if (id === req.user.id) return res.status(400).json({ error: "Cannot change your own role" });

  const parsed = roleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.format() });

  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
  if (!target) return res.status(404).json({ error: "User not found" });

  const user = await prisma.user.update({
    where: { id },
    data: { role: parsed.data.role },
    select: { id: true, name: true, role: true },
  });
  void auditLog(req.user.id, "CHANGE_ROLE", "User", id, { oldRole: target.role, newRole: parsed.data.role }, req.ip);
  return res.json({ user, message: "Role updated" });
};

// ── UC-7.3 — List all clubs (admin oversight) ───────────────────────────────
export const listAdminClubs: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const page   = Math.max(1, parseInt(String(req.query["page"]   ?? "1"),  10));
  const limit  = Math.min(100, Math.max(1, parseInt(String(req.query["limit"]  ?? "20"), 10)));
  const q      = typeof req.query["q"]      === "string" ? req.query["q"].trim()      : undefined;
  const status = typeof req.query["status"] === "string" ? req.query["status"].trim() : undefined;

  const where: Record<string, unknown> = {};
  if (q) where["name"] = { contains: q, mode: "insensitive" };
  if (status && Object.values(ClubStatus).includes(status as ClubStatus)) {
    where["status"] = status as ClubStatus;
  }

  const [clubs, total] = await Promise.all([
    prisma.club.findMany({
      where,
      select: {
        id: true, name: true, slug: true, category: true, status: true,
        approvalNote: true, logoUrl: true, contactEmail: true, createdAt: true,
        createdBy: { select: { id: true, name: true, email: true } },
        _count: {
          select: {
            memberships: { where: { status: "APPROVED" } },
            events:       true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip:  (page - 1) * limit,
      take:  limit,
    }),
    prisma.club.count({ where }),
  ]);

  return res.json({ clubs, total, page, limit, pages: Math.ceil(total / limit) });
};

// ── UC-7.4 — List all events (admin oversight) ──────────────────────────────
export const listAdminEvents: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const page   = Math.max(1, parseInt(String(req.query["page"]   ?? "1"),  10));
  const limit  = Math.min(100, Math.max(1, parseInt(String(req.query["limit"]  ?? "20"), 10)));
  const q      = typeof req.query["q"]      === "string" ? req.query["q"].trim()      : undefined;
  const status = typeof req.query["status"] === "string" ? req.query["status"].trim() : undefined;

  const where: Record<string, unknown> = {};
  if (q) where["title"] = { contains: q, mode: "insensitive" };
  if (status && Object.values(EventStatus).includes(status as EventStatus)) {
    where["status"] = status as EventStatus;
  }

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      select: {
        id: true, title: true, category: true, status: true, location: true,
        startsAt: true, endsAt: true, approvalNote: true, createdAt: true,
        club:      { select: { id: true, name: true, slug: true } },
        createdBy: { select: { id: true, name: true } },
        _count:    { select: { attendees: { where: { status: "REGISTERED", isWaitlisted: false } } } },
      },
      orderBy: { createdAt: "desc" },
      skip:  (page - 1) * limit,
      take:  limit,
    }),
    prisma.event.count({ where }),
  ]);

  return res.json({ events, total, page, limit, pages: Math.ceil(total / limit) });
};

// ── UC-7.5 — List content reports ───────────────────────────────────────────
export const listContentReports: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const page   = Math.max(1, parseInt(String(req.query["page"]   ?? "1"),  10));
  const limit  = Math.min(100, Math.max(1, parseInt(String(req.query["limit"]  ?? "20"), 10)));
  const status = typeof req.query["status"] === "string" ? req.query["status"].trim() : undefined;

  const where: Record<string, unknown> = {};
  if (status && Object.values(ReportStatus).includes(status as ReportStatus)) {
    where["status"] = status as ReportStatus;
  }

  const [reports, total] = await Promise.all([
    prisma.contentReport.findMany({
      where,
      select: {
        id: true, targetType: true, targetId: true, reason: true,
        description: true, status: true, resolvedNote: true,
        createdAt: true, updatedAt: true,
        reporter:   { select: { id: true, name: true, email: true } },
        resolvedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip:  (page - 1) * limit,
      take:  limit,
    }),
    prisma.contentReport.count({ where }),
  ]);

  return res.json({ reports, total, page, limit, pages: Math.ceil(total / limit) });
};

const resolveSchema = z.object({ note: z.string().optional() });

// ── UC-7.5 — Resolve a content report ───────────────────────────────────────
export const resolveContentReport: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const id = req.params["id"] as string;
  const report = await prisma.contentReport.findUnique({ where: { id } });
  if (!report) return res.status(404).json({ error: "Report not found" });

  const parsed = resolveSchema.safeParse(req.body);
  const note = parsed.success ? (parsed.data.note ?? null) : null;

  const updated = await prisma.contentReport.update({
    where: { id },
    data: { status: ReportStatus.RESOLVED, resolvedById: req.user.id, resolvedNote: note },
  });
  void auditLog(req.user.id, "RESOLVE_CONTENT_REPORT", "ContentReport", id, { note }, req.ip);
  return res.json({ report: updated, message: "Report resolved" });
};

// ── UC-7.5 — Dismiss a content report ───────────────────────────────────────
export const dismissContentReport: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const id = req.params["id"] as string;
  const report = await prisma.contentReport.findUnique({ where: { id } });
  if (!report) return res.status(404).json({ error: "Report not found" });

  const parsed = resolveSchema.safeParse(req.body);
  const note = parsed.success ? (parsed.data.note ?? null) : null;

  const updated = await prisma.contentReport.update({
    where: { id },
    data: { status: ReportStatus.DISMISSED, resolvedById: req.user.id, resolvedNote: note },
  });
  void auditLog(req.user.id, "DISMISS_CONTENT_REPORT", "ContentReport", id, { note }, req.ip);
  return res.json({ report: updated, message: "Report dismissed" });
};

// ── UC-7.6 — Get system settings ────────────────────────────────────────────
export const getSystemSettings: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const settings = await prisma.systemConfig.findMany({ orderBy: { key: "asc" } });
  // Return as key→value map plus full list for editing
  const map: Record<string, string> = {};
  for (const s of settings) map[s.key] = s.value;
  return res.json({ settings, map });
};

const settingsUpsertSchema = z.object({
  key:   z.string().min(1),
  value: z.string(),
  label: z.string().optional(),
});

// ── UC-7.6 — Upsert a single system config key ──────────────────────────────
export const upsertSystemSetting: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const parsed = settingsUpsertSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.format() });

  const { key, value, label } = parsed.data;
  const setting = await prisma.systemConfig.upsert({
    where: { key },
    create: { key, value, label: label ?? key },
    update: { value, ...(label !== undefined && { label }) },
  });
  void auditLog(req.user.id, "UPSERT_SETTING", "Setting", key, { value }, req.ip);
  return res.json({ setting, message: "Setting saved" });
};

// ── U10.2 — Audit Log query ──────────────────────────────────────────────────
export const getAuditLog: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const page   = Math.max(1, parseInt(String(req.query["page"]   ?? "1"),  10));
  const limit  = Math.min(100, Math.max(1, parseInt(String(req.query["limit"] ?? "20"), 10)));
  const action = typeof req.query["action"]  === "string" ? req.query["action"].trim()  : undefined;
  const from   = typeof req.query["from"]    === "string" ? req.query["from"].trim()    : undefined;
  const to     = typeof req.query["to"]      === "string" ? req.query["to"].trim()      : undefined;
  const q      = typeof req.query["q"]       === "string" ? req.query["q"].trim()       : undefined;

  const where: Record<string, unknown> = {};
  if (action) where["action"] = action;
  if (from || to) {
    where["createdAt"] = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to   ? { lte: new Date(to)   } : {}),
    };
  }
  if (q) {
    where["actor"] = { name: { contains: q, mode: "insensitive" } };
  }

  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { actor: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      orderBy: { createdAt: "desc" },
      skip:  (page - 1) * limit,
      take:  limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return res.json({ entries, total, page, limit, pages: Math.ceil(total / limit) });
};

// ── U10.4 — Bulk Admin Operations ────────────────────────────────────────────
const bulkIdsSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(100) });
const bulkSuspendSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(100), reason: z.string().optional() });

export const bulkApproveClubs: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const parsed = bulkIdsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.format() });

  const { ids } = parsed.data;
  let approved = 0;
  let failed = 0;

  for (const id of ids) {
    const club = await prisma.club.findUnique({ where: { id }, select: { id: true, status: true, name: true } });
    if (!club || club.status !== ClubStatus.PENDING) { failed++; continue; }
    await prisma.club.update({ where: { id }, data: { status: ClubStatus.ACTIVE, approvalNote: null } });
    void auditLog(req.user.id, "APPROVE_CLUB", "Club", id, { bulk: true }, req.ip);
    approved++;
  }

  return res.json({ approved, failed, message: `${approved} club(s) approved` });
};

export const bulkApproveEvents: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const parsed = bulkIdsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.format() });

  const { ids } = parsed.data;
  let approved = 0;
  let failed = 0;

  for (const id of ids) {
    const event = await prisma.event.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!event || event.status !== EventStatus.PENDING_APPROVAL) { failed++; continue; }
    await prisma.event.update({ where: { id }, data: { status: EventStatus.APPROVED, approvalNote: null } });
    void auditLog(req.user.id, "APPROVE_EVENT", "Event", id, { bulk: true }, req.ip);
    approved++;
  }

  return res.json({ approved, failed, message: `${approved} event(s) approved` });
};

export const bulkSuspendUsers: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const parsed = bulkSuspendSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.format() });

  const { ids, reason } = parsed.data;
  let suspended = 0;
  let failed = 0;

  for (const id of ids) {
    if (id === req.user.id) { failed++; continue; }
    const user = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, isSuspended: true } });
    if (!user || user.role === Role.SYSTEM_ADMIN || user.isSuspended) { failed++; continue; }
    await prisma.user.update({ where: { id }, data: { isSuspended: true, suspendedReason: reason ?? null } });
    void auditLog(req.user.id, "SUSPEND_USER", "User", id, { reason, bulk: true }, req.ip);
    suspended++;
  }

  return res.json({ suspended, failed, message: `${suspended} user(s) suspended` });
};

// ── U10 — Email Digest Subscription ──────────────────────────────────────────
const digestSchema = z.object({ frequency: z.enum(["DAILY", "WEEKLY", "NONE"]) });

export const getEmailDigestSub: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  const sub = await prisma.emailDigestSubscription.findUnique({ where: { userId: req.user.id } });
  return res.json({ subscription: sub ?? { frequency: "NONE" } });
};

export const upsertEmailDigestSub: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  const parsed = digestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.format() });
  const sub = await prisma.emailDigestSubscription.upsert({
    where: { userId: req.user.id },
    create: { userId: req.user.id, frequency: parsed.data.frequency },
    update: { frequency: parsed.data.frequency },
  });
  return res.json({ subscription: sub });
};

// ── System Monitor — app activity + security signals ────────────────────────
export const getSystemMonitor: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    activeSessions,
    suspendedAccounts,
    lockedOutAccounts,
    elevatedLoginAttempts,
    twoFactorEnabledCount,
    signupsRaw,
    recentAuditLogs,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.session.count({ where: { expiresAt: { gt: now } } }),
    prisma.user.count({ where: { isSuspended: true } }),
    prisma.user.count({ where: { lockedUntil: { gt: now } } }),
    prisma.user.count({ where: { loginAttempts: { gte: 3 } } }),
    prisma.user.count({ where: { twoFactorEnabled: true } }),
    prisma.user.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
    }),
    prisma.auditLog.findMany({
      include: { actor: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const signupsByDay = new Map<string, number>();
  for (const u of signupsRaw) {
    const day = u.createdAt.toISOString().slice(0, 10);
    signupsByDay.set(day, (signupsByDay.get(day) ?? 0) + 1);
  }
  const signupsOverTime = Array.from(signupsByDay.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return res.json({
    totalUsers,
    activeSessions,
    suspendedAccounts,
    lockedOutAccounts,
    elevatedLoginAttempts,
    twoFactorAdoption: totalUsers > 0 ? twoFactorEnabledCount / totalUsers : 0,
    signupsOverTime,
    recentAuditLogs: recentAuditLogs.map((l) => ({
      id: l.id,
      action: l.action,
      targetType: l.targetType,
      targetId: l.targetId,
      actorName: l.actor.name,
      createdAt: l.createdAt.toISOString(),
    })),
  });
};
