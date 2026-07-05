import type { RequestHandler } from "express";
import { BookingStatus } from "@prisma/client";
import prisma from "../prisma.ts";
import { createNotification } from "../services/notificationService.ts";

export const listResources: RequestHandler = async (req, res) => {
  const search = req.query["search"] as string | undefined;
  const category = req.query["category"] as string | undefined;

  const resources = await prisma.resource.findMany({
    where: {
      isActive: true,
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
      ...(category ? { category } : {}),
    },
    orderBy: { name: "asc" },
  });

  return res.json({ resources });
};

export const createResourceBooking: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const resourceId = req.params["id"] as string;
  const { startTime, endTime, purpose, quantity, eventId, clubId } = req.body as {
    startTime: string;
    endTime: string;
    purpose: string;
    quantity?: number;
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

  const resource = await prisma.resource.findUnique({ where: { id: resourceId } });
  if (!resource || !resource.isActive) {
    return res.status(404).json({ error: "Resource not found" });
  }

  const requestedQty = quantity ?? 1;
  if (requestedQty < 1) return res.status(400).json({ error: "Quantity must be at least 1" });
  if (requestedQty > resource.quantity) {
    return res.status(400).json({ error: `Only ${resource.quantity} unit(s) available` });
  }

  // Check available quantity in the requested window (based on approved bookings)
  const overlapping = await prisma.resourceBooking.findMany({
    where: {
      resourceId,
      status: BookingStatus.APPROVED,
      startTime: { lt: end },
      endTime: { gt: start },
    },
    select: { quantity: true },
  });

  const bookedQty = overlapping.reduce((sum, b) => sum + b.quantity, 0);
  const availableQty = resource.quantity - bookedQty;

  if (requestedQty > availableQty) {
    return res
      .status(409)
      .json({ error: `Only ${availableQty} unit(s) available for that time slot` });
  }

  const booking = await prisma.resourceBooking.create({
    data: {
      resourceId,
      requestedById: req.user.id,
      startTime: start,
      endTime: end,
      purpose,
      quantity: requestedQty,
      eventId: eventId ?? null,
      clubId: clubId ?? null,
    },
    include: {
      resource: { select: { id: true, name: true, category: true } },
      requestedBy: { select: { id: true, name: true } },
    },
  });

  return res
    .status(201)
    .json({ booking, message: "Resource booking request submitted for admin approval" });
};

export const getMyResourceBookings: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const bookings = await prisma.resourceBooking.findMany({
    where: { requestedById: req.user.id },
    include: {
      resource: { select: { id: true, name: true, category: true } },
      club: { select: { id: true, name: true, slug: true } },
      event: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return res.json({ bookings });
};

export const getAllResourceBookings: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const statusParam = req.query["status"] as string | undefined;
  const status = statusParam as BookingStatus | undefined;

  const bookings = await prisma.resourceBooking.findMany({
    where: status ? { status } : {},
    include: {
      resource: { select: { id: true, name: true, category: true } },
      requestedBy: { select: { id: true, name: true, email: true } },
      club: { select: { id: true, name: true, slug: true } },
      event: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return res.json({ bookings });
};

export const approveResourceBooking: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const bookingId = req.params["bookingId"] as string;
  const booking = await prisma.resourceBooking.findUnique({
    where: { id: bookingId },
    include: { resource: true },
  });

  if (!booking) return res.status(404).json({ error: "Booking not found" });
  if (booking.status !== BookingStatus.PENDING) {
    return res.status(400).json({ error: "Booking is not in PENDING state" });
  }

  const overlapping = await prisma.resourceBooking.findMany({
    where: {
      id: { not: bookingId },
      resourceId: booking.resourceId,
      status: BookingStatus.APPROVED,
      startTime: { lt: booking.endTime },
      endTime: { gt: booking.startTime },
    },
    select: { quantity: true },
  });

  const bookedQty = overlapping.reduce((sum, b) => sum + b.quantity, 0);
  const availableQty = booking.resource.quantity - bookedQty;

  if (booking.quantity > availableQty) {
    return res.status(409).json({
      error: `Cannot approve: only ${availableQty} unit(s) available for that time slot`,
    });
  }

  const updated = await prisma.resourceBooking.update({
    where: { id: bookingId },
    data: { status: BookingStatus.APPROVED },
    include: {
      resource: { select: { id: true, name: true } },
      requestedBy: { select: { id: true, name: true } },
    },
  });

  void createNotification(
    updated.requestedBy.id,
    "BOOKING_APPROVED",
    "Resource Booking Approved",
    `Your booking for "${updated.resource.name}" has been approved.`,
    "/my-bookings"
  );

  return res.json({ booking: updated, message: "Resource booking approved" });
};

export const rejectResourceBooking: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const bookingId = req.params["bookingId"] as string;
  const { note } = req.body as { note?: string };

  const booking = await prisma.resourceBooking.findUnique({ where: { id: bookingId } });
  if (!booking) return res.status(404).json({ error: "Booking not found" });
  if (booking.status !== BookingStatus.PENDING) {
    return res.status(400).json({ error: "Booking is not in PENDING state" });
  }

  const updated = await prisma.resourceBooking.update({
    where: { id: bookingId },
    data: { status: BookingStatus.REJECTED, adminNote: note ?? null },
    include: {
      resource: { select: { id: true, name: true } },
      requestedBy: { select: { id: true, name: true } },
    },
  });

  void createNotification(
    updated.requestedBy.id,
    "BOOKING_REJECTED",
    "Resource Booking Rejected",
    `Your booking for "${updated.resource.name}" has been rejected.${note ? ` Reason: ${note}` : ""}`,
    "/my-bookings"
  );

  return res.json({ booking: updated, message: "Resource booking rejected" });
};

export const cancelResourceBooking: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const bookingId = req.params["bookingId"] as string;
  const booking = await prisma.resourceBooking.findUnique({ where: { id: bookingId } });

  if (!booking) return res.status(404).json({ error: "Booking not found" });

  const isAdmin =
    req.user.role === "UNIVERSITY_ADMIN" || req.user.role === "SYSTEM_ADMIN";

  if (booking.requestedById !== req.user.id && !isAdmin) {
    return res.status(403).json({ error: "You can only cancel your own bookings" });
  }

  if (booking.status === BookingStatus.CANCELLED) {
    return res.status(400).json({ error: "Booking is already cancelled" });
  }

  await prisma.resourceBooking.update({
    where: { id: bookingId },
    data: { status: BookingStatus.CANCELLED },
  });

  return res.json({ message: "Resource booking cancelled" });
};

export const createResource: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const { name, category, description, quantity } = req.body as {
    name: string;
    category?: string;
    description?: string;
    quantity?: number;
  };

  if (!name) return res.status(400).json({ error: "name is required" });

  const resource = await prisma.resource.create({
    data: {
      name,
      category: category ?? "General",
      description: description ?? null,
      quantity: quantity ?? 1,
    },
  });

  return res.status(201).json({ resource, message: "Resource created successfully" });
};

export const updateResource: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const id = req.params["id"] as string;
  const { name, category, description, quantity, isActive } = req.body as {
    name?: string;
    category?: string;
    description?: string;
    quantity?: number;
    isActive?: boolean;
  };

  const resource = await prisma.resource.findUnique({ where: { id } });
  if (!resource) return res.status(404).json({ error: "Resource not found" });

  const updated = await prisma.resource.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(category !== undefined ? { category } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(quantity !== undefined ? { quantity: Number(quantity) } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    },
  });

  return res.json({ resource: updated, message: "Resource updated" });
};
