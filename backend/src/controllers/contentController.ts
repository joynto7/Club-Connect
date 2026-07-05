import type { RequestHandler } from "express";
import { z } from "zod";
import prisma from "../prisma.ts";

const VALID_TARGET_TYPES = ["EVENT", "CLUB", "ANNOUNCEMENT", "USER"] as const;

const reportSchema = z.object({
  targetType:  z.enum(VALID_TARGET_TYPES),
  targetId:    z.string().uuid("Invalid target ID"),
  reason:      z.string().min(3, "Reason is required"),
  description: z.string().optional(),
});

// UC-11.3 — Submit a content report
export const submitContentReport: RequestHandler = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const parsed = reportSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.format() });

  const { targetType, targetId, reason, description } = parsed.data;

  // Prevent reporting yourself
  if (targetType === "USER" && targetId === req.user.id) {
    return res.status(400).json({ error: "Cannot report yourself" });
  }

  const report = await prisma.contentReport.create({
    data: {
      reporterId:  req.user.id,
      targetType,
      targetId,
      reason,
      description: description ?? null,
    },
    select: { id: true, targetType: true, targetId: true, reason: true, status: true, createdAt: true },
  });

  return res.status(201).json({ report, message: "Report submitted — our team will review it shortly" });
};
