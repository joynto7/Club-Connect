"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { listEvents, getMyRegistrations, type Event } from "@/lib/events";
import { getAuthState } from "@/lib/tokenStorage";
import { CalendarDays, Filter } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

// FullCalendar (browser-only)
import type { EventInput, EventClickArg } from "@fullcalendar/core";
import type FullCalendarType from "@fullcalendar/react";

const CATEGORY_COLORS: Record<string, string> = {
  General:     "#6B7280",
  Technical:   "#3B82F6",
  Cultural:    "#8B5CF6",
  Sports:      "#10B981",
  Arts:        "#F59E0B",
  Academic:    "#06B6D4",
  Social:      "#EC4899",
  Environmental: "#22C55E",
  Music:       "#EF4444",
  Gaming:      "#A855F7",
};

function formatDateRange(startsAt: string, endsAt?: string | null) {
  const start = new Date(startsAt).toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });
  if (!endsAt) return start;
  const end = new Date(endsAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${start} – ${end}`;
}

export default function CalendarPage() {
  const auth = getAuthState();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [myOnly, setMyOnly]   = useState(false);
  const [popover, setPopover] = useState<{
    event: Event;
    isRsvpd: boolean;
    x: number; y: number;
  } | null>(null);
  const calRef = useRef<FullCalendarType | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const { data: eventsData } = useQuery({
    queryKey: ["events", "all"],
    queryFn: () => listEvents({ date: "" }),
  });

  const { data: myRegsData } = useQuery({
    queryKey: ["my-registrations"],
    queryFn: () => getMyRegistrations(),
    enabled: !!auth,
  });

  const rsvpdIds = new Set(
    (myRegsData?.registrations ?? [])
      .filter(r => r.status === "REGISTERED")
      .map(r => r.event.id)
  );

  const allEvents: Event[] = eventsData?.events ?? [];
  const displayEvents = myOnly
    ? allEvents.filter(e => rsvpdIds.has(e.id))
    : allEvents;

  const fcEvents: EventInput[] = displayEvents.map(e => ({
    id:              e.id,
    title:           e.title,
    start:           e.startsAt,
    end:             e.endsAt ?? undefined,
    backgroundColor: rsvpdIds.has(e.id) ? "#EBA814" : (CATEGORY_COLORS[e.category] ?? "#6B7280"),
    borderColor:     rsvpdIds.has(e.id) ? "#D97706" : (CATEGORY_COLORS[e.category] ?? "#6B7280"),
    textColor:       "#ffffff",
    extendedProps:   { event: e, isRsvpd: rsvpdIds.has(e.id) },
  }));

  const handleEventClick = (info: EventClickArg) => {
    const rect = info.el.getBoundingClientRect();
    setPopover({
      event:   info.event.extendedProps["event"] as Event,
      isRsvpd: info.event.extendedProps["isRsvpd"] as boolean,
      x:       rect.left + rect.width / 2,
      y:       rect.bottom + window.scrollY + 8,
    });
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-zinc-900 p-4 md:p-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center justify-between mb-6"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <CalendarDays size={20} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Calendar</h1>
            <p className="text-sm text-gray-500 dark:text-zinc-400">All upcoming events at a glance</p>
          </div>
        </div>

        {auth && (
          <button
            onClick={() => setMyOnly(v => !v)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
              myOnly
                ? "bg-[#EBA814] text-white border-[#EBA814]"
                : "bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-200 border-gray-200 dark:border-zinc-700 hover:border-[#EBA814]"
            }`}
          >
            <Filter size={15} />
            {myOnly ? "My Events" : "All Events"}
          </button>
        )}
      </motion.div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-5">
        {auth && (
          <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-zinc-400">
            <span className="w-3 h-3 rounded-full bg-[#EBA814] inline-block" />
            RSVPd
          </div>
        )}
        {Object.entries(CATEGORY_COLORS).slice(0, 6).map(([cat, color]) => (
          <div key={cat} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-zinc-400">
            <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: color }} />
            {cat}
          </div>
        ))}
      </div>

      {/* Calendar */}
      <div
        className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-700 p-4 overflow-hidden"
        onClick={() => setPopover(null)}
      >
        {mounted && (
          <CalendarWrapper
            events={fcEvents}
            onEventClick={handleEventClick}
            calRef={calRef}
          />
        )}
        {!mounted && (
          <div className="h-[600px] flex items-center justify-center text-gray-400">
            <CalendarDays size={40} className="opacity-30 animate-pulse" />
          </div>
        )}
      </div>

      {/* Event Popover */}
      {popover && (
        <EventPopover
          event={popover.event}
          isRsvpd={popover.isRsvpd}
          x={popover.x}
          y={popover.y}
          onClose={() => setPopover(null)}
          onNavigate={() => { setPopover(null); router.push(`/events/${popover.event.id}`); }}
        />
      )}
    </div>
  );
}

// ── Lazy-loaded FullCalendar wrapper ─────────────────────────────────────────

function CalendarWrapper({
  events,
  onEventClick,
  calRef,
}: {
  events: EventInput[];
  onEventClick: (info: EventClickArg) => void;
  calRef: React.RefObject<FullCalendarType | null>;
}) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const FullCalendar      = require("@fullcalendar/react").default as typeof FullCalendarType;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const dayGridPlugin     = require("@fullcalendar/daygrid").default;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const timeGridPlugin    = require("@fullcalendar/timegrid").default;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const interactionPlugin = require("@fullcalendar/interaction").default;

  return (
    <FullCalendar
      ref={calRef}
      plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
      initialView="dayGridMonth"
      headerToolbar={{
        left:   "prev,next today",
        center: "title",
        right:  "dayGridMonth,timeGridWeek,timeGridDay",
      }}
      events={events}
      eventClick={onEventClick}
      height={640}
      eventDisplay="block"
      dayMaxEvents={3}
      eventTimeFormat={{ hour: "numeric", minute: "2-digit", meridiem: "short" }}
    />
  );
}

// ── Event Popover ─────────────────────────────────────────────────────────────

function EventPopover({
  event,
  isRsvpd,
  x,
  y,
  onClose,
  onNavigate,
}: {
  event: Event;
  isRsvpd: boolean;
  x: number;
  y: number;
  onClose: () => void;
  onNavigate: () => void;
}) {
  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      {/* Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.15 }}
        style={{ left: Math.min(x, window.innerWidth - 320), top: y }}
        className="fixed z-50 w-72 bg-white dark:bg-zinc-800 rounded-2xl shadow-xl border border-gray-100 dark:border-zinc-700 p-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-tight line-clamp-2">
            {event.title}
          </h3>
          {isRsvpd && (
            <span className="shrink-0 text-[10px] font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full">
              RSVPd
            </span>
          )}
        </div>

        <div className="text-xs text-gray-500 dark:text-zinc-400 space-y-1 mb-3">
          <div>{formatDateRange(event.startsAt, event.endsAt)}</div>
          <div className="truncate">{event.location}</div>
          <div className="font-medium text-gray-700 dark:text-zinc-300">{event.club.name}</div>
        </div>

        <button
          onClick={onNavigate}
          className="w-full py-1.5 rounded-xl bg-[#EBA814] hover:bg-[#D97706] text-white text-xs font-semibold transition-colors"
        >
          View Event
        </button>
      </motion.div>
    </>
  );
}
