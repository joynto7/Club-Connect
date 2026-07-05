"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Users, Users2, Calendar, Flag, Settings, BarChart2, ChevronRight, FileText } from "lucide-react";
import { getAdminStats } from "@/lib/admin";

const sections = [
  {
    href: "/admin/users",
    icon: <Users size={22} />,
    label: "User Management",
    description: "Search, suspend, activate, and change roles for all users.",
    color: "bg-blue-50 text-blue-600",
  },
  {
    href: "/admin/clubs",
    icon: <Users2 size={22} />,
    label: "Club Oversight",
    description: "View all clubs across every status. Approve or reject from the club page.",
    color: "bg-purple-50 text-purple-600",
  },
  {
    href: "/admin/events",
    icon: <Calendar size={22} />,
    label: "Event Oversight",
    description: "Browse every event regardless of approval status.",
    color: "bg-green-50 text-green-600",
  },
  {
    href: "/admin/content-reports",
    icon: <Flag size={22} />,
    label: "Content Moderation",
    description: "Review and action user-submitted content reports.",
    color: "bg-red-50 text-red-600",
  },
  {
    href: "/admin/settings",
    icon: <Settings size={22} />,
    label: "System Settings",
    description: "Configure platform-wide key/value settings.",
    color: "bg-yellow-50 text-yellow-600",
  },
  {
    href: "/analytics",
    icon: <BarChart2 size={22} />,
    label: "Analytics",
    description: "System-wide analytics — user growth, event trends, top clubs.",
    color: "bg-orange-50 text-orange-600",
  },
  {
    href: "/admin/reports",
    icon: <FileText size={22} />,
    label: "Reports & Export",
    description: "Generate and download CSV or PDF reports for members, events, and system stats.",
    color: "bg-teal-50 text-teal-600",
  },
];

export default function AdminPanelPage() {
  const { data } = useQuery({ queryKey: ["admin-stats"], queryFn: getAdminStats });

  const counts = data?.counts;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
        <p className="text-sm text-gray-500 mt-1">Manage users, clubs, events, and platform settings.</p>
      </div>

      {/* Quick stats */}
      {counts && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Users",   value: counts.totalUsers,      color: "text-blue-600" },
            { label: "Active Clubs",  value: counts.totalActiveClubs, color: "text-purple-600" },
            { label: "Total Events",  value: counts.totalEvents,      color: "text-green-600" },
            {
              label: "Pending Actions",
              value: counts.pendingClubs + counts.pendingEvents + counts.pendingVenueBookings + counts.pendingResourceBookings,
              color: "text-red-500",
            },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-5">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Navigation cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="bg-white rounded-2xl border border-gray-100 p-5 hover:border-[#EBA814]/40 hover:shadow-sm transition-all group"
          >
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-xl ${s.color} flex-shrink-0`}>{s.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-gray-900 text-sm">{s.label}</p>
                  <ChevronRight size={16} className="text-gray-300 group-hover:text-[#EBA814] transition-colors" />
                </div>
                <p className="text-xs text-gray-500 mt-1">{s.description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
