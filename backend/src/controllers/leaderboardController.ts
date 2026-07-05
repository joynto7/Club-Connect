import type { RequestHandler } from "express";
import prisma from "../prisma.ts";

const SEMESTER_START = new Date("2026-01-01");

async function fetchLeaderboard(where: object, currentUserId?: string) {
  const top20 = await prisma.userPoints.findMany({
    where,
    orderBy: { points: "desc" },
    take: 20,
    include: {
      user: { select: { id: true, name: true, avatarUrl: true, department: true } },
      _count: { select: { transactions: true } },
    },
  });

  const rows = await Promise.all(
    top20.map(async (up, idx) => {
      const badgeCount = await prisma.userAchievement.count({ where: { userId: up.userId } });
      return {
        rank:        idx + 1,
        userId:      up.userId,
        name:        up.user.name,
        avatarUrl:   up.user.avatarUrl ?? null,
        department:  up.user.department ?? null,
        points:      up.points,
        level:       up.level,
        badgeCount,
      };
    })
  );

  let myRank: number | null = null;
  if (currentUserId && !rows.find((r) => r.userId === currentUserId)) {
    const myPoints = await prisma.userPoints.findUnique({ where: { userId: currentUserId } });
    if (myPoints) {
      myRank = await prisma.userPoints.count({
        where: { ...where, points: { gt: myPoints.points } },
      }) + 1;
    }
  }

  return { rows, myRank };
}

export const getLeaderboard: RequestHandler = async (req, res) => {
  const { rows, myRank } = await fetchLeaderboard({}, req.user?.id);
  return res.json({ leaderboard: rows, myRank });
};

export const getSemesterLeaderboard: RequestHandler = async (req, res) => {
  const userIdsWithActivity = await prisma.pointTransaction.groupBy({
    by: ["userPointsId"],
    where: { createdAt: { gte: SEMESTER_START } },
  });
  const upIds = userIdsWithActivity.map((r) => r.userPointsId);

  const { rows, myRank } = await fetchLeaderboard({ id: { in: upIds } }, req.user?.id);
  return res.json({ leaderboard: rows, myRank });
};
