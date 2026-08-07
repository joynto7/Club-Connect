import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { Role, MembershipStatus, ClubRole } from "@prisma/client";
import prisma from "../prisma.ts";
import { emitToEvent } from "../lib/socket.ts";
import { accessTokenSecret } from "../lib/jwtSecrets.ts";
import { awardPoints } from "../services/pointsService.ts";

async function isEventOfficer(userId: string, userRole: string, eventId: string): Promise<boolean> {
  if (userRole === Role.UNIVERSITY_ADMIN || userRole === Role.SYSTEM_ADMIN) return true;
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { clubId: true } });
  if (!event) return false;
  const m = await prisma.clubMembership.findUnique({
    where: { clubId_userId: { clubId: event.clubId, userId } },
  });
  return (
    m?.status === MembershipStatus.APPROVED &&
    (m.role === ClubRole.PRESIDENT || m.role === ClubRole.COORDINATOR)
  );
}

interface TicketPayload {
  eventId: string;
  userId: string;
  type: "ticket";
  iat?: number;
  exp?: number;
}

export const getTicket: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  const eventId = req.params["id"] as string;
  const userId = req.user.id;

  const attendance = await prisma.eventAttendance.findUnique({
    where: { eventId_userId: { eventId, userId } },
  });

  if (!attendance || attendance.status !== "REGISTERED" || attendance.isWaitlisted) {
    return res.status(403).json({ error: "You don't have a confirmed ticket for this event" });
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { title: true, startsAt: true, location: true, club: { select: { name: true } } },
  });
  if (!event) return res.status(404).json({ error: "Event not found" });

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });

  const token = jwt.sign(
    { eventId, userId, type: "ticket" } satisfies Omit<TicketPayload, "iat" | "exp">,
    accessTokenSecret,
    { expiresIn: "24h" }
  );

  return res.json({
    token,
    eventTitle: event.title,
    attendeeName: user?.name ?? "Unknown",
    startsAt: event.startsAt,
    location: event.location,
    clubName: event.club?.name ?? null,
  });
};

export const scanTicket: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  const eventId = req.params["id"] as string;

  const officer = await isEventOfficer(req.user.id, req.user.role, eventId);
  if (!officer) return res.status(403).json({ error: "Only club officers can scan tickets" });

  const { token } = req.body as { token?: string };
  if (!token) return res.status(400).json({ error: "Token required" });

  let payload: TicketPayload;
  try {
    payload = jwt.verify(token, accessTokenSecret) as TicketPayload;
  } catch {
    return res.status(400).json({ error: "Invalid or expired ticket" });
  }

  if (payload.type !== "ticket" || payload.eventId !== eventId) {
    return res.status(400).json({ error: "Invalid ticket for this event" });
  }

  const attendance = await prisma.eventAttendance.findUnique({
    where: { eventId_userId: { eventId, userId: payload.userId } },
    include: { user: { select: { name: true, id: true } } },
  });

  if (!attendance || attendance.status !== "REGISTERED" || attendance.isWaitlisted) {
    return res.status(400).json({ error: "No valid registration found" });
  }

  if (attendance.checkedIn) {
    return res.json({
      success: true,
      alreadyCheckedIn: true,
      attendee: { name: attendance.user.name, id: payload.userId },
    });
  }

  await prisma.eventAttendance.update({
    where: { id: attendance.id },
    data: { checkedIn: true, checkedInAt: new Date() },
  });

  void awardPoints(payload.userId, "EVENT_ATTENDED");

  emitToEvent(eventId, "event:checkin", {
    userId: payload.userId,
    checkedIn: true,
    checkedInAt: new Date().toISOString(),
  });

  return res.json({
    success: true,
    alreadyCheckedIn: false,
    attendee: { name: attendance.user.name, id: payload.userId },
  });
};

export const setReminder: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  const eventId = req.params["id"] as string;
  const userId = req.user.id;

  const { minutesBefore } = req.body as { minutesBefore?: number };
  if (!minutesBefore || ![1440, 60, 15].includes(minutesBefore)) {
    return res.status(400).json({ error: "minutesBefore must be 1440, 60, or 15" });
  }

  const attendance = await prisma.eventAttendance.findUnique({
    where: { eventId_userId: { eventId, userId } },
  });
  if (!attendance || attendance.status !== "REGISTERED") {
    return res.status(403).json({ error: "You must be registered to set reminders" });
  }

  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { startsAt: true } });
  if (!event) return res.status(404).json({ error: "Event not found" });

  const triggerAt = new Date(event.startsAt.getTime() - minutesBefore * 60_000);
  if (triggerAt <= new Date()) {
    return res.status(400).json({ error: "Reminder time has already passed" });
  }

  const reminder = await prisma.eventReminder.upsert({
    where: { userId_eventId_minutesBefore: { userId, eventId, minutesBefore } },
    create: { userId, eventId, minutesBefore },
    update: { sent: false },
  });

  return res.status(201).json({ reminder, message: "Reminder set" });
};
