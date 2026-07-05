import { api } from "./axios";
// gamification: points, levels, achievements, leaderboard, certificates
export interface PointTransaction {
  id: string;
  delta: number;
  reason: string;
  createdAt: string;
}

export interface UserPointsData {
  points: number;
  level: number;
  transactions: PointTransaction[];
}

export interface Achievement {
  slug: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt: string | null;
}

export interface LeaderboardRow {
  rank: number;
  userId: string;
  name: string;
  avatarUrl: string | null;
  department: string | null;
  points: number;
  level: number;
  badgeCount: number;
}

export interface LeaderboardData {
  leaderboard: LeaderboardRow[];
  myRank: number | null;
}

export async function getMyPoints(): Promise<UserPointsData> {
  const { data } = await api.get<UserPointsData>("/users/me/points");
  return data;
}

export async function getMyAchievements(): Promise<{ achievements: Achievement[] }> {
  const { data } = await api.get<{ achievements: Achievement[] }>("/users/me/achievements");
  return data;
}

export async function getLeaderboard(semester = false): Promise<LeaderboardData> {
  const url = semester ? "/leaderboard/semester" : "/leaderboard";
  const { data } = await api.get<LeaderboardData>(url);
  return data;
}

export async function downloadCertificate(eventId: string, userId: string): Promise<void> {
  const { data } = await api.post(
    "/reports/certificate",
    { eventId, userId },
    { responseType: "blob" }
  );
  const url = URL.createObjectURL(data as Blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "Certificate.pdf";
  a.click();
  URL.revokeObjectURL(url);
}

export function levelLabel(level: number): string {
  const labels: Record<number, string> = {
    1: "Newcomer",
    2: "Explorer",
    3: "Regular",
    4: "Enthusiast",
    5: "Champion",
  };
  return labels[level] ?? `Level ${level}`;
}

export function pointsToNextLevel(level: number, currentPoints: number): { next: number; progress: number } {
  const thresholds = [0, 50, 150, 350, 700, 1200];
  const next = level < thresholds.length ? thresholds[level]! : (level - 1) * 250 + 250;
  const prev = level <= thresholds.length ? (thresholds[level - 1] ?? 0) : (level - 2) * 250 + 250;
  const progress = Math.min(100, Math.round(((currentPoints - prev) / (next - prev)) * 100));
  return { next, progress };
}
