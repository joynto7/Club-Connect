import type { RequestHandler } from "express";
import { BookingStatus } from "@prisma/client";
import prisma from "../prisma.ts";
import { createNotification } from "../services/notificationService.ts";

export const listVenues: RequestHandler = async (req, res) => {
  const search = req.query["search"] as string | undefined;

  const venues = await prisma.venue.findMany({
    where: {
      isActive: true,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { location: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
  });

  return res.json({ venues });
};

export const getVenue: RequestHandler = async (req, res) => {
  const id = req.params["id"] as string;

  const venue = await prisma.venue.findUnique({
    where: { id },
    include: {
      bookings: {
        where: { status: BookingStatus.APPROVED },
        select: {
          id: true,
          startTime: true,
          endTime: true,
          purpose: true,
          requestedBy: { select: { id: true, name: true } },
          club: { select: { id: true, name: true } },
        },
        orderBy: { startTime: "asc" },
      },
    },
  });

  if (!venue) return res.status(404).json({ error: "Venue not found" });
  return res.json({ venue });
};

export const getVenueAvailability: RequestHandler = async (req, res) => {
  const id = req.params["id"] as string;
  const date = req.query["date"] as string | undefined;

  if (!date) return res.status(400).json({ error: "date query param required (YYYY-MM-DD)" });

  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  const bookings = await prisma.venueBooking.findMany({
    where: {
      venueId: id,
      status: BookingStatus.APPROVED,
      startTime: { lte: end },
      endTime: { gte: start },
    },
    select: { id: true, startTime: true, endTime: true, purpose: true },
    orderBy: { startTime: "asc" },
  });

  return res.json({ bookings });
};

export const createVenueBooking: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const venueId = req.params["id"] as string;
  const { startTime, endTime, purpose, eventId, clubId } = req.body as {
    startTime: string;
    endTime: string;
    purpose: string;
    eventId?: string;
    clubId?: string;
  };

  if (!startTime || !endTime || !purpose) {
    return res.status(400).json({ error: "startTime, endTime and purpose are required" });
  }

  const start = new Date(startTime);
  const end = new Date(endTime);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return res.status(400).json({ error: "Invalid date format" });
  }
  if (start >= end) return res.status(400).json({ error: "endTime must be after startTime" });
  if (start < new Date()) return res.status(400).json({ error: "Cannot book in the past" });

  const venue = await prisma.venue.findUnique({ where: { id: venueId } });
  if (!venue || !venue.isActive) return res.status(404).json({ error: "Venue not found" });

  const conflict = await prisma.venueBooking.findFirst({
    where: {
      venueId,
      status: BookingStatus.APPROVED,
      startTime: { lt: end },
      endTime: { gt: start },
    },
  });

  if (conflict) {
    return res.status(409).json({ error: "Venue is already booked for that time slot" });
  }

  const booking = await prisma.venueBooking.create({
    data: {
      venueId,
      requestedById: req.user.id,
      startTime: start,
      endTime: end,
      purpose,
      eventId: eventId ?? null,
      clubId: clubId ?? null,
    },
    include: {
      venue: { select: { id: true, name: true, location: true } },
      requestedBy: { select: { id: true, name: true } },
    },
  });

  return res.status(201).json({ booking, message: "Booking request submitted for admin approval" });
};

export const getMyVenueBookings: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const bookings = await prisma.venueBooking.findMany({
    where: { requestedById: req.user.id },
    include: {
      venue: { select: { id: true, name: true, location: true, capacity: true } },
      club: { select: { id: true, name: true, slug: true } },
      event: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return res.json({ bookings });
};

export const getAllVenueBookings: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const statusParam = req.query["status"] as string | undefined;
  const status = statusParam as BookingStatus | undefined;

  const bookings = await prisma.venueBooking.findMany({
    where: status ? { status } : {},
    include: {
      venue: { select: { id: true, name: true, location: true } },
      requestedBy: { select: { id: true, name: true, email: true } },
      club: { select: { id: true, name: true, slug: true } },
      event: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return res.json({ bookings });
};

export const approveVenueBooking: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const bookingId = req.params["bookingId"] as string;
  const booking = await prisma.venueBooking.findUnique({ where: { id: bookingId } });

  if (!booking) return res.status(404).json({ error: "Booking not found" });
  if (booking.status !== BookingStatus.PENDING) {
    return res.status(400).json({ error: "Booking is not in PENDING state" });
  }

  const conflict = await prisma.venueBooking.findFirst({
    where: {
      id: { not: bookingId },
      venueId: booking.venueId,
      status: BookingStatus.APPROVED,
      startTime: { lt: booking.endTime },
      endTime: { gt: booking.startTime },
    },
  });

  if (conflict) {
    return res
      .status(409)
      .json({ error: "Cannot approve: venue already has an approved booking for that time slot" });
  }

  const updated = await prisma.venueBooking.update({
    where: { id: bookingId },
    data: { status: BookingStatus.APPROVED },
    include: {
      venue: { select: { id: true, name: true } },
      requestedBy: { select: { id: true, name: true } },
    },
  });

  void createNotification(
    updated.requestedBy.id,
    "BOOKING_APPROVED",
    "Venue Booking Approved",
    `Your booking for "${updated.venue.name}" has been approved.`,
    "/my-bookings"
  );

  return res.json({ booking: updated, message: "Booking approved" });
};

export const rejectVenueBooking: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const bookingId = req.params["bookingId"] as string;
  const { note } = req.body as { note?: string };

  const booking = await prisma.venueBooking.findUnique({ where: { id: bookingId } });
  if (!booking) return res.status(404).json({ error: "Booking not found" });
  if (booking.status !== BookingStatus.PENDING) {
    return res.status(400).json({ error: "Booking is not in PENDING state" });
  }

  const updated = await prisma.venueBooking.update({
    where: { id: bookingId },
    data: { status: BookingStatus.REJECTED, adminNote: note ?? null },
    include: {
      venue: { select: { id: true, name: true } },
      requestedBy: { select: { id: true, name: true } },
    },
  });

  void createNotification(
    updated.requestedBy.id,
    "BOOKING_REJECTED",
    "Venue Booking Rejected",
    `Your booking for "${updated.venue.name}" has been rejected.${note ? ` Reason: ${note}` : ""}`,
    "/my-bookings"
  );

  return res.json({ booking: updated, message: "Booking rejected" });
};

export const cancelVenueBooking: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const bookingId = req.params["bookingId"] as string;
  const booking = await prisma.venueBooking.findUnique({ where: { id: bookingId } });

  if (!booking) return res.status(404).json({ error: "Booking not found" });

  const isAdmin =
    req.user.role === "UNIVERSITY_ADMIN" || req.user.role === "SYSTEM_ADMIN";

  if (booking.requestedById !== req.user.id && !isAdmin) {
    return res.status(403).json({ error: "You can only cancel your own bookings" });
  }

  if (booking.status === BookingStatus.CANCELLED) {
    return res.status(400).json({ error: "Booking is already cancelled" });
  }

  await prisma.venueBooking.update({
    where: { id: bookingId },
    data: { status: BookingStatus.CANCELLED },
  });

  return res.json({ message: "Booking cancelled" });
};

export const createVenue: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const { name, location, description, capacity, facilities, images } = req.body as {
    name: string;
    location: string;
    description?: string;
    capacity: number;
    facilities?: string[];
    images?: string[];
  };

  if (!name || !location || !capacity) {
    return res.status(400).json({ error: "name, location and capacity are required" });
  }

  const venue = await prisma.venue.create({
    data: {
      name,
      location,
      description: description ?? null,
      capacity: Number(capacity),
      facilities: facilities ?? [],
      images: images ?? [],
    },
  });

  return res.status(201).json({ venue, message: "Venue created successfully" });
};

export const updateVenue: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const id = req.params["id"] as string;
  const { name, location, description, capacity, facilities, images, isActive } =
    req.body as {
      name?: string;
      location?: string;
      description?: string;
      capacity?: number;
      facilities?: string[];
      images?: string[];
      isActive?: boolean;
    };

  const venue = await prisma.venue.findUnique({ where: { id } });
  if (!venue) return res.status(404).json({ error: "Venue not found" });

  const updated = await prisma.venue.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(location !== undefined ? { location } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(capacity !== undefined ? { capacity: Number(capacity) } : {}),
      ...(facilities !== undefined ? { facilities } : {}),
      ...(images !== undefined ? { images } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    },
  });

  return res.json({ venue: updated, message: "Venue updated" });
};
