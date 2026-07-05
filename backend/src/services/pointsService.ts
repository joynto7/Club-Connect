import prisma from "../prisma.ts";
import { checkAndUnlockAchievements } from "./achievementService.ts";

const POINT_VALUES = {
  EVENT_REGISTERED: 5,
  EVENT_ATTENDED:   20,
  FEEDBACK_SUBMITTED: 10,
  CLUB_JOINED:      15,
  CLUB_CREATED:     50,
  EVENT_CREATED:    30,
} as const;

function computeLevel(points: number): number {
  if (points < 50)  return 1;
  if (points < 150) return 2;
  if (points < 350) return 3;
  if (points < 700) return 4;
  if (points < 1200) return 5;
  return Math.floor(points / 250) + 1;
}

export async function awardPoints(userId: string, reason: keyof typeof POINT_VALUES) {
  const delta = POINT_VALUES[reason];

  const existing = await prisma.userPoints.findUnique({ where: { userId } });
  const newTotal = (existing?.points ?? 0) + delta;

  const upserted = await prisma.userPoints.upsert({
    where:  { userId },
    create: { userId, points: delta, level: computeLevel(delta) },
    update: { points: { increment: delta }, level: computeLevel(newTotal) },
  });

  await prisma.pointTransaction.create({
    data: { userPointsId: upserted.id, delta, reason },
  });

  void checkAndUnlockAchievements(userId);
}
