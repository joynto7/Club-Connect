"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getLeaderboard, levelLabel } from "@/lib/gamification";
import type { LeaderboardRow } from "@/lib/gamification";
import { Trophy, Crown, Medal, Star, Users2 } from "lucide-react";
import Image from "next/image";

function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Crown size={18} className="text-yellow-500" />;
  if (rank === 2) return <Medal size={18} className="text-gray-400" />;
  if (rank === 3) return <Medal size={18} className="text-amber-600" />;
  return <span className="text-sm font-bold text-gray-500 w-[18px] text-center">{rank}</span>;
}

function UserAvatar({ row }: { row: LeaderboardRow }) {
  const initials = row.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  if (row.avatarUrl) {
    return (
      <Image
        src={row.avatarUrl}
        alt={row.name}
        width={36}
        height={36}
        className="w-9 h-9 rounded-full object-cover ring-2 ring-[#EBA814]/20"
      />
    );
  }
  return (
    <div className="w-9 h-9 rounded-full bg-[#EBA814] flex items-center justify-center text-white text-xs font-bold ring-2 ring-[#EBA814]/20">
      {initials}
    </div>
  );
}

export default function LeaderboardPage() {
  const [semester, setSemester] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["leaderboard", semester],
    queryFn: () => getLeaderboard(semester),
  });

  const rows = data?.leaderboard ?? [];
  const myRank = data?.myRank;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy size={22} className="text-[#EBA814]" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Leaderboard</h1>
        </div>
        <div className="flex rounded-xl overflow-hidden border border-gray-200 dark:border-zinc-700 text-sm">
          <button
            onClick={() => setSemester(false)}
            className={`px-4 py-2 font-semibold transition-colors ${
              !semester
                ? "bg-[#EBA814] text-white"
                : "bg-white dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-700"
            }`}
          >
            All Time
          </button>
          <button
            onClick={() => setSemester(true)}
            className={`px-4 py-2 font-semibold transition-colors ${
              semester
                ? "bg-[#EBA814] text-white"
                : "bg-white dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-700"
            }`}
          >
            This Semester
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-gray-100 dark:divide-zinc-800">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse">
                <div className="w-5 h-5 bg-gray-200 dark:bg-zinc-700 rounded" />
                <div className="w-9 h-9 bg-gray-200 dark:bg-zinc-700 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 bg-gray-200 dark:bg-zinc-700 rounded w-32" />
                  <div className="h-3 bg-gray-100 dark:bg-zinc-800 rounded w-24" />
                </div>
                <div className="h-4 bg-gray-200 dark:bg-zinc-700 rounded w-14" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-gray-400">
            <Users2 size={40} className="opacity-30" />
            <p className="text-sm">No points recorded yet. Attend events to earn points!</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-zinc-800">
            {rows.map((row) => (
              <div
                key={row.userId}
                className={`flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors ${
                  row.rank <= 3 ? "bg-gradient-to-r from-[#EBA814]/5 to-transparent" : ""
                }`}
              >
                <div className="w-5 flex justify-center">
                  <RankIcon rank={row.rank} />
                </div>
                <UserAvatar row={row} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{row.name}</p>
                  <p className="text-xs text-gray-400 dark:text-zinc-500 truncate">
                    {row.department ?? "No department"} · Lv {row.level} {levelLabel(row.level)}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {row.badgeCount > 0 && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-[#EBA814]">
                      <Star size={12} /> {row.badgeCount}
                    </span>
                  )}
                  <span className="text-sm font-bold text-gray-900 dark:text-white whitespace-nowrap">
                    {row.points.toLocaleString()} pts
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {myRank !== null && myRank !== undefined && (
        <div className="bg-[#EBA814]/10 border border-[#EBA814]/30 rounded-2xl px-5 py-4 text-center">
          <p className="text-sm font-semibold text-[#EBA814]">
            You are ranked <strong>#{myRank}</strong> on the leaderboard
          </p>
        </div>
      )}
    </div>
  );
}
