import type { RequestHandler } from "express";
import { z } from "zod";
import { Role, ClubRole, MembershipStatus, EventAttendanceStatus } from "@prisma/client";
import prisma from "../prisma.ts";

async function isOfficerForEvent(userId: string, userRole: string, eventId: string): Promise<boolean> {
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

// GET /events/:id/questions
export const listQuestions: RequestHandler = async (req, res) => {
  const eventId = req.params["id"] as string;

  const questions = await prisma.eventQuestion.findMany({
    where: { eventId },
    orderBy: [{ upvotes: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      question: true,
      upvotes: true,
      isAnswered: true,
      answer: true,
      createdAt: true,
      author: { select: { id: true, name: true, avatarUrl: true } },
      answeredBy: { select: { id: true, name: true } },
    },
  });

  res.json(questions);
};

// POST /events/:id/questions — auth, must be registered
export const submitQuestion: RequestHandler = async (req, res) => {
  const eventId = req.params["id"] as string;
  const userId = req.user!.id;

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) { res.status(404).json({ error: "Event not found" }); return; }

  const attendance = await prisma.eventAttendance.findUnique({
    where: { eventId_userId: { eventId, userId } },
  });
  if (!attendance || attendance.status !== EventAttendanceStatus.REGISTERED) {
    res.status(403).json({ error: "You must be a registered attendee to ask a question" });
    return;
  }

  const schema = z.object({ question: z.string().min(3).max(500) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const q = await prisma.eventQuestion.create({
    data: { eventId, authorId: userId, question: parsed.data.question },
    select: {
      id: true,
      question: true,
      upvotes: true,
      isAnswered: true,
      answer: true,
      createdAt: true,
      author: { select: { id: true, name: true, avatarUrl: true } },
      answeredBy: { select: { id: true, name: true } },
    },
  });

  res.status(201).json(q);
};

// POST /events/:id/questions/:qId/upvote — auth
export const upvoteQuestion: RequestHandler = async (req, res) => {
  const { id: eventId, qId } = req.params as { id: string; qId: string };

  const question = await prisma.eventQuestion.findFirst({ where: { id: qId, eventId } });
  if (!question) { res.status(404).json({ error: "Question not found" }); return; }

  const updated = await prisma.eventQuestion.update({
    where: { id: qId },
    data: { upvotes: { increment: 1 } },
    select: { id: true, upvotes: true },
  });
  res.json(updated);
};

// PUT /events/:id/questions/:qId/answer — officer/admin
export const answerQuestion: RequestHandler = async (req, res) => {
  const { id: eventId, qId } = req.params as { id: string; qId: string };
  const userId = req.user!.id;
  const userRole = req.user!.role;

  if (!(await isOfficerForEvent(userId, userRole, eventId))) {
    res.status(403).json({ error: "Only event officers can answer questions" });
    return;
  }

  const question = await prisma.eventQuestion.findFirst({ where: { id: qId, eventId } });
  if (!question) { res.status(404).json({ error: "Question not found" }); return; }

  const schema = z.object({ answer: z.string().min(1).max(2000) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const updated = await prisma.eventQuestion.update({
    where: { id: qId },
    data: { answer: parsed.data.answer, isAnswered: true, answeredById: userId },
    select: {
      id: true,
      question: true,
      upvotes: true,
      isAnswered: true,
      answer: true,
      createdAt: true,
      author: { select: { id: true, name: true, avatarUrl: true } },
      answeredBy: { select: { id: true, name: true } },
    },
  });
  res.json(updated);
};
