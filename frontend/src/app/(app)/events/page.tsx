"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion, type Variants } from "framer-motion";
import {
  listEvents, EVENT_CATEGORIES, EVENT_DATE_FILTERS, type Event,
} from "@/lib/events";
import { getAuthState } from "@/lib/tokenStorage";
import { getMyClubs } from "@/lib/auth";
import {
  Search, Calendar, MapPin, Users, Clock, Plus, ArrowRight,
} from "lucide-react";
import { SkeletonEventCard } from "@/components/shared/Skeleton";
import EmptyState from "@/components/shared/EmptyState";

const statusColors: Record<string, string> = {
  APPROVED:         "bg-green-100 text-green-700",
  PENDING_APPROVAL: "bg-yellow-100 text-yellow-700",
  REJECTED:         "bg-red-100 text-red-700",
  CANCELLED:        "bg-gray-100 text-gray-500",
  DRAFT:            "bg-blue-100 text-blue-700",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit",
  });
}

function EventCard({ event }: { event: Event }) {
  // motion wrapper applied at grid level via variants
  const spotsLeft =
    event.capacity != null && event._count != null
      ? event.capacity - event._count.attendees
      : null;
  const isFull = spotsLeft !== null && spotsLeft <= 0;

  return (
    <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden group flex flex-col">
      {event.posterUrl ? (
        <img src={event.posterUrl} alt={event.title} className="w-full h-36 object-cover flex-shrink-0" />
      ) : (
        <div className="h-36 bg-gradient-to-br from-[#EBA814]/20 to-[#EBA814]/5 flex-shrink-0 flex items-center justify-center">
          <Calendar size={32} className="text-[#EBA814]/40" />
        </div>
      )}

      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-sm font-bold text-gray-900 line-clamp-2 leading-snug">{event.title}</h3>
          <span className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColors[event.status] ?? "bg-gray-100 text-gray-500"}`}>
            {event.category}
          </span>
        </div>

        <div className="space-y-1.5 mb-3 flex-1">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Calendar size={11} className="flex-shrink-0 text-[#EBA814]" />
            {formatDate(event.startsAt)} · {formatTime(event.startsAt)}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <MapPin size={11} className="flex-shrink-0 text-[#EBA814]" />
            <span className="line-clamp-1">{event.location}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Users size={11} className="flex-shrink-0 text-[#EBA814]" />
            <Link href={`/clubs/${event.club.slug}`} className="hover:text-[#EBA814] transition-colors">
              {event.club.name}
            </Link>
          </div>
        </div>

        <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-50">
          <div className="flex items-center gap-2">
            {event.isPaid && event.ticketPrice ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                ৳{(event.ticketPrice / 100).toFixed(2)}
              </span>
            ) : null}
            {spotsLeft !== null ? (
              <span className={`text-xs font-medium ${isFull ? "text-red-500" : "text-gray-400"}`}>
                {isFull ? "Full" : `${spotsLeft} spot${spotsLeft !== 1 ? "s" : ""} left`}
              </span>
            ) : (
              <span className="text-xs text-gray-400">
                {event._count?.attendees ?? 0} registered
              </span>
            )}
          </div>
          <Link
            href={`/events/${event.id}`}
            className="flex items-center gap-1 text-xs font-semibold text-[#EBA814] hover:underline group-hover:gap-2 transition-all"
          >
            Details <ArrowRight size={11} />
          </Link>
        </div>
      </div>
    </div>
  );
}

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.28 } },
};
const gridVariants: Variants = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.06 } },
};

export default function EventsPage() {
  const auth = getAuthState();
  const isAdmin = auth?.user.role === "UNIVERSITY_ADMIN" || auth?.user.role === "SYSTEM_ADMIN";
  const { data: myClubsData } = useQuery({
    queryKey: ["my-clubs"],
    queryFn: getMyClubs,
    enabled: !!auth && !isAdmin,
    staleTime: 60_000,
  });
  const isOfficer = isAdmin || (myClubsData?.clubs ?? []).some(
    (c) => c.role === "PRESIDENT" || c.role === "COORDINATOR"
  );

  const [search,   setSearch]   = useState("");
  const [category, setCategory] = useState("All");
  const [date,     setDate]     = useState("upcoming");

  const { data, isLoading } = useQuery({
    queryKey: ["events", search, category, date],
    queryFn: () => listEvents({
      search:   search || undefined,
      category: category !== "All" ? category : undefined,
      date:     date    || undefined,
    }),
    staleTime: 30_000,
  });

  const events = data?.events ?? [];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Events</h1>
          <p className="text-sm text-gray-500 mt-0.5">Discover events, RSVP, and track your attendance</p>
        </div>
        {isOfficer && (
          <Link
            href="/events/new"
            className="flex items-center gap-2 px-4 py-2.5 bg-[#EBA814] hover:bg-[#D99810] text-white text-sm font-semibold rounded-xl transition-colors shadow-[0_4px_14px_rgba(235,168,20,0.25)]"
          >
            <Plus size={16} /> Create Event
          </Link>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search events by title, description, or location..."
          className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-200 rounded-2xl text-sm outline-none focus:border-[#EBA814] focus:ring-1 focus:ring-[#EBA814] transition-colors shadow-sm"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-6">
        {/* Date filter */}
        <div className="flex gap-2 flex-wrap">
          <span className="flex items-center gap-1 text-xs font-semibold text-gray-400">
            <Clock size={12} /> When:
          </span>
          {EVENT_DATE_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setDate(f.value)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                date === f.value
                  ? "bg-[#EBA814] text-white shadow-sm"
                  : "bg-white text-gray-600 border border-gray-200 hover:border-[#EBA814] hover:text-[#EBA814]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Category filter */}
        <div className="flex gap-2 flex-wrap">
          {["All", ...EVENT_CATEGORIES].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                category === cat
                  ? "bg-zinc-900 text-white shadow-sm"
                  : "bg-white text-gray-600 border border-gray-200 hover:border-zinc-400 hover:text-zinc-700"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      {!isLoading && (
        <p className="text-xs text-gray-400 font-medium">
          {events.length} event{events.length !== 1 ? "s" : ""} found
        </p>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <SkeletonEventCard key={i} />)}
        </div>
      ) : events.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title={search ? `No events found for "${search}"` : "No events yet"}
          description="Check back soon for upcoming events."
          action={{ label: "Clear filters", href: "/events" }}
        />
      ) : (
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          variants={gridVariants}
          initial="hidden"
          animate="show"
        >
          {events.map((e) => (
            <motion.div key={e.id} variants={cardVariants}>
              <EventCard event={e} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
