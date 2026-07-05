import type { RequestHandler } from "express";
import { z } from "zod";
import prisma from "../prisma.ts";

const INTEGRATION_EVENTS = ["NEW_EVENT", "NEW_MEMBER", "ANNOUNCEMENT"] as const;

const upsertSchema = z.object({
  type: z.enum(["SLACK", "DISCORD"]),
  webhookUrl: z.string().url("Must be a valid URL"),
  events: z.array(z.enum(INTEGRATION_EVENTS)).min(1, "Select at least one event"),
});

async function isClubOfficer(clubId: string, userId: string): Promise<boolean> {
  const membership = await prisma.clubMembership.findUnique({
    where: { clubId_userId: { clubId, userId } },
  });
  return (
    membership?.status === "APPROVED" &&
    (membership.role === "COORDINATOR" || membership.role === "PRESIDENT")
  );
}

export const listIntegrations: RequestHandler = async (req, res) => {
  const clubId = req.params["id"] as string;
  const user = req.user!;

  const officer = await isClubOfficer(clubId, user.id);
  const isAdmin = user.role === "UNIVERSITY_ADMIN" || user.role === "SYSTEM_ADMIN";
  if (!officer && !isAdmin) {
    return res.status(403).json({ error: "Officer access required" });
  }

  const integrations = await prisma.clubIntegration.findMany({
    where: { clubId },
    orderBy: { createdAt: "asc" },
  });

  res.json(integrations);
};

export const upsertIntegration: RequestHandler = async (req, res) => {
  const clubId = req.params["id"] as string;
  const user = req.user!;

  const officer = await isClubOfficer(clubId, user.id);
  const isAdmin = user.role === "UNIVERSITY_ADMIN" || user.role === "SYSTEM_ADMIN";
  if (!officer && !isAdmin) {
    return res.status(403).json({ error: "Officer access required" });
  }

  const parse = upsertSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ errors: parse.error.format() });
  }

  const { type, webhookUrl, events } = parse.data;

  const integration = await prisma.clubIntegration.upsert({
    where: { clubId_type: { clubId, type } },
    create: { clubId, type, webhookUrl, events },
    update: { webhookUrl, events },
  });

  res.json(integration);
};

export const deleteIntegration: RequestHandler = async (req, res) => {
  const clubId = req.params["id"] as string;
  const integrationId = req.params["integrationId"] as string;
  const user = req.user!;

  const officer = await isClubOfficer(clubId, user.id);
  const isAdmin = user.role === "UNIVERSITY_ADMIN" || user.role === "SYSTEM_ADMIN";
  if (!officer && !isAdmin) {
    return res.status(403).json({ error: "Officer access required" });
  }

  const existing = await prisma.clubIntegration.findFirst({
    where: { id: integrationId, clubId },
  });
  if (!existing) {
    return res.status(404).json({ error: "Integration not found" });
  }

  await prisma.clubIntegration.delete({ where: { id: integrationId } });
  res.json({ message: "Integration deleted" });
};
