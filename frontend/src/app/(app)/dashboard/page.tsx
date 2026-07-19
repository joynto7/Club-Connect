"use client";

import { useEffect, useState } from "react";
import { motion, type Variants } from "framer-motion";
import Link from "next/link";
import { toast } from "sonner";
import { getAuthState } from "@/lib/tokenStorage";
import { getMyHistory, getMyClubs } from "@/lib/auth";
import { getAdminStats, getSystemMonitor, type SystemMonitorStats } from "@/lib/admin";
import { approveEvent, rejectEvent } from "@/lib/events";
import { approveClub, rejectClub } from "@/lib/clubs";
import { useSocket } from "@/hooks/useSocket";
import { getAnnouncements, priorityColors, type Announcement } from "@/lib/notifications";
import {
  approveVenueBooking, rejectVenueBooking,
  approveResourceBooking, rejectResourceBooking,
} from "@/lib/venues";
import { getRecommendations, type SearchEvent } from "@/lib/search";
import type { UserInfo } from "@/lib/tokenStorage";
import type { HistoryEvent, MyClub } from "@/lib/auth";
import type { AdminStats } from "@/lib/admin";
import {
  Calendar, Users2, History, ArrowRight, Clock, MapPin,
  Users, Building2, Activity, AlertCircle, CheckCircle,
  UserCheck, Package, Megaphone, Trophy, Star,
  ShieldOff, UserX, ShieldCheck,
} from "lucide-react";
import AnimatedCounter from "@/components/shared/AnimatedCounter";
import EmptyState from "@/components/shared/EmptyState";
import { getMyPoints, levelLabel, pointsToNextLevel } from "@/lib/gamification";

// ── Shared components ────────────────────────────────────────────────────────

const roleLabel: Record<string, { label: string; color: string }> = {
  STUDENT:          { label: "Student",          color: "bg-blue-100 text-blue-700"     },
  CLUB_OFFICER:     { label: "Club Officer",     color: "bg-purple-100 text-purple-700" },
  UNIVERSITY_ADMIN: { label: "University Admin", color: "bg-green-100 text-green-700"   },
  SYSTEM_ADMIN:     { label: "System Admin",     color: "bg-red-100 text-red-700"       },
};

function WelcomeHeader({ user }: { user: UserInfo }) {
  const badge = roleLabel[user.role];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <p className="text-gray-500 text-sm font-medium">{greeting} 👋</p>
        <h1 className="text-2xl font-bold text-gray-900 mt-0.5">
          Welcome back, {user.name?.split(" ")[0] ?? "..."}!
        </h1>
      </div>
      <span className={`self-start sm:self-auto px-3 py-1.5 rounded-full text-xs font-bold ${badge?.color ?? ""}`}>
        {badge?.label ?? user.role}
      </span>
    </div>
  );
}

const accentClasses: Record<string, string> = {
  amber:  "bg-[#EBA814]/10 text-[#EBA814]",
  purple: "bg-purple-50 text-purple-500",
  green:  "bg-green-50 text-green-600",
  red:    "bg-red-50 text-red-500",
  blue:   "bg-blue-50 text-blue-500",
};

function StatCard({ icon, label, value, href, accent = "amber" }: {
  icon: React.ReactNode; label: string; value: number | string; href: string; accent?: string;
}) {
  return (
    <Link
      href={href}
      className="bg-white rounded-2xl p-6 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow group"
    >
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${accentClasses[accent] ?? accentClasses.amber}`}>
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-2xl font-bold text-gray-900">
          {typeof value === "number" ? <AnimatedCounter value={value} /> : value}
        </p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
      <ArrowRight size={16} className="text-gray-300 group-hover:text-[#EBA814] transition-colors" />
    </Link>
  );
}

function EventRow({ item }: { item: HistoryEvent }) {
  return (
    <div className="flex items-center gap-4 p-4 bg-[#FAFAFA] rounded-xl border border-gray-100">
      <div className="w-10 h-10 rounded-xl bg-[#EBA814]/10 flex items-center justify-center text-[#EBA814] flex-shrink-0">
        <Calendar size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{item.event.title}</p>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <Clock size={11} />
            {new Date(item.event.startsAt).toLocaleDateString("en-US", {
              month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
            })}
          </span>
          <span className="flex items-center gap-1"><MapPin size={11} />{item.event.location}</span>
        </div>
      </div>
      <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full shrink-0">
        {item.status}
      </span>
    </div>
  );
}

const skeletonRows = (n: number) =>
  Array.from({ length: n }, (_, i) => (
    <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
  ));

// ── Shared Announcements Feed ────────────────────────────────────────────────

function AnnouncementsFeed() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAnnouncements()
      .then((d) => setAnnouncements(d.announcements.slice(0, 3)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (!loading && announcements.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
          <Megaphone size={16} className="text-[#EBA814]" />
          Announcements
        </h2>
        <Link href="/announcements" className="text-xs font-semibold text-[#EBA814] hover:underline flex items-center gap-1">
          View all <ArrowRight size={12} />
        </Link>
      </div>
      {loading ? (
        <div className="space-y-3">{skeletonRows(2)}</div>
      ) : (
        <div className="space-y-3">
          {announcements.map((ann) => (
            <div key={ann.id} className="p-4 bg-[#FAFAFA] rounded-xl border border-gray-100">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${priorityColors[ann.priority] ?? priorityColors.NORMAL}`}>
                  {ann.priority}
                </span>
                {ann.club && (
                  <span className="text-xs text-purple-600 font-medium">{ann.club.name}</span>
                )}
              </div>
              <p className="text-sm font-semibold text-gray-900">{ann.title}</p>
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{ann.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Student Dashboard ────────────────────────────────────────────────────────

function StudentDashboard({ user }: { user: UserInfo }) {
  const [history, setHistory] = useState<{
    upcomingEvents: HistoryEvent[];
    pastEvents: HistoryEvent[];
    clubsCreated: unknown[];
  }>({ upcomingEvents: [], pastEvents: [], clubsCreated: [] });
  const [myClubs, setMyClubs] = useState<MyClub[]>([]);
  const [recommended, setRecommended] = useState<SearchEvent[]>([]);
  const [isPersonalized, setIsPersonalized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pts, setPts] = useState(0);
  const [lvl, setLvl] = useState(1);

  useEffect(() => {
    Promise.all([getMyHistory(), getMyClubs(), getRecommendations(), getMyPoints()])
      .then(([h, c, r, p]) => {
        setHistory(h);
        setMyClubs(c.clubs);
        setRecommended(r.events);
        setIsPersonalized(r.isPersonalized);
        setPts(p.points);
        setLvl(p.level);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <WelcomeHeader user={user} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: <Calendar size={22} />, label: "Upcoming Events",  value: loading ? "—" : history.upcomingEvents.length, href: "/activities", accent: "amber",  delay: 0.05 },
          { icon: <Users2 size={22} />,   label: "Clubs Joined",     value: loading ? "—" : myClubs.length,                href: "/clubs",       accent: "purple", delay: 0.1  },
          { icon: <History size={22} />,  label: "Events Attended",  value: loading ? "—" : history.pastEvents.length,     href: "/activities", accent: "blue",   delay: 0.15 },
        ].map((s) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: s.delay }}
          >
            <StatCard icon={s.icon} label={s.label} value={s.value} href={s.href} accent={s.accent} />
          </motion.div>
        ))}
      </div>

      {/* Points & streak widget */}
      {!loading && pts > 0 && (() => {
        const { next, progress } = pointsToNextLevel(lvl, pts);
        return (
          <Link href="/leaderboard" className="block bg-gradient-to-r from-[#EBA814]/10 to-[#F5C842]/5 rounded-2xl p-5 border border-[#EBA814]/20 hover:border-[#EBA814]/40 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Trophy size={18} className="text-[#EBA814]" />
                <span className="text-sm font-bold text-gray-900">Level {lvl} · {levelLabel(lvl)}</span>
              </div>
              <span className="flex items-center gap-1 text-sm font-bold text-[#EBA814]">
                <Star size={14} /> {pts} pts
              </span>
            </div>
            <div className="h-2.5 bg-white/60 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#EBA814] to-[#F5C842] rounded-full transition-all duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1.5">{next - pts} pts to Level {lvl + 1} — View Leaderboard</p>
          </Link>
        );
      })()}

      <AnnouncementsFeed />

      {/* Upcoming registrations */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-gray-900">Upcoming Registrations</h2>
          <Link href="/activities" className="text-xs font-semibold text-[#EBA814] hover:underline flex items-center gap-1">
            View all <ArrowRight size={12} />
          </Link>
        </div>
        {loading ? (
          <div className="space-y-3">{skeletonRows(3)}</div>
        ) : history.upcomingEvents.length === 0 ? (
          <div className="text-center py-8">
            <Calendar size={32} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm font-medium">No upcoming events</p>
            <Link href="/events" className="mt-3 inline-flex items-center gap-1 text-sm text-[#EBA814] font-semibold hover:underline">
              Browse events <ArrowRight size={13} />
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {history.upcomingEvents.slice(0, 3).map((item) => (
              <EventRow key={item.registrationId} item={item} />
            ))}
          </div>
        )}
      </div>

      {/* My clubs */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-gray-900">My Clubs</h2>
          <Link href="/clubs" className="text-xs font-semibold text-[#EBA814] hover:underline flex items-center gap-1">
            Browse all <ArrowRight size={12} />
          </Link>
        </div>
        {loading ? (
          <div className="space-y-3">{skeletonRows(2)}</div>
        ) : myClubs.length === 0 ? (
          <div className="text-center py-8">
            <Users2 size={32} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm font-medium">You haven&apos;t joined any clubs yet</p>
            <Link href="/clubs" className="mt-3 inline-flex items-center gap-1 text-sm text-[#EBA814] font-semibold hover:underline">
              Explore clubs <ArrowRight size={13} />
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {myClubs.slice(0, 4).map((club) => (
              <Link
                key={club.id}
                href={`/clubs/${club.slug}`}
                className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center text-purple-500 flex-shrink-0">
                  <Users2 size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{club.name}</p>
                  <p className="text-xs text-gray-400">{club.category} · {club.memberCount} members</p>
                </div>
                <span className="text-xs text-gray-400 capitalize">{club.role.toLowerCase()}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Recommended / upcoming events */}
      {!loading && recommended.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-bold text-gray-900">
                {isPersonalized ? "Recommended for You" : "Upcoming Events"}
              </h2>
              {isPersonalized && (
                <p className="text-xs text-gray-400 mt-0.5">Based on your interests</p>
              )}
            </div>
            <Link href="/events" className="text-xs font-semibold text-[#EBA814] hover:underline flex items-center gap-1">
              See all <ArrowRight size={12} />
            </Link>
          </div>
          <div className="space-y-2">
            {recommended.map((ev) => (
              <Link
                key={ev.id}
                href={`/events/${ev.id}`}
                className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <div className="w-9 h-9 rounded-lg bg-[#EBA814]/10 flex items-center justify-center text-[#EBA814] flex-shrink-0">
                  <Calendar size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{ev.title}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(ev.startsAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {ev.club.name}
                  </p>
                </div>
                <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full shrink-0">
                  {ev.category}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/profile" className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex items-center gap-4 group">
          <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-500">
            <Users2 size={20} />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">Complete Your Profile</p>
            <p className="text-xs text-gray-500 mt-0.5">Add department, interests & more</p>
          </div>
          <ArrowRight size={16} className="ml-auto text-gray-300 group-hover:text-gray-500 transition-colors" />
        </Link>
        <Link href="/events" className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex items-center gap-4 group">
          <div className="w-10 h-10 rounded-xl bg-[#EBA814]/10 flex items-center justify-center text-[#EBA814]">
            <Calendar size={20} />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">Discover Events</p>
            <p className="text-xs text-gray-500 mt-0.5">Find and RSVP for events</p>
          </div>
          <ArrowRight size={16} className="ml-auto text-gray-300 group-hover:text-gray-500 transition-colors" />
        </Link>
      </div>
    </div>
  );
}

// ── Officer Dashboard ────────────────────────────────────────────────────────

function OfficerDashboard({ user }: { user: UserInfo }) {
  const [myClubs, setMyClubs] = useState<MyClub[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyClubs()
      .then((data) => setMyClubs(data.clubs))
      .finally(() => setLoading(false));
  }, []);

  const officerClubs = myClubs.filter(
    (c) => c.role === "PRESIDENT" || c.role === "COORDINATOR"
  );
  const totalPending = officerClubs.reduce((sum, c) => sum + c.pendingCount, 0);
  const totalMembers = myClubs.reduce((sum, c) => sum + c.memberCount, 0);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <WelcomeHeader user={user} />

      <motion.div
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
      >
        {([
          { icon: <Building2 size={22} />, label: "My Clubs",         value: loading ? "—" : officerClubs.length, href: "/clubs",  accent: "purple" },
          { icon: <Users size={22} />,     label: "Pending Requests", value: loading ? "—" : totalPending,        href: "/clubs",  accent: totalPending > 0 ? "red" : "green" },
          { icon: <Users2 size={22} />,    label: "Total Members",    value: loading ? "—" : totalMembers,        href: "/clubs",  accent: "blue" },
        ] as const).map((s) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28 }}
          >
            <StatCard {...s} />
          </motion.div>
        ))}
      </motion.div>

      <AnnouncementsFeed />

      {/* My clubs */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-gray-900">My Clubs</h2>
          <Link href="/clubs/new" className="text-xs font-semibold text-[#EBA814] hover:underline">
            + New Club
          </Link>
        </div>
        {loading ? (
          <div className="space-y-3">{skeletonRows(2)}</div>
        ) : myClubs.length === 0 ? (
          <div className="text-center py-8">
            <Building2 size={32} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">You haven&apos;t created or joined any clubs as an officer yet.</p>
            <Link href="/clubs/new" className="mt-3 inline-flex items-center gap-1 text-sm text-[#EBA814] font-semibold hover:underline">
              Create a club <ArrowRight size={13} />
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {myClubs.map((club) => (
              <div key={club.id} className="flex items-center gap-4 p-4 bg-[#FAFAFA] rounded-xl border border-gray-100">
                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-500 flex-shrink-0">
                  <Building2 size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{club.name}</p>
                  <p className="text-xs text-gray-400">
                    {club.category} · {club.memberCount} members · <span className="capitalize">{club.role.toLowerCase()}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {club.pendingCount > 0 && (
                    <span className="text-xs font-bold text-white bg-red-500 px-2 py-0.5 rounded-full">
                      {club.pendingCount} pending
                    </span>
                  )}
                  {(club.role === "PRESIDENT" || club.role === "COORDINATOR") && (
                    <Link
                      href={`/clubs/${club.slug}/manage`}
                      className="text-xs font-semibold text-[#EBA814] hover:underline flex items-center gap-1"
                    >
                      Manage <ArrowRight size={11} />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/events/new" className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex items-center gap-4 group">
          <div className="w-10 h-10 rounded-xl bg-[#EBA814]/10 flex items-center justify-center text-[#EBA814]">
            <Calendar size={20} />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">Create Event</p>
            <p className="text-xs text-gray-500 mt-0.5">Submit a new event for approval</p>
          </div>
          <ArrowRight size={16} className="ml-auto text-gray-300 group-hover:text-gray-500 transition-colors" />
        </Link>
        <Link href="/events" className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex items-center gap-4 group">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500">
            <Activity size={20} />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">View All Events</p>
            <p className="text-xs text-gray-500 mt-0.5">Browse and manage events</p>
          </div>
          <ArrowRight size={16} className="ml-auto text-gray-300 group-hover:text-gray-500 transition-colors" />
        </Link>
      </div>
    </div>
  );
}

// ── University Admin Dashboard ───────────────────────────────────────────────

const activityIcons: Record<string, React.ReactNode> = {
  CLUB_CREATED:  <Building2 size={16} />,
  EVENT_CREATED: <Calendar size={16} />,
  USER_JOINED:   <UserCheck size={16} />,
};

const activityAccent: Record<string, string> = {
  CLUB_CREATED:  "bg-purple-50 text-purple-500",
  EVENT_CREATED: "bg-[#EBA814]/10 text-[#EBA814]",
  USER_JOINED:   "bg-blue-50 text-blue-500",
};

function UniversityAdminDashboard({ user }: { user: UserInfo }) {
  const socket = useSocket();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [pendingClubs, setPendingClubs] = useState<AdminStats["pendingClubs"]>([]);
  const [pendingEvents, setPendingEvents] = useState<AdminStats["pendingEvents"]>([]);
  const [pendingVenueBookings, setPendingVenueBookings] = useState<AdminStats["pendingVenueBookings"]>([]);
  const [pendingResourceBookings, setPendingResourceBookings] = useState<AdminStats["pendingResourceBookings"]>([]);

  useEffect(() => {
    getAdminStats()
      .then((data) => {
        setStats(data);
        setPendingClubs(data.pendingClubs);
        setPendingEvents(data.pendingEvents);
        setPendingVenueBookings(data.pendingVenueBookings);
        setPendingResourceBookings(data.pendingResourceBookings);
      })
      .finally(() => setLoading(false));
  }, []);

  // Real-time: listen for new pending items submitted by officers
  useEffect(() => {
    const handler = (payload: { type: "event" | "club"; id: string; title: string }) => {
      const label = payload.type === "event" ? "New event pending review" : "New club pending review";
      toast.info(`${label}: ${payload.title}`, { duration: 6000 });
      setStats((prev) =>
        prev
          ? {
              ...prev,
              counts: {
                ...prev.counts,
                ...(payload.type === "event"
                  ? { pendingEvents: prev.counts.pendingEvents + 1 }
                  : { pendingClubs: prev.counts.pendingClubs + 1 }),
              },
            }
          : prev
      );
    };
    socket.on("admin:new_pending", handler);
    return () => { socket.off("admin:new_pending", handler); };
  }, [socket]);

  const handleClubAction = async (id: string, action: "approve" | "reject") => {
    setActionLoading(id);
    try {
      if (action === "approve") await approveClub(id);
      else await rejectClub(id);
      setPendingClubs((prev) => prev.filter((c) => c.id !== id));
      setStats((prev) =>
        prev
          ? { ...prev, counts: { ...prev.counts, pendingClubs: prev.counts.pendingClubs - 1 } }
          : prev
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleEventAction = async (id: string, action: "approve" | "reject") => {
    setActionLoading(id);
    try {
      if (action === "approve") await approveEvent(id);
      else await rejectEvent(id);
      setPendingEvents((prev) => prev.filter((e) => e.id !== id));
      setStats((prev) =>
        prev
          ? { ...prev, counts: { ...prev.counts, pendingEvents: prev.counts.pendingEvents - 1 } }
          : prev
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleVenueBookingAction = async (id: string, action: "approve" | "reject") => {
    setActionLoading(id);
    try {
      if (action === "approve") await approveVenueBooking(id);
      else await rejectVenueBooking(id);
      setPendingVenueBookings((prev) => prev.filter((b) => b.id !== id));
      setStats((prev) =>
        prev
          ? { ...prev, counts: { ...prev.counts, pendingVenueBookings: prev.counts.pendingVenueBookings - 1 } }
          : prev
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleResourceBookingAction = async (id: string, action: "approve" | "reject") => {
    setActionLoading(id);
    try {
      if (action === "approve") await approveResourceBooking(id);
      else await rejectResourceBooking(id);
      setPendingResourceBookings((prev) => prev.filter((b) => b.id !== id));
      setStats((prev) =>
        prev
          ? { ...prev, counts: { ...prev.counts, pendingResourceBookings: prev.counts.pendingResourceBookings - 1 } }
          : prev
      );
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <WelcomeHeader user={user} />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          icon={<Building2 size={22} />}
          label="Pending Clubs"
          value={loading ? "—" : stats?.counts.pendingClubs ?? 0}
          href="/clubs"
          accent={stats?.counts.pendingClubs ? "red" : "green"}
        />
        <StatCard
          icon={<Calendar size={22} />}
          label="Pending Events"
          value={loading ? "—" : stats?.counts.pendingEvents ?? 0}
          href="/events"
          accent={stats?.counts.pendingEvents ? "red" : "green"}
        />
        <StatCard
          icon={<Building2 size={22} />}
          label="Venue Bookings"
          value={loading ? "—" : stats?.counts.pendingVenueBookings ?? 0}
          href="/venues"
          accent={stats?.counts.pendingVenueBookings ? "red" : "green"}
        />
        <StatCard
          icon={<Package size={22} />}
          label="Resource Bookings"
          value={loading ? "—" : stats?.counts.pendingResourceBookings ?? 0}
          href="/resources"
          accent={stats?.counts.pendingResourceBookings ? "red" : "green"}
        />
        <StatCard
          icon={<Users size={22} />}
          label="Total Users"
          value={loading ? "—" : stats?.counts.totalUsers ?? 0}
          href="/clubs"
          accent="blue"
        />
        <StatCard
          icon={<Users2 size={22} />}
          label="Active Clubs"
          value={loading ? "—" : stats?.counts.totalActiveClubs ?? 0}
          href="/clubs"
          accent="purple"
        />
      </div>

      <AnnouncementsFeed />

      {/* Pending club approvals */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex items-center gap-2 mb-5">
          <h2 className="text-base font-bold text-gray-900">Pending Club Approvals</h2>
          {pendingClubs.length > 0 && (
            <span className="text-xs font-bold text-white bg-red-500 px-2 py-0.5 rounded-full">
              {pendingClubs.length}
            </span>
          )}
        </div>
        {loading ? (
          <div className="space-y-3">{skeletonRows(2)}</div>
        ) : pendingClubs.length === 0 ? (
          <div className="text-center py-6">
            <CheckCircle size={28} className="text-green-400 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">No pending club approvals</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingClubs.map((club) => (
              <div key={club.id} className="flex items-center gap-4 p-4 bg-[#FAFAFA] rounded-xl border border-gray-100">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 flex-shrink-0">
                  <Building2 size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <Link href={`/clubs/${club.slug}`} className="text-sm font-semibold text-gray-900 hover:text-[#EBA814] truncate block">
                    {club.name}
                  </Link>
                  <p className="text-xs text-gray-400">
                    {club.category} · by {club.createdBy.name} · {new Date(club.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleClubAction(club.id, "approve")}
                    disabled={actionLoading === club.id}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-green-500 hover:bg-green-600 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleClubAction(club.id, "reject")}
                    disabled={actionLoading === club.id}
                    className="px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending event approvals */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex items-center gap-2 mb-5">
          <h2 className="text-base font-bold text-gray-900">Pending Event Approvals</h2>
          {pendingEvents.length > 0 && (
            <span className="text-xs font-bold text-white bg-red-500 px-2 py-0.5 rounded-full">
              {pendingEvents.length}
            </span>
          )}
        </div>
        {loading ? (
          <div className="space-y-3">{skeletonRows(2)}</div>
        ) : pendingEvents.length === 0 ? (
          <div className="text-center py-6">
            <CheckCircle size={28} className="text-green-400 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">No pending event approvals</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingEvents.map((ev) => (
              <div key={ev.id} className="flex items-center gap-4 p-4 bg-[#FAFAFA] rounded-xl border border-gray-100">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 flex-shrink-0">
                  <Calendar size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <Link href={`/events/${ev.id}`} className="text-sm font-semibold text-gray-900 hover:text-[#EBA814] truncate block">
                    {ev.title}
                  </Link>
                  <p className="text-xs text-gray-400">
                    {ev.club.name} · {new Date(ev.startsAt).toLocaleDateString()} · by {ev.createdBy.name}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleEventAction(ev.id, "approve")}
                    disabled={actionLoading === ev.id}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-green-500 hover:bg-green-600 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleEventAction(ev.id, "reject")}
                    disabled={actionLoading === ev.id}
                    className="px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending venue booking approvals */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex items-center gap-2 mb-5">
          <h2 className="text-base font-bold text-gray-900">Pending Venue Bookings</h2>
          {pendingVenueBookings.length > 0 && (
            <span className="text-xs font-bold text-white bg-red-500 px-2 py-0.5 rounded-full">
              {pendingVenueBookings.length}
            </span>
          )}
        </div>
        {loading ? (
          <div className="space-y-3">{skeletonRows(2)}</div>
        ) : pendingVenueBookings.length === 0 ? (
          <div className="text-center py-6">
            <CheckCircle size={28} className="text-green-400 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">No pending venue bookings</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingVenueBookings.map((b) => (
              <div key={b.id} className="flex items-center gap-4 p-4 bg-[#FAFAFA] rounded-xl border border-gray-100">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 flex-shrink-0">
                  <Building2 size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{b.venue.name}</p>
                  <p className="text-xs text-gray-400">
                    {b.venue.location} · by {b.requestedBy.name}
                    {b.club ? ` · ${b.club.name}` : ""}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(b.startTime).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    {" – "}
                    {new Date(b.endTime).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    {" · "}{b.purpose}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleVenueBookingAction(b.id, "approve")}
                    disabled={actionLoading === b.id}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-green-500 hover:bg-green-600 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleVenueBookingAction(b.id, "reject")}
                    disabled={actionLoading === b.id}
                    className="px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending resource booking approvals */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex items-center gap-2 mb-5">
          <h2 className="text-base font-bold text-gray-900">Pending Resource Bookings</h2>
          {pendingResourceBookings.length > 0 && (
            <span className="text-xs font-bold text-white bg-red-500 px-2 py-0.5 rounded-full">
              {pendingResourceBookings.length}
            </span>
          )}
        </div>
        {loading ? (
          <div className="space-y-3">{skeletonRows(2)}</div>
        ) : pendingResourceBookings.length === 0 ? (
          <div className="text-center py-6">
            <CheckCircle size={28} className="text-green-400 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">No pending resource bookings</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingResourceBookings.map((b) => (
              <div key={b.id} className="flex items-center gap-4 p-4 bg-[#FAFAFA] rounded-xl border border-gray-100">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 flex-shrink-0">
                  <Package size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {b.resource.name}
                    {b.quantity > 1 && <span className="font-normal text-gray-500"> × {b.quantity}</span>}
                  </p>
                  <p className="text-xs text-gray-400">
                    {b.resource.category} · by {b.requestedBy.name}
                    {b.club ? ` · ${b.club.name}` : ""}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(b.startTime).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    {" – "}
                    {new Date(b.endTime).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    {" · "}{b.purpose}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleResourceBookingAction(b.id, "approve")}
                    disabled={actionLoading === b.id}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-green-500 hover:bg-green-600 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleResourceBookingAction(b.id, "reject")}
                    disabled={actionLoading === b.id}
                    className="px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent activity */}
      {!loading && stats && stats.recentActivity.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <AlertCircle size={16} className="text-gray-400" />
            <h2 className="text-base font-bold text-gray-900">Recent Activity</h2>
          </div>
          <div className="space-y-2">
            {stats.recentActivity.map((item, i) => (
              <Link
                key={i}
                href={item.link}
                className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${activityAccent[item.type] ?? ""}`}>
                  {activityIcons[item.type]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{item.title}</p>
                  <p className="text-xs text-gray-400">{item.subtitle}</p>
                </div>
                <span className="text-xs text-gray-400 shrink-0">
                  {new Date(item.createdAt).toLocaleDateString()}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── System Admin Dashboard ────────────────────────────────────────────────────

function SystemAdminDashboard({ user }: { user: UserInfo }) {
  const [monitor, setMonitor] = useState<SystemMonitorStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSystemMonitor().then(setMonitor).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      <UniversityAdminDashboard user={user} />

      <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-gray-900">System Monitor</h2>
          <Link href="/admin/system-monitor" className="text-xs font-semibold text-[#EBA814] hover:underline flex items-center gap-1">
            Full report <ArrowRight size={12} />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            icon={<Activity size={22} />}
            label="Active Sessions"
            value={loading ? "—" : monitor?.activeSessions ?? 0}
            href="/admin/system-monitor"
            accent="blue"
          />
          <StatCard
            icon={<ShieldOff size={22} />}
            label="Locked Out"
            value={loading ? "—" : monitor?.lockedOutAccounts ?? 0}
            href="/admin/system-monitor"
            accent={monitor?.lockedOutAccounts ? "red" : "green"}
          />
          <StatCard
            icon={<UserX size={22} />}
            label="Suspended"
            value={loading ? "—" : monitor?.suspendedAccounts ?? 0}
            href="/admin/system-monitor"
            accent={monitor?.suspendedAccounts ? "red" : "green"}
          />
          <StatCard
            icon={<ShieldCheck size={22} />}
            label="2FA Adoption"
            value={loading ? "—" : `${Math.round((monitor?.twoFactorAdoption ?? 0) * 100)}%`}
            href="/admin/system-monitor"
            accent="purple"
          />
        </div>
      </div>
    </div>
  );
}

// ── Page entry point ─────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [user, setUser] = useState<UserInfo | null>(null);

  useEffect(() => {
    const auth = getAuthState();
    if (auth) setUser(auth.user);
  }, []);

  if (!user) return null;

  if (user.role === "SYSTEM_ADMIN") {
    return <SystemAdminDashboard user={user} />;
  }
  if (user.role === "UNIVERSITY_ADMIN") {
    return <UniversityAdminDashboard user={user} />;
  }
  if (user.role === "CLUB_OFFICER") {
    return <OfficerDashboard user={user} />;
  }
  return <StudentDashboard user={user} />;
}
