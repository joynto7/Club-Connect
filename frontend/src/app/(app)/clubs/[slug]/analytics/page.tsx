"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getClubAnalytics } from "@/lib/analytics";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import {
  ArrowLeft, Users, Calendar, CheckSquare, TrendingUp,
  Star, BarChart2, Clock,
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  APPROVED:         "#22c55e",
  PENDING_APPROVAL: "#f59e0b",
  REJECTED:         "#ef4444",
  CANCELLED:        "#9ca3af",
  DRAFT:            "#60a5fa",
};

const STATUS_LABELS: Record<string, string> = {
  APPROVED:         "Approved",
  PENDING_APPROVAL: "Pending",
  REJECTED:         "Rejected",
  CANCELLED:        "Cancelled",
  DRAFT:            "Draft",
};

function StatCard({ label, value, sub, icon }: { label: string; value: string | number; sub?: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl bg-[#EBA814]/10 flex items-center justify-center text-[#EBA814]">
          {icon}
        </div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-2xl font-black text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function ChartSkeleton() {
  return <div className="h-48 bg-gray-50 rounded-xl animate-pulse" />;
}

export default function ClubAnalyticsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { data, isLoading, error } = useQuery({
    queryKey: ["clubAnalytics", slug],
    queryFn: () => getClubAnalytics(slug),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="h-8 bg-gray-100 rounded-xl animate-pulse w-40" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <p className="text-gray-500 font-semibold">
          {(error as any)?.response?.data?.error ?? "Could not load analytics."}
        </p>
        <Link href={`/clubs/${slug}`} className="text-[#EBA814] text-sm hover:underline mt-2 block">
          ← Back to Club
        </Link>
      </div>
    );
  }

  const { club, overview, memberGrowth, eventsByStatus, topEvents, feedbackStats } = data;

  const statusChartData = Object.entries(eventsByStatus).map(([status, count]) => ({
    name: STATUS_LABELS[status] ?? status,
    count,
    color: STATUS_COLORS[status] ?? "#9ca3af",
  }));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back */}
      <Link href={`/clubs/${slug}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft size={14} /> Back to Club
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Club Analytics</h1>
        <p className="text-sm text-gray-500 mt-0.5">{club.name}</p>
      </div>

      {/* Overview stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard
          label="Members"
          value={overview.totalMembers}
          icon={<Users size={18} />}
        />
        <StatCard
          label="Total Events"
          value={overview.totalEvents}
          sub={`${overview.upcomingEvents} upcoming · ${overview.pastEvents} past`}
          icon={<Calendar size={18} />}
        />
        <StatCard
          label="Registrations"
          value={overview.totalRegistrations}
          icon={<CheckSquare size={18} />}
        />
        <StatCard
          label="Check-Ins"
          value={overview.totalCheckins}
          icon={<TrendingUp size={18} />}
        />
        <StatCard
          label="Attendance Rate"
          value={`${overview.avgAttendanceRate}%`}
          sub="Check-ins / registrations"
          icon={<BarChart2 size={18} />}
        />
        <StatCard
          label="Avg Feedback Rating"
          value={feedbackStats.avgRating != null ? `${feedbackStats.avgRating} ★` : "–"}
          sub={feedbackStats.totalFeedback > 0 ? `${feedbackStats.totalFeedback} responses` : "No responses yet"}
          icon={<Star size={18} />}
        />
      </div>

      {/* Member growth chart */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <h2 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
          <Users size={15} className="text-[#EBA814]" /> Member Growth (Last 6 Months)
        </h2>
        {mounted ? (
          memberGrowth.every((p) => p.count === 0) ? (
            <p className="text-center text-sm text-gray-400 py-10">No new members in the last 6 months.</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={memberGrowth} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9ca3af" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#9ca3af" }} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid #f3f4f6", fontSize: 12 }}
                  formatter={(v) => [v, "New Members"]}
                />
                <Bar dataKey="count" fill="#EBA814" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )
        ) : (
          <ChartSkeleton />
        )}
      </div>

      {/* Events by status */}
      {statusChartData.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
            <Calendar size={15} className="text-[#EBA814]" /> Events by Status
          </h2>
          {mounted ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={statusChartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9ca3af" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#9ca3af" }} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid #f3f4f6", fontSize: 12 }}
                  formatter={(v) => [v, "Events"]}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {statusChartData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ChartSkeleton />
          )}
        </div>
      )}

      {/* Top events */}
      {topEvents.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
            <TrendingUp size={15} className="text-[#EBA814]" /> Top Events by Attendance
          </h2>
          <div className="space-y-2">
            {topEvents.map((ev, idx) => (
              <Link
                key={ev.id}
                href={`/events/${ev.id}`}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#FAFAFA] transition-colors group"
              >
                <span className="w-6 text-center text-xs font-bold text-gray-400">#{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate group-hover:text-[#EBA814] transition-colors">
                    {ev.title}
                  </p>
                  <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                    <Clock size={10} />
                    {new Date(ev.startsAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                </div>
                <span className="text-sm font-bold text-[#EBA814] flex items-center gap-1">
                  <Users size={13} /> {ev.attendees}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
