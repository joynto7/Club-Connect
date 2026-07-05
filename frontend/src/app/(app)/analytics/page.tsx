"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getAdminAnalytics } from "@/lib/analytics";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import {
  Users, Building2, Calendar, CheckSquare, Star, MessageSquare,
  TrendingUp, Clock,
} from "lucide-react";

const CATEGORY_COLORS = [
  "#EBA814", "#3b82f6", "#22c55e", "#ef4444", "#8b5cf6",
  "#f97316", "#06b6d4", "#ec4899",
];

function StatCard({
  label, value, sub, icon, highlight = false,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-2xl shadow-sm p-5 ${highlight ? "bg-[#EBA814] text-white" : "bg-white"}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${highlight ? "bg-white/20" : "bg-[#EBA814]/10 text-[#EBA814]"}`}>
          {icon}
        </div>
        <p className={`text-xs font-bold uppercase tracking-wide ${highlight ? "text-white/70" : "text-gray-500"}`}>{label}</p>
      </div>
      <p className={`text-2xl font-black ${highlight ? "text-white" : "text-gray-900"}`}>{value}</p>
      {sub && <p className={`text-xs mt-0.5 ${highlight ? "text-white/60" : "text-gray-400"}`}>{sub}</p>}
    </div>
  );
}

function ChartSkeleton({ height = 200 }: { height?: number }) {
  return <div className={`bg-gray-50 rounded-xl animate-pulse`} style={{ height }} />;
}

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <h2 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
        <span className="text-[#EBA814]">{icon}</span> {title}
      </h2>
      {children}
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { data, isLoading, error } = useQuery({
    queryKey: ["adminAnalytics"],
    queryFn: getAdminAnalytics,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="h-8 bg-gray-100 rounded-xl animate-pulse w-48" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
          <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-5xl mx-auto text-center py-20">
        <p className="text-gray-500 font-semibold">
          {(error as any)?.response?.data?.error ?? "Could not load analytics. Admin access required."}
        </p>
      </div>
    );
  }

  const {
    overview, userGrowth, eventGrowth,
    eventsByCategory, clubsByCategory,
    topClubs, topEvents,
  } = data;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Platform Analytics</h1>
        <p className="text-sm text-gray-400 mt-0.5">System-wide overview and trends</p>
      </div>

      {/* Overview stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard label="Total Users"       value={overview.totalUsers}    icon={<Users size={18} />} />
        <StatCard label="Active Clubs"      value={overview.totalClubs}    icon={<Building2 size={18} />} />
        <StatCard label="Approved Events"   value={overview.totalEvents}   icon={<Calendar size={18} />} />
        <StatCard label="Total Attendance"  value={overview.totalAttendance} icon={<CheckSquare size={18} />} />
        <StatCard
          label="Avg Feedback Rating"
          value={overview.avgRating != null ? `${overview.avgRating} ★` : "–"}
          sub={`${overview.totalFeedback} responses`}
          icon={<Star size={18} />}
          highlight
        />
        <StatCard
          label="Total Feedback"
          value={overview.totalFeedback}
          icon={<MessageSquare size={18} />}
        />
      </div>

      {/* Growth charts side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SectionCard title="User Registrations (Last 6 Months)" icon={<Users size={15} />}>
          {mounted ? (
            userGrowth.every((p) => p.count === 0) ? (
              <p className="text-center text-sm text-gray-400 py-8">No data.</p>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={userGrowth} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#9ca3af" }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#9ca3af" }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 10, border: "1px solid #f3f4f6", fontSize: 11 }}
                    formatter={(v) => [v, "New Users"]}
                  />
                  <Bar dataKey="count" fill="#EBA814" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )
          ) : (
            <ChartSkeleton height={180} />
          )}
        </SectionCard>

        <SectionCard title="Events Approved (Last 6 Months)" icon={<Calendar size={15} />}>
          {mounted ? (
            eventGrowth.every((p) => p.count === 0) ? (
              <p className="text-center text-sm text-gray-400 py-8">No data.</p>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={eventGrowth} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#9ca3af" }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#9ca3af" }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 10, border: "1px solid #f3f4f6", fontSize: 11 }}
                    formatter={(v) => [v, "Events"]}
                  />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )
          ) : (
            <ChartSkeleton height={180} />
          )}
        </SectionCard>
      </div>

      {/* Category breakdowns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SectionCard title="Events by Category" icon={<Calendar size={15} />}>
          {mounted && eventsByCategory.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={eventsByCategory} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: "#9ca3af" }} />
                <YAxis dataKey="category" type="category" tick={{ fontSize: 10, fill: "#6b7280" }} width={80} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: "1px solid #f3f4f6", fontSize: 11 }}
                  formatter={(v) => [v, "Events"]}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {eventsByCategory.map((_, idx) => (
                    <Cell key={idx} fill={CATEGORY_COLORS[idx % CATEGORY_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : mounted && eventsByCategory.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">No events yet.</p>
          ) : (
            <ChartSkeleton height={180} />
          )}
        </SectionCard>

        <SectionCard title="Clubs by Category" icon={<Building2 size={15} />}>
          {mounted && clubsByCategory.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={clubsByCategory} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: "#9ca3af" }} />
                <YAxis dataKey="category" type="category" tick={{ fontSize: 10, fill: "#6b7280" }} width={80} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: "1px solid #f3f4f6", fontSize: 11 }}
                  formatter={(v) => [v, "Clubs"]}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {clubsByCategory.map((_, idx) => (
                    <Cell key={idx} fill={CATEGORY_COLORS[idx % CATEGORY_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : mounted && clubsByCategory.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">No clubs yet.</p>
          ) : (
            <ChartSkeleton height={180} />
          )}
        </SectionCard>
      </div>

      {/* Top clubs + top events side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SectionCard title="Top Clubs by Members" icon={<TrendingUp size={15} />}>
          {topClubs.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-4">No clubs yet.</p>
          ) : (
            <div className="space-y-2">
              {topClubs.map((club, idx) => (
                <Link
                  key={club.id}
                  href={`/clubs/${club.slug}`}
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-[#FAFAFA] transition-colors group"
                >
                  <span className="w-5 text-xs font-bold text-gray-400">#{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate group-hover:text-[#EBA814] transition-colors">
                      {club.name}
                    </p>
                    <p className="text-xs text-gray-400">{club.category}</p>
                  </div>
                  <span className="text-sm font-bold text-[#EBA814] flex items-center gap-1">
                    <Users size={13} /> {club.memberCount}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Top Events by Attendance" icon={<TrendingUp size={15} />}>
          {topEvents.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-4">No events yet.</p>
          ) : (
            <div className="space-y-2">
              {topEvents.map((ev, idx) => (
                <Link
                  key={ev.id}
                  href={`/events/${ev.id}`}
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-[#FAFAFA] transition-colors group"
                >
                  <span className="w-5 text-xs font-bold text-gray-400">#{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate group-hover:text-[#EBA814] transition-colors">
                      {ev.title}
                    </p>
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <Clock size={10} /> {ev.club.name} ·{" "}
                      {new Date(ev.startsAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-[#EBA814] flex items-center gap-1">
                    <Users size={13} /> {ev.attendees}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
