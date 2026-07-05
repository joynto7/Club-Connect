import type { RequestHandler } from "express";
import { z } from "zod";
import { Role, ClubRole, MembershipStatus } from "@prisma/client";
import Anthropic from "@anthropic-ai/sdk";
import prisma from "../prisma.ts";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function isOfficer(userId: string, userRole: string): Promise<boolean> {
  if (userRole === Role.UNIVERSITY_ADMIN || userRole === Role.SYSTEM_ADMIN) return true;
  const m = await prisma.clubMembership.findFirst({
    where: {
      userId,
      status: MembershipStatus.APPROVED,
      role: { in: [ClubRole.PRESIDENT, ClubRole.COORDINATOR] },
    },
  });
  return m !== null;
}

const descriptionSchema = z.object({
  title:    z.string().min(2).max(200),
  category: z.string().max(100).optional(),
  location: z.string().max(200).optional(),
});

// U7.1 — Streaming AI event description generator
export const generateEventDescription: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const officer = await isOfficer(req.user.id, req.user.role);
  if (!officer) return res.status(403).json({ error: "Only club officers can use AI assist" });

  const parsed = descriptionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.format() });

  const { title, category, location } = parsed.data;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const stream = await anthropic.messages.stream({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: `Write a compelling 2-paragraph event description for a university club event.
Title: ${title}${category ? `\nCategory: ${category}` : ""}${location ? `\nLocation: ${location}` : ""}
Be enthusiastic, informative, and student-friendly. Do not use placeholder text. No markdown formatting.`,
        },
      ],
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: "AI generation failed" })}\n\n`);
    res.end();
  }
};
