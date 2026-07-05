import type { RequestHandler } from "express";
import { z } from "zod";
import { Role, EventStatus, MembershipStatus, ClubRole } from "@prisma/client";
import prisma from "../prisma.ts";
import { createNotification, createBulkNotifications } from "../services/notificationService.ts";
import { log as auditLog } from "../lib/auditLog.ts";
import { emitToEvent, emitToAdmin } from "../lib/socket.ts";
import { awardPoints } from "../services/pointsService.ts";
import { fireWebhooks } from "../services/webhookService.ts";

// ── Helpers ──────────────────────────────────────────────────────────────────

async function isEventOfficer(userId: string, userRole: string, eventId: string): Promise<boolean> {
  if (userRole === Role.UNIVERSITY_ADMIN || userRole === Role.SYSTEM_ADMIN) return true;
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { clubId: true } });
  if (!event) return false;
  return isClubOfficer(userId, userRole, event.clubId);
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

async function promoteNextWaitlisted(eventId: string) {
  const next = await prisma.eventAttendance.findFirst({
    where: { eventId, status: "REGISTERED", isWaitlisted: true },
    orderBy: { createdAt: "asc" },
  });
  if (next) {
    await prisma.eventAttendance.update({
      where: { id: next.id },
      data: { isWaitlisted: false },
    });
    const event = await prisma.event.findUnique({ where: { id: eventId }, select: { title: true } });
    void createNotification(
      next.userId,
      "EVENT_WAITLIST_PROMOTED",
      "Waitlist Spot Confirmed",
      `A spot opened up for "${event?.title ?? "an event"}". Your registration is now confirmed!`,
      `/events/${eventId}`
    );
  }
}

const parseDate = (v: string) => new Date(v);

const ATTENDEE_SELECT = {
  id: true,
  status: true,
  isWaitlisted: true,
  checkedIn: true,
  checkedInAt: true,
  createdAt: true,
  user: { select: { id: true, name: true, email: true, avatarUrl: true, department: true } },
} as const;

// ── Schemas ──────────────────────────────────────────────────────────────────

const createEventSchema = z.object({
  title:               z.string().min(3, "Title must be at least 3 characters"),
  description:         z.string().max(2000).optional(),
  location:            z.string().min(2, "Location is required"),
  clubId:              z.string().uuid("Invalid club ID"),
  category:            z.string().default("General"),
  tags:                z.array(z.string()).optional(),
  startsAt:            z.string().refine((v) => !isNaN(Date.parse(v)), "Invalid start date"),
  endsAt:              z.string().optional().refine((v) => v === undefined || !isNaN(Date.parse(v)), "Invalid end date"),
  capacity:            z.number().int().min(1).optional(),
  registrationDeadline:z.string().optional().refine((v) => v === undefined || !isNaN(Date.parse(v)), "Invalid deadline"),
  posterUrl:           z.string().url().optional().or(z.literal("")),
  contactPerson:       z.string().optional(),
  maxWaitlist:         z.number().int().min(0).optional(),
  isVirtual:           z.boolean().optional(),
  meetingUrl:          z.string().url().optional().or(z.literal("")),
  isPaid:              z.boolean().optional(),
  ticketPrice:         z.number().int().min(1).optional(),
});

const updateEventSchema = z.object({
  title:               z.string().min(3).optional(),
  description:         z.string().max(2000).optional(),
  location:            z.string().min(2).optional(),
  category:            z.string().optional(),
  tags:                z.array(z.string()).optional(),
  startsAt:            z.string().optional().refine((v) => v === undefined || !isNaN(Date.parse(v)), "Invalid start date"),
  endsAt:              z.string().optional().refine((v) => v === undefined || !isNaN(Date.parse(v)), "Invalid end date"),
  capacity:            z.number().int().min(1).optional(),
  registrationDeadline:z.string().optional().refine((v) => v === undefined || !isNaN(Date.parse(v)), "Invalid deadline"),
  posterUrl:           z.string().url().optional().or(z.literal("")),
  contactPerson:       z.string().optional(),
  maxWaitlist:         z.number().int().min(0).optional(),
  isVirtual:           z.boolean().optional(),
  meetingUrl:          z.string().url().optional().or(z.literal("")),
  isPaid:              z.boolean().optional(),
  ticketPrice:         z.number().int().min(1).optional(),
});

const rejectSchema = z.object({ note: z.string().optional() });

// ── UC-3.5 — List Events ──────────────────────────────────────────────────────

export const listEvents: RequestHandler = async (req, res) => {
  const search   = req.query["search"]   as string | undefined;
  const category = req.query["category"] as string | undefined;
  const clubId   = req.query["clubId"]   as string | undefined;
  const dateFilter = req.query["date"]   as string | undefined;

  const isAdmin = req.user?.role === Role.UNIVERSITY_ADMIN || req.user?.role === Role.SYSTEM_ADMIN;

  const now = new Date();
  let dateWhere = {};
  if (dateFilter === "upcoming") dateWhere = { startsAt: { gte: now } };
  else if (dateFilter === "week")  dateWhere = { startsAt: { gte: now, lte: new Date(now.getTime() + 7 * 86400_000) } };
  else if (dateFilter === "month") dateWhere = { startsAt: { gte: now, lte: new Date(now.getTime() + 30 * 86400_000) } };

  const events = await prisma.event.findMany({
    where: {
      ...(isAdmin ? {} : { status: EventStatus.APPROVED }),
      ...(clubId   ? { clubId }   : {}),
      ...(category && category !== "All" ? { category } : {}),
      ...dateWhere,
      ...(search ? {
        OR: [
          { title:       { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          { location:    { contains: search, mode: "insensitive" } },
        ],
      } : {}),
    },
    select: {
      id: true, title: true, description: true, location: true, category: true,
      tags: true, status: true, startsAt: true, endsAt: true, capacity: true,
      registrationDeadline: true, posterUrl: true, contactPerson: true,
      isVirtual: true, isPaid: true, ticketPrice: true, createdAt: true,
      club: { select: { id: true, name: true, slug: true } },
      createdBy: { select: { id: true, name: true } },
      _count: {
        select: {
          attendees: { where: { status: "REGISTERED", isWaitlisted: false } },
        },
      },
    },
    orderBy: { startsAt: "asc" },
  });

  return res.json({ events });
};

// ── UC-3.5 — Get Event Detail ─────────────────────────────────────────────────

export const getEvent: RequestHandler = async (req, res) => {
  const id = req.params["id"] as string;
  if (!id) return res.status(400).json({ error: "Event ID required" });

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      club: { select: { id: true, name: true, slug: true } },
      createdBy: { select: { id: true, name: true } },
      _count: {
        select: {
          attendees: { where: { status: "REGISTERED", isWaitlisted: false } },
        },
      },
    },
  });

  if (!event) return res.status(404).json({ error: "Event not found" });

  const isAdmin = req.user?.role === Role.UNIVERSITY_ADMIN || req.user?.role === Role.SYSTEM_ADMIN;
  if (event.status !== EventStatus.APPROVED && !isAdmin && event.createdById !== req.user?.id) {
    const officer = req.user ? await isClubOfficer(req.user.id, req.user.role, event.clubId) : false;
    if (!officer) return res.status(404).json({ error: "Event not found" });
  }

  let myRegistration: {
    id: string;
    status: string;
    isWaitlisted: boolean;
    checkedIn: boolean;
    waitlistPosition?: number;
  } | null = null;

  if (req.user) {
    const att = await prisma.eventAttendance.findUnique({
      where: { eventId_userId: { eventId: id, userId: req.user.id } },
      select: { id: true, status: true, isWaitlisted: true, checkedIn: true, createdAt: true },
    });
    if (att) {
      let waitlistPosition: number | undefined;
      if (att.isWaitlisted && att.status === "REGISTERED") {
        waitlistPosition = await prisma.eventAttendance.count({
          where: { eventId: id, isWaitlisted: true, status: "REGISTERED", createdAt: { lte: att.createdAt } },
        });
      }
      myRegistration = {
        id: att.id,
        status: att.status,
        isWaitlisted: att.isWaitlisted,
        checkedIn: att.checkedIn,
        ...(waitlistPosition !== undefined ? { waitlistPosition } : {}),
      };
    }
  }

  let waitlistCount = 0;
  if (event.maxWaitlist) {
    waitlistCount = await prisma.eventAttendance.count({
      where: { eventId: id, status: "REGISTERED", isWaitlisted: true },
    });
  }

  // Gate meetingUrl: only revealed to registered attendees when event is live or ongoing
  const isLive = new Date() >= event.startsAt;
  const isConfirmedAttendee = myRegistration?.status === "REGISTERED" && !myRegistration.isWaitlisted;
  const meetingUrl = (event.isVirtual && event.meetingUrl && isLive && (isConfirmedAttendee || isAdmin))
    ? event.meetingUrl
    : null;

  return res.json({ event: { ...event, meetingUrl }, myRegistration, waitlistCount });
};

// ── UC-3.1 — Create Event ─────────────────────────────────────────────────────

export const createEvent: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const parsed = createEventSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.format() });

  const {
    title, description, location, clubId, category, tags,
    startsAt, endsAt, capacity, registrationDeadline,
    posterUrl, contactPerson, maxWaitlist, isVirtual, meetingUrl,
    isPaid, ticketPrice,
  } = parsed.data;

  const club = await prisma.club.findUnique({ where: { id: clubId } });
  if (!club) return res.status(404).json({ error: "Club not found" });

  const officer = await isClubOfficer(req.user.id, req.user.role, clubId);
  if (!officer) return res.status(403).json({ error: "You must be a club officer to create events" });

  const event = await prisma.event.create({
    data: {
      title,
      description:          description          ?? null,
      location,
      category:             category             ?? "General",
      tags:                 tags                 ?? [],
      status:               EventStatus.PENDING_APPROVAL,
      registrationDeadline: registrationDeadline ? parseDate(registrationDeadline) : null,
      posterUrl:            posterUrl            ? posterUrl : null,
      contactPerson:        contactPerson        ?? null,
      maxWaitlist:          maxWaitlist          ?? null,
      isVirtual:            isVirtual            ?? false,
      meetingUrl:           meetingUrl           ? meetingUrl : null,
      isPaid:               isPaid               ?? false,
      ticketPrice:          ticketPrice          ?? null,
      clubId,
      createdById:          req.user.id,
      startsAt:             parseDate(startsAt),
      endsAt:               endsAt               ? parseDate(endsAt) : null,
      capacity:             capacity             ?? null,
    },
    include: {
      club: { select: { id: true, name: true, slug: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  // Notify admin room of new pending event
  emitToAdmin("admin:new_pending", { type: "event", id: event.id, title: event.title });

  return res.status(201).json({ event, message: "Event submitted for approval" });
};

// ── UC-3.2 — Update Event ─────────────────────────────────────────────────────

export const updateEvent: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  const id = req.params["id"] as string;

  const officer = await isEventOfficer(req.user.id, req.user.role, id);
  if (!officer) return res.status(403).json({ error: "Only club officers can edit events" });

  const parsed = updateEventSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.format() });

  const data: Record<string, unknown> = {};
  const d = parsed.data;
  if (d.title               !== undefined) data["title"]               = d.title;
  if (d.description         !== undefined) data["description"]         = d.description;
  if (d.location            !== undefined) data["location"]            = d.location;
  if (d.category            !== undefined) data["category"]            = d.category;
  if (d.tags                !== undefined) data["tags"]                = d.tags;
  if (d.startsAt            !== undefined) data["startsAt"]            = parseDate(d.startsAt);
  if (d.endsAt              !== undefined) data["endsAt"]              = parseDate(d.endsAt);
  if (d.capacity            !== undefined) data["capacity"]            = d.capacity;
  if (d.registrationDeadline!== undefined) data["registrationDeadline"]= d.registrationDeadline ? parseDate(d.registrationDeadline) : null;
  if (d.posterUrl           !== undefined) data["posterUrl"]           = d.posterUrl || null;
  if (d.contactPerson       !== undefined) data["contactPerson"]       = d.contactPerson;
  if (d.maxWaitlist         !== undefined) data["maxWaitlist"]         = d.maxWaitlist;
  if (d.isVirtual           !== undefined) data["isVirtual"]           = d.isVirtual;
  if (d.meetingUrl          !== undefined) data["meetingUrl"]          = d.meetingUrl || null;
  if (d.isPaid              !== undefined) data["isPaid"]              = d.isPaid;
  if (d.ticketPrice         !== undefined) data["ticketPrice"]         = d.ticketPrice ?? null;

  const event = await prisma.event.update({
    where: { id },
    data,
    include: {
      club: { select: { id: true, name: true, slug: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  return res.json({ event, message: "Event updated" });
};

// ── UC-3.3 — Cancel Event ────────────────────────────────────────────────────

export const cancelEvent: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  const id = req.params["id"] as string;

  const officer = await isEventOfficer(req.user.id, req.user.role, id);
  if (!officer) return res.status(403).json({ error: "Only club officers can cancel events" });

  const eventBefore = await prisma.event.findUnique({ where: { id }, select: { title: true } });

  const event = await prisma.event.update({
    where: { id },
    data: { status: EventStatus.CANCELLED },
  });

  // Notify all registered attendees
  const attendees = await prisma.eventAttendance.findMany({
    where: { eventId: id, status: "REGISTERED" },
    select: { userId: true },
  });
  const attendeeIds = attendees.map((a) => a.userId).filter((uid) => uid !== req.user!.id);
  void createBulkNotifications(
    attendeeIds,
    "EVENT_CANCELLED",
    "Event Cancelled",
    `The event "${eventBefore?.title ?? "an event"}" has been cancelled.`
  );

  return res.json({ event, message: "Event cancelled" });
};

// ── UC-3.4 — Approve Event ────────────────────────────────────────────────────

export const approveEvent: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  const id = req.params["id"] as string;

  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) return res.status(404).json({ error: "Event not found" });
  if (event.status !== EventStatus.PENDING_APPROVAL) {
    return res.status(400).json({ error: "Event is not pending approval" });
  }

  const updated = await prisma.event.update({
    where: { id },
    data: { status: EventStatus.APPROVED, approvalNote: null },
  });

  void createNotification(
    event.createdById,
    "EVENT_APPROVED",
    "Event Approved",
    `Your event "${event.title}" has been approved and is now live.`,
    `/events/${id}`
  );

  void awardPoints(event.createdById, "EVENT_CREATED");
  void auditLog(req.user.id, "APPROVE_EVENT", "Event", id, { eventTitle: event.title }, req.ip);

  // U12.3 — Fire Slack/Discord webhook for new approved event
  const club = await prisma.club.findUnique({ where: { id: event.clubId }, select: { name: true } });
  if (club) {
    void fireWebhooks(event.clubId, "NEW_EVENT", {
      message: `New event: "${event.title}"`,
      link: `${process.env.FRONTEND_URL ?? "http://127.0.0.1:3000"}/events/${id}`,
    }, club.name);
  }

  return res.json({ event: updated, message: "Event approved" });
};

// ── UC-3.4 — Reject Event ─────────────────────────────────────────────────────

export const rejectEvent: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  const id = req.params["id"] as string;

  const parsed = rejectSchema.safeParse(req.body);
  const note = parsed.success ? (parsed.data.note ?? null) : null;

  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) return res.status(404).json({ error: "Event not found" });

  const updated = await prisma.event.update({
    where: { id },
    data: { status: EventStatus.REJECTED, approvalNote: note },
  });

  void createNotification(
    event.createdById,
    "EVENT_REJECTED",
    "Event Rejected",
    note
      ? `Your event "${event.title}" was rejected. Reason: ${note}`
      : `Your event "${event.title}" has been rejected.`,
    `/events/${id}`
  );

  void auditLog(req.user.id, "REJECT_EVENT", "Event", id, { note, eventTitle: event.title }, req.ip);
  return res.json({ event: updated, message: "Event rejected" });
};

// ── UC-3.9 — Register for Event ───────────────────────────────────────────────

export const registerForEvent: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  const id = req.params["id"] as string;

  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) return res.status(404).json({ error: "Event not found" });
  if (event.status !== EventStatus.APPROVED) return res.status(400).json({ error: "Event is not open for registration" });
  if (event.registrationDeadline && new Date() > event.registrationDeadline) {
    return res.status(400).json({ error: "Registration deadline has passed" });
  }
  if (new Date() > event.startsAt) {
    return res.status(400).json({ error: "Event has already started" });
  }

  const existing = await prisma.eventAttendance.findUnique({
    where: { eventId_userId: { eventId: id, userId: req.user.id } },
  });

  if (existing?.status === "REGISTERED") {
    return res.status(409).json({ error: "You are already registered for this event" });
  }

  const confirmedCount = await prisma.eventAttendance.count({
    where: { eventId: id, status: "REGISTERED", isWaitlisted: false },
  });

  let isWaitlisted = false;
  if (event.capacity !== null && confirmedCount >= event.capacity) {
    if (event.maxWaitlist !== null) {
      const waitlistCount = await prisma.eventAttendance.count({
        where: { eventId: id, status: "REGISTERED", isWaitlisted: true },
      });
      if (waitlistCount >= event.maxWaitlist) {
        return res.status(400).json({ error: "Event is full and the waitlist is also full" });
      }
    } else {
      return res.status(400).json({ error: "Event has reached capacity" });
    }
    isWaitlisted = true;
  }

  // U8.5 — Conflict detection (soft check)
  let conflictWarning: string | undefined;
  if (!isWaitlisted && event.endsAt) {
    const conflicts = await prisma.eventAttendance.findMany({
      where: {
        userId: req.user.id,
        status: "REGISTERED",
        isWaitlisted: false,
        event: {
          id: { not: id },
          status: EventStatus.APPROVED,
          startsAt: { lte: event.endsAt },
          endsAt:   { gte: event.startsAt },
        },
      },
      include: { event: { select: { title: true, startsAt: true } } },
    });
    if (conflicts.length > 0) {
      conflictWarning = `You already have "${conflicts[0]!.event.title}" at this time.`;
    }
  }

  let attendance;
  if (existing) {
    attendance = await prisma.eventAttendance.update({
      where: { id: existing.id },
      data: { status: "REGISTERED", isWaitlisted },
    });
  } else {
    attendance = await prisma.eventAttendance.create({
      data: { eventId: id, userId: req.user.id, status: "REGISTERED", isWaitlisted },
    });
  }

  const msg = isWaitlisted
    ? "Added to waitlist. You'll be confirmed if a spot opens."
    : "Successfully registered for the event";

  void createNotification(
    req.user.id,
    "EVENT_RSVP",
    isWaitlisted ? "Added to Waitlist" : "RSVP Confirmed",
    isWaitlisted
      ? `You've been added to the waitlist for "${event.title}".`
      : `Your RSVP for "${event.title}" is confirmed!`,
    `/events/${id}`
  );

  if (!isWaitlisted) void awardPoints(req.user.id, "EVENT_REGISTERED");

  // Auto-create default 1-day reminder for confirmed registrations
  if (!isWaitlisted) {
    const triggerAt = new Date(event.startsAt.getTime() - 1440 * 60_000);
    if (triggerAt > new Date()) {
      void prisma.eventReminder.upsert({
        where: { userId_eventId_minutesBefore: { userId: req.user.id, eventId: id, minutesBefore: 1440 } },
        create: { userId: req.user.id, eventId: id, minutesBefore: 1440 },
        update: { sent: false },
      }).catch(() => {});
    }
  }

  // Emit live attendee count update to all viewers of this event
  const [newConfirmed, newWaitlist] = await Promise.all([
    prisma.eventAttendance.count({ where: { eventId: id, status: "REGISTERED", isWaitlisted: false } }),
    prisma.eventAttendance.count({ where: { eventId: id, status: "REGISTERED", isWaitlisted: true } }),
  ]);
  emitToEvent(id, "event:attendance_changed", { registeredCount: newConfirmed, waitlistCount: newWaitlist });

  return res.status(201).json({ attendance, message: msg, isWaitlisted, ...(conflictWarning ? { warning: conflictWarning } : {}) });
};

// ── UC-11.2 — Cancel Registration ────────────────────────────────────────────

export const cancelRegistration: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  const id = req.params["id"] as string;

  const attendance = await prisma.eventAttendance.findUnique({
    where: { eventId_userId: { eventId: id, userId: req.user.id } },
  });

  if (!attendance || attendance.status === "CANCELLED") {
    return res.status(404).json({ error: "Registration not found" });
  }

  const wasConfirmed = !attendance.isWaitlisted;

  await prisma.eventAttendance.update({
    where: { id: attendance.id },
    data: { status: "CANCELLED" },
  });

  if (wasConfirmed) {
    await promoteNextWaitlisted(id);
  }

  // Emit live count update
  const [newConfirmed, newWaitlist] = await Promise.all([
    prisma.eventAttendance.count({ where: { eventId: id, status: "REGISTERED", isWaitlisted: false } }),
    prisma.eventAttendance.count({ where: { eventId: id, status: "REGISTERED", isWaitlisted: true } }),
  ]);
  emitToEvent(id, "event:attendance_changed", { registeredCount: newConfirmed, waitlistCount: newWaitlist });

  return res.json({ message: "Registration cancelled" });
};

// ── UC-3.11 — Get Attendees ───────────────────────────────────────────────────

export const getAttendees: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  const id = req.params["id"] as string;

  const officer = await isEventOfficer(req.user.id, req.user.role, id);
  if (!officer) return res.status(403).json({ error: "Only club officers can view attendee lists" });

  const attendees = await prisma.eventAttendance.findMany({
    where: { eventId: id, status: "REGISTERED" },
    select: ATTENDEE_SELECT,
    orderBy: [{ isWaitlisted: "asc" }, { createdAt: "asc" }],
  });

  const event = await prisma.event.findUnique({
    where: { id },
    select: { id: true, title: true, capacity: true, maxWaitlist: true },
  });

  return res.json({ attendees, event });
};

// ── UC-3.12 — Check In User ───────────────────────────────────────────────────

export const checkInUser: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  const id     = req.params["id"]     as string;
  const userId = req.params["userId"] as string;

  const officer = await isEventOfficer(req.user.id, req.user.role, id);
  if (!officer) return res.status(403).json({ error: "Only club officers can check in attendees" });

  const attendance = await prisma.eventAttendance.findUnique({
    where: { eventId_userId: { eventId: id, userId } },
  });

  if (!attendance || attendance.status === "CANCELLED") {
    return res.status(404).json({ error: "Attendee not registered for this event" });
  }

  const updated = await prisma.eventAttendance.update({
    where: { id: attendance.id },
    data: {
      checkedIn:   !attendance.checkedIn,
      checkedInAt: !attendance.checkedIn ? new Date() : null,
    },
    select: ATTENDEE_SELECT,
  });

  if (updated.checkedIn) void awardPoints(userId, "EVENT_ATTENDED");

  // Emit live check-in update to officers watching this event's manage page
  emitToEvent(id, "event:checkin", {
    userId,
    checkedIn: updated.checkedIn,
    checkedInAt: updated.checkedInAt,
  });

  return res.json({
    attendance: updated,
    message: updated.checkedIn ? "Checked in" : "Check-in reversed",
  });
};

// ── U8.2 — iCal Export ───────────────────────────────────────────────────────

function formatIcsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export const getEventIcs: RequestHandler = async (req, res) => {
  const id = req.params["id"] as string;

  const event = await prisma.event.findUnique({
    where: { id },
    select: {
      id: true, title: true, description: true, location: true,
      startsAt: true, endsAt: true, status: true, icsToken: true,
      club: { select: { name: true } },
    },
  });

  if (!event) return res.status(404).json({ error: "Event not found" });
  if (event.status !== EventStatus.APPROVED) return res.status(403).json({ error: "Event not available" });

  const dtStart  = formatIcsDate(event.startsAt);
  const dtEnd    = formatIcsDate(event.endsAt ?? event.startsAt);
  const safeDesc = event.description ? stripHtml(event.description).replace(/\n/g, "\\n") : "";
  const safeTitle = event.title.replace(/[,;\\]/g, "\\$&");
  const safeLocation = event.location.replace(/[,;\\]/g, "\\$&");

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Club Connect//Event//EN",
    "BEGIN:VEVENT",
    `UID:${event.icsToken}@clubconnect`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${safeTitle}`,
    `DESCRIPTION:${safeDesc}`,
    `LOCATION:${safeLocation}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const filename = event.title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}.ics"`);
  return res.send(ics);
};

// ── My Events (for activities page) ──────────────────────────────────────────

export const getMyRegistrations: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const registrations = await prisma.eventAttendance.findMany({
    where: { userId: req.user.id, status: "REGISTERED" },
    include: {
      event: {
        include: {
          club: { select: { id: true, name: true, slug: true } },
          _count: { select: { attendees: { where: { status: "REGISTERED", isWaitlisted: false } } } },
        },
      },
    },
    orderBy: { event: { startsAt: "asc" } },
  });

  return res.json({ registrations });
};
