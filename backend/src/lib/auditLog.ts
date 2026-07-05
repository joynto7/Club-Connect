import type { Prisma } from "@prisma/client";
import prisma from "../prisma.ts";

export async function log(
  actorId: string,
  action: string,
  targetType: string,
  targetId: string,
  details: Record<string, unknown> = {},
  ip?: string
) {
  await prisma.auditLog.create({
    data: {
      actorId,
      action,
      targetType,
      targetId,
      details: details as Prisma.InputJsonValue,
      ipAddress: ip ?? null,
    },
  });
}
