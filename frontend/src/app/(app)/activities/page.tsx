"use client";

import { useQuery } from "@tanstack/react-query";
import { getMyHistory } from "@/lib/auth";
import Link from "next/link";
import {
  Calendar,
  MapPin,
  Clock,
  Users2,
  CheckCircle2,
  XCircle,
  Hourglass,
  ArrowRight,
  Trophy,
} from "lucide-react";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
    REGISTERED: { label: "Registered",  icon: <CheckCircle2 size={12} />, cls: "bg-green-50 text-green-700"  },
    CANCELLED:  { label: "Cancelled",   icon: <XCircle size={12} />,     cls: "bg-red-50 text-red-600"       },
    ATTENDED:   { label: "Attended",    icon: <Trophy size={12} />,      cls: "bg-blue-50 text-blue-700"     },
  };
  const cfg = map[status] ?? { label: status, icon: <Hourglass size={12} />, cls: "bg-gray-100 text-gray-600" };
  return (
    <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.cls}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function EventCard({ item }: { item: any }) {
  return (
    <div className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
      <div className="w-11 h-11 rounded-xl bg-[#EBA814]/10 flex items-center justify-center text-[#EBA814] flex-shrink-0">
        <Calendar size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-900 truncate">{item.event.title}</p>
        <p className="text-xs text-gray-500 mt-0.5 font-medium">{item.event.club.name}</p>
        <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
          <span className="flex items-center gap-1"><Clock size={11} />{formatDate(item.event.startsAt)}</span>
          <span className="flex items-center gap-1"><MapPin size={11} />{item.event.location}</span>
        </div>
      </div>
      <div className="flex-shrink-0">
        <StatusBadge status={item.status} />
      </div>
    </div>
  );
}

function Section({ title, icon, count, children, emptyMsg }: {
  title: string; icon: React.ReactNode; count: number;
  children: React.ReactNode; emptyMsg: string;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <div className="flex items-center gap-2 mb-5">
        <span className="text-[#EBA814]">{icon}</span>
        <h2 className="text-base font-bold text-gray-900">{title}</h2>
        <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{count}</span>
      </div>
      {count === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-400 text-sm">{emptyMsg}</p>
        </div>
      ) : (
        <div className="space-y-3">{children}</div>
      )}
    </div>
  );
}

export default function ActivitiesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["myHistory"],
    queryFn: getMyHistory,
  });

  const upcoming = data?.upcomingEvents ?? [];
  const past     = data?.pastEvents     ?? [];
  const clubs    = data?.clubsCreated   ?? [];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Activities</h1>
        <p className="text-sm text-gray-500 mt-1">Your clubs, events, and participation history</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Upcoming */}
          <Section
            title="Upcoming Events"
            icon={<Clock size={18} />}
            count={upcoming.length}
            emptyMsg="You have no upcoming event registrations. Browse events to register."
          >
            {upcoming.map((item) => <EventCard key={item.registrationId} item={item} />)}
          </Section>

          {/* Past */}
          <Section
            title="Past Events Attended"
            icon={<CheckCircle2 size={18} />}
            count={past.length}
            emptyMsg="No past event history yet."
          >
            {past.map((item) => <EventCard key={item.registrationId} item={item} />)}
          </Section>

          {/* Clubs created */}
          <Section
            title="Clubs Created"
            icon={<Users2 size={18} />}
            count={clubs.length}
            emptyMsg="You haven't created any clubs yet."
          >
            {clubs.map((club) => (
              <div key={club.id} className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-11 h-11 rounded-xl bg-purple-50 flex items-center justify-center text-purple-500 flex-shrink-0">
                  <Users2 size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900">{club.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Created {new Date(club.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                  </p>
                </div>
                <Link
                  href={`/clubs/${club.slug}`}
                  className="flex-shrink-0 flex items-center gap-1 text-xs font-semibold text-[#EBA814] hover:underline"
                >
                  View <ArrowRight size={12} />
                </Link>
              </div>
            ))}
          </Section>
        </div>
      )}
    </div>
  );
}
