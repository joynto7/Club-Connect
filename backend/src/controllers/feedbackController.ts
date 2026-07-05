import type { RequestHandler } from "express";
import { z } from "zod";
import { Role, EventStatus, MembershipStatus, ClubRole } from "@prisma/client";
import Anthropic from "@anthropic-ai/sdk";
import prisma from "../prisma.ts";
import { awardPoints } from "../services/pointsService.ts";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

const submitFeedbackSchema = z.object({
  rating:         z.number().int().min(1).max(5),
  comment:        z.string().max(1000).optional(),
  categoryRatings: z.record(z.string(), z.number().int().min(1).max(5)).optional(),
});

// UC-6.1 — Submit post-event feedback
export const submitFeedback: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  const eventId = req.params["id"] as string;

  const parsed = submitFeedbackSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.format() });

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return res.status(404).json({ error: "Event not found" });
  if (event.status !== EventStatus.APPROVED) {
    return res.status(400).json({ error: "Feedback can only be submitted for approved events" });
  }

  const now = new Date();
  const ended = event.endsAt ? now > event.endsAt : now > event.startsAt;
  if (!ended) {
    return res.status(400).json({ error: "Feedback can only be submitted after the event has ended" });
  }

  const attendance = await prisma.eventAttendance.findUnique({
    where: { eventId_userId: { eventId, userId: req.user.id } },
  });
  if (!attendance || attendance.status !== "REGISTERED") {
    return res.status(403).json({ error: "You must have been registered for this event to submit feedback" });
  }

  const existing = await prisma.eventFeedback.findUnique({
    where: { eventId_userId: { eventId, userId: req.user.id } },
  });
  if (existing) {
    return res.status(409).json({ error: "You have already submitted feedback for this event" });
  }

  const { rating, comment, categoryRatings } = parsed.data;

  const feedback = await prisma.eventFeedback.create({
    data: {
      eventId,
      userId: req.user.id,
      rating,
      comment:        comment ?? null,
      categoryRatings: categoryRatings ?? {},
    },
  });

  void awardPoints(req.user.id, "FEEDBACK_SUBMITTED");

  return res.status(201).json({ feedback, message: "Feedback submitted successfully" });
};

// UC-6.1 — Get my own feedback for an event
export const getMyFeedback: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  const eventId = req.params["id"] as string;

  const feedback = await prisma.eventFeedback.findUnique({
    where: { eventId_userId: { eventId, userId: req.user.id } },
  });

  return res.json({ feedback: feedback ?? null });
};

// UC-6.2 — Get all feedback for an event (officer/admin view)
export const getEventFeedback: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  const eventId = req.params["id"] as string;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, title: true, clubId: true },
  });
  if (!event) return res.status(404).json({ error: "Event not found" });

  const officer = await isClubOfficer(req.user.id, req.user.role, event.clubId);
  if (!officer) return res.status(403).json({ error: "Only club officers can view event feedback" });

  const feedbacks = await prisma.eventFeedback.findMany({
    where: { eventId },
    include: {
      user: { select: { id: true, name: true, avatarUrl: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const totalCount = feedbacks.length;
  const avgRating = totalCount > 0
    ? feedbacks.reduce((sum, f) => sum + f.rating, 0) / totalCount
    : 0;

  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  feedbacks.forEach((f) => {
    distribution[f.rating] = (distribution[f.rating] ?? 0) + 1;
  });

  // U7.3 — AI sentiment analysis on feedback comments
  let sentiment: {
    sentiment: "positive" | "neutral" | "negative";
    positivePercent: number;
    topThemes: string[];
    summary: string;
  } | null = null;

  const comments = feedbacks
    .filter((f) => f.comment && f.comment.trim().length > 0)
    .map((f) => f.comment as string);

  if (comments.length >= 2 && process.env.ANTHROPIC_API_KEY) {
    try {
      const joined = comments.join("\n---\n");
      const msg = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        messages: [
          {
            role: "user",
            content: `Analyze these event feedback comments and return ONLY valid JSON with no markdown or explanation:
{"sentiment":"positive","positivePercent":85,"topThemes":["Great speakers","Well organized","Fun atmosphere"],"summary":"Attendees found the event engaging and well-run."}

Allowed sentiment values: "positive", "neutral", "negative"
topThemes must be exactly 3 strings.

Comments:
${joined}`,
          },
        ],
      });

      const raw = (msg.content[0] as { type: "text"; text: string }).text.trim();
      sentiment = JSON.parse(raw);
    } catch {
      // Sentiment is best-effort — silently skip on any error
    }
  }

  return res.json({
    feedbacks,
    stats: {
      totalCount,
      avgRating: Math.round(avgRating * 10) / 10,
      distribution,
    },
    sentiment,
    event: { id: event.id, title: event.title },
  });
};
