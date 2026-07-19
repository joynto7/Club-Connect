"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getEvent, registerForEvent, cancelRegistration, getTicket, scanTicket, setReminder,
  getEventIcsUrl, getGoogleCalendarUrl, createCheckoutSession,
  type EventStatus, type EventTicket,
} from "@/lib/events";
import { getMyFeedback, submitFeedback } from "@/lib/analytics";
import { getApiErrorMessage } from "@/lib/auth";
import { getAuthState } from "@/lib/tokenStorage";
import {
  ArrowLeft, Calendar, MapPin, Users, Clock, UserCheck,
  CheckCircle2, XCircle, AlertTriangle, Settings, Tag,
  UserCircle, List, Star, MessageSquare, ChevronDown, ChevronUp,
  ThumbsUp, Send, Download, QrCode, Bell, Video, ExternalLink, CalendarPlus, CreditCard,
} from "lucide-react";
import { downloadCertificate } from "@/lib/gamification";
import ReportContentButton from "@/components/shared/ReportContentButton";
import RichTextDisplay from "@/components/shared/RichTextDisplay";
import EventCountdown from "@/components/shared/EventCountdown";
import { QRCodeSVG } from "qrcode.react";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useSocket } from "@/hooks/useSocket";
import { toast } from "sonner";
import {
  listQuestions, submitQuestion, upvoteQuestion, answerQuestion, type EventQuestion,
} from "@/lib/social";

const statusConfig: Record<EventStatus, { label: string; color: string }> = {
  APPROVED:         { label: "Open",           color: "bg-green-100 text-green-700" },
  PENDING_APPROVAL: { label: "Pending Review", color: "bg-yellow-100 text-yellow-700" },
  DRAFT:            { label: "Draft",          color: "bg-blue-100 text-blue-700" },
  REJECTED:         { label: "Rejected",       color: "bg-red-100 text-red-700" },
  CANCELLED:        { label: "Cancelled",      color: "bg-gray-100 text-gray-500" },
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "long", year: "numeric", month: "long",
    day: "numeric", hour: "numeric", minute: "2-digit",
  });
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
}

export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const auth = getAuthState();
  const qc = useQueryClient();
  const [notice, setNotice]         = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [feedbackRating, setFeedbackRating]   = useState(0);
  const [feedbackHover, setFeedbackHover]     = useState(0);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [catRatings, setCatRatings] = useState<Record<string, number>>({});
  const [liveAttendance, setLiveAttendance] = useState<{ registeredCount: number; waitlistCount: number } | null>(null);
  const [ticket, setTicket]         = useState<EventTicket | null>(null);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [activeReminders, setActiveReminders] = useState<Set<number>>(new Set());
  const socket = useSocket();
  const searchParams = useSearchParams();

  const { data, isLoading } = useQuery({
    queryKey: ["event", id],
    queryFn: () => getEvent(id),
  });

  // Show payment result toast on redirect back from SSLCommerz
  useEffect(() => {
    const payment = searchParams.get("payment");
    if (payment === "success") {
      toast.success("Payment successful! Your ticket is confirmed.");
      void qc.invalidateQueries({ queryKey: ["event", id] });
    } else if (payment === "cancelled") {
      toast.info("Payment was cancelled.");
    }
  }, [searchParams, id, qc]);

  // Real-time: join event room and listen for live attendance updates
  useEffect(() => {
    socket.emit("join:event", id);
    const handler = (payload: { registeredCount: number; waitlistCount: number }) => {
      setLiveAttendance(payload);
    };
    socket.on("event:attendance_changed", handler);
    return () => {
      socket.emit("leave:event", id);
      socket.off("event:attendance_changed", handler);
    };
  }, [socket, id]);

  const notify = (type: "success" | "error", msg: string) => {
    setNotice({ type, msg });
    setTimeout(() => setNotice(null), 4000);
  };
  const invalidate = () => qc.invalidateQueries({ queryKey: ["event", id] });

  const registerMutation = useMutation({
    mutationFn: () => registerForEvent(id),
    onSuccess(d) {
      notify("success", d.message);
      invalidate();
      if (d.warning) toast.warning(d.warning, { duration: 6000 });
    },
    onError(e)   { notify("error", getApiErrorMessage(e)); },
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelRegistration(id),
    onSuccess(d) { notify("success", d.message); invalidate(); },
    onError(e)   { notify("error", getApiErrorMessage(e)); },
  });

  const _ev = data?.event;
  const _isStarted  = _ev ? new Date() > new Date(_ev.startsAt) : false;
  const _eventEnded = _ev
    ? (_ev.endsAt ? new Date() > new Date(_ev.endsAt) : _isStarted)
    : false;
  const _wasRegistered = data?.myRegistration?.status === "REGISTERED";

  const { data: myFeedbackData } = useQuery({
    queryKey: ["myFeedback", id],
    queryFn: () => getMyFeedback(id),
    enabled: !!auth && _eventEnded && _wasRegistered,
  });

  const feedbackMutation = useMutation({
    mutationFn: () => submitFeedback(id, {
      rating: feedbackRating,
      comment: feedbackComment.trim() || undefined,
      categoryRatings: Object.keys(catRatings).length > 0 ? catRatings : undefined,
    }),
    onSuccess(d) {
      notify("success", d.message);
      qc.invalidateQueries({ queryKey: ["myFeedback", id] });
    },
    onError(e) { notify("error", getApiErrorMessage(e)); },
  });

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="h-56 bg-gray-100 rounded-2xl animate-pulse" />
        <div className="h-40 bg-gray-100 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-3xl mx-auto text-center py-20">
        <p className="text-gray-500 font-semibold">Event not found.</p>
        <Link href="/events" className="text-[#EBA814] text-sm hover:underline mt-2 block">← Back to Events</Link>
      </div>
    );
  }

  const { event, myRegistration, waitlistCount } = data;
  const sc = statusConfig[event.status as EventStatus];

  const confirmedCount = liveAttendance?.registeredCount ?? event._count?.attendees ?? 0;
  const liveWaitlistCount = liveAttendance?.waitlistCount ?? waitlistCount;
  const spotsLeft      = event.capacity != null ? event.capacity - confirmedCount : null;
  const isFull         = spotsLeft !== null && spotsLeft <= 0;
  const isPastDeadline = event.registrationDeadline ? new Date() > new Date(event.registrationDeadline) : false;
  const isStarted      = new Date() > new Date(event.startsAt);
  const eventEnded     = event.endsAt ? new Date() > new Date(event.endsAt) : isStarted;
  const canRegister    = event.status === "APPROVED" && !isPastDeadline && !isStarted;
  const hasWaitlist    = event.maxWaitlist != null && event.maxWaitlist > 0;
  const waitlistFull   = hasWaitlist && event.maxWaitlist != null && liveWaitlistCount >= event.maxWaitlist;

  const isOfficer = auth?.user.role === "CLUB_OFFICER" || auth?.user.role === "UNIVERSITY_ADMIN" || auth?.user.role === "SYSTEM_ADMIN";
  const isEventOfficer = isOfficer; // simplified — manage page does server-side check

  const isRegistered  = myRegistration?.status === "REGISTERED";
  const onWaitlist    = isRegistered && myRegistration?.isWaitlisted;
  const isCheckedIn   = myRegistration?.checkedIn;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back */}
      <Link href="/events" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft size={14} /> Back to Events
      </Link>

      {/* Notice */}
      {notice && (
        <div className={`p-3 rounded-xl text-sm border flex items-center gap-2 ${
          notice.type === "success" ? "bg-green-50 text-green-700 border-green-100" : "bg-red-50 text-red-700 border-red-100"
        }`}>
          {notice.type === "success" ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
          {notice.msg}
        </div>
      )}

      {/* Hero */}
      {event.posterUrl ? (
        <img src={event.posterUrl} alt={event.title} className="w-full h-56 object-cover rounded-2xl shadow-sm" />
      ) : (
        <div className="w-full h-40 rounded-2xl bg-gradient-to-br from-[#EBA814]/20 to-[#EBA814]/5 flex items-center justify-center">
          <Calendar size={48} className="text-[#EBA814]/40" />
        </div>
      )}

      {/* Main card */}
      <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
        {/* Title row */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${sc.color}`}>{sc.label}</span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#EBA814]/10 text-[#EBA814]">
                {event.category}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{event.title}</h1>
            <Link href={`/clubs/${event.club.slug}`} className="text-sm text-[#EBA814] hover:underline mt-0.5 inline-block">
              {event.club.name}
            </Link>
            <div className="mt-1.5 flex flex-wrap items-center gap-3">
              <EventCountdown startsAt={event.startsAt} endsAt={event.endsAt} />
              {event.isVirtual && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full">
                  <Video size={11} /> Virtual Event
                </span>
              )}
            </div>
          </div>

          {/* Officer manage link */}
          {isEventOfficer && (
            <Link
              href={`/events/${event.id}/manage`}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors flex-shrink-0"
            >
              <Settings size={14} /> Manage
            </Link>
          )}
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-start gap-3 p-3.5 bg-[#FAFAFA] rounded-xl">
            <Calendar size={16} className="text-[#EBA814] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-0.5">Start</p>
              <p className="text-sm font-semibold text-gray-800">{formatDateTime(event.startsAt)}</p>
            </div>
          </div>
          {event.endsAt && (
            <div className="flex items-start gap-3 p-3.5 bg-[#FAFAFA] rounded-xl">
              <Clock size={16} className="text-[#EBA814] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-0.5">End</p>
                <p className="text-sm font-semibold text-gray-800">{formatDateTime(event.endsAt)}</p>
              </div>
            </div>
          )}
          <div className="flex items-start gap-3 p-3.5 bg-[#FAFAFA] rounded-xl">
            <MapPin size={16} className="text-[#EBA814] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-0.5">Location</p>
              <p className="text-sm font-semibold text-gray-800">{event.location}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3.5 bg-[#FAFAFA] rounded-xl">
            <Users size={16} className="text-[#EBA814] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-0.5">Capacity</p>
              <p className="text-sm font-semibold text-gray-800">
                {event.capacity != null
                  ? `${confirmedCount} / ${event.capacity} registered${isFull ? " · Full" : ""}`
                  : `${confirmedCount} registered (unlimited)`}
              </p>
              {hasWaitlist && (
                <p className="text-xs text-gray-400 mt-0.5">
                  Waitlist: {liveWaitlistCount} / {event.maxWaitlist}
                </p>
              )}
            </div>
          </div>
          {event.registrationDeadline && (
            <div className="flex items-start gap-3 p-3.5 bg-[#FAFAFA] rounded-xl">
              <Clock size={16} className={`flex-shrink-0 mt-0.5 ${isPastDeadline ? "text-red-400" : "text-[#EBA814]"}`} />
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-0.5">Deadline</p>
                <p className={`text-sm font-semibold ${isPastDeadline ? "text-red-500" : "text-gray-800"}`}>
                  {formatDate(event.registrationDeadline)}{isPastDeadline ? " (Passed)" : ""}
                </p>
              </div>
            </div>
          )}
          {event.contactPerson && (
            <div className="flex items-start gap-3 p-3.5 bg-[#FAFAFA] rounded-xl">
              <UserCircle size={16} className="text-[#EBA814] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-0.5">Contact</p>
                <p className="text-sm font-semibold text-gray-800">{event.contactPerson}</p>
              </div>
            </div>
          )}
        </div>

        {/* U8.4 — Add to Calendar buttons */}
        {event.status === "APPROVED" && (
          <div className="flex flex-wrap gap-2">
            <a
              href={getGoogleCalendarUrl(event)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 border border-blue-100 dark:border-blue-800 transition-colors"
            >
              <CalendarPlus size={13} />
              Add to Google Calendar
              <ExternalLink size={11} className="opacity-60" />
            </a>
            <a
              href={getEventIcsUrl(event.id)}
              download
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-50 dark:bg-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-600 border border-gray-200 dark:border-zinc-600 transition-colors"
            >
              <Download size={13} />
              Download .ics
            </a>
          </div>
        )}

        {/* Description */}
        {event.description && (
          <div>
            <h2 className="text-sm font-bold text-gray-700 mb-2">About this Event</h2>
            <RichTextDisplay html={event.description} className="text-gray-600" />
          </div>
        )}

        {/* Rejection note */}
        {event.approvalNote && event.status === "REJECTED" && (
          <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-100 rounded-xl">
            <AlertTriangle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-red-600 mb-0.5">Rejection Reason</p>
              <p className="text-sm text-red-700">{event.approvalNote}</p>
            </div>
          </div>
        )}

        {/* RSVP section */}
        {auth && event.status === "APPROVED" && (
          <div className="pt-4 border-t border-gray-100">
            {isCheckedIn && (
              <div className="space-y-2 mb-3">
                <div className="flex items-center gap-2 p-3.5 bg-green-50 border border-green-100 rounded-xl">
                  <Tag size={15} className="text-green-600" />
                  <span className="text-sm font-semibold text-green-700">You have been checked in!</span>
                </div>
                <button
                  onClick={() => void downloadCertificate(id, auth!.user.id)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 border border-[#EBA814]/50 text-[#EBA814] text-sm font-semibold rounded-xl hover:bg-[#EBA814]/5 transition-colors"
                >
                  <Download size={14} /> Download Certificate
                </button>
              </div>
            )}

            {!isRegistered && canRegister && (
              event.isPaid && event.ticketPrice ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-sm text-gray-600 flex items-center gap-1.5">
                      <CreditCard size={14} className="text-[#EBA814]" /> Paid event
                    </span>
                    <span className="text-base font-bold text-gray-900">
                      ৳{(event.ticketPrice / 100).toFixed(2)}
                    </span>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        const { sessionUrl } = await createCheckoutSession(id);
                        window.location.href = sessionUrl;
                      } catch {
                        toast.error("Could not create checkout session. Please try again.");
                      }
                    }}
                    disabled={isFull && waitlistFull}
                    className="w-full py-3.5 bg-[#EBA814] hover:bg-[#D99810] text-white font-semibold rounded-xl transition-colors disabled:opacity-60 shadow-[0_4px_14px_rgba(235,168,20,0.25)] flex items-center justify-center gap-2"
                  >
                    <CreditCard size={15} />
                    {isFull ? "Event Full" : `Buy Ticket · ৳${(event.ticketPrice / 100).toFixed(2)}`}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => registerMutation.mutate()}
                  disabled={registerMutation.isPending || (isFull && waitlistFull)}
                  className="w-full py-3.5 bg-[#EBA814] hover:bg-[#D99810] text-white font-semibold rounded-xl transition-colors disabled:opacity-60 shadow-[0_4px_14px_rgba(235,168,20,0.25)]"
                >
                  {registerMutation.isPending
                    ? "Registering..."
                    : isFull && hasWaitlist && !waitlistFull
                    ? "Join Waitlist"
                    : isFull
                    ? "Event Full"
                    : "Register for Event"}
                </button>
              )
            )}

            {isRegistered && onWaitlist && (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3.5 bg-yellow-50 border border-yellow-100 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Clock size={15} className="text-yellow-600" />
                    <span className="text-sm font-semibold text-yellow-700">You are on the waitlist</span>
                  </div>
                  {myRegistration?.waitlistPosition != null && (
                    <span className="text-xs font-bold text-yellow-700 bg-yellow-200 px-2.5 py-0.5 rounded-full">
                      #{myRegistration.waitlistPosition}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => { if (confirm("Leave the waitlist?")) cancelMutation.mutate(); }}
                  disabled={cancelMutation.isPending}
                  className="w-full py-3 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                >
                  {cancelMutation.isPending ? "Cancelling..." : "Leave Waitlist"}
                </button>
              </div>
            )}

            {isRegistered && !onWaitlist && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3.5 bg-green-50 border border-green-100 rounded-xl">
                  <UserCheck size={15} className="text-green-600" />
                  <span className="text-sm font-semibold text-green-700">You are registered!</span>
                </div>

                {/* Virtual event join button */}
                {event.isVirtual && event.meetingUrl && isStarted && (
                  <a
                    href={event.meetingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors shadow-[0_4px_14px_rgba(37,99,235,0.25)]"
                  >
                    <Video size={15} /> Join Meeting <ExternalLink size={13} />
                  </a>
                )}

                {/* QR Ticket */}
                {!isStarted && (
                  <div>
                    {ticket ? (
                      <div className="p-5 border-2 border-dashed border-[#EBA814]/40 rounded-2xl text-center space-y-3">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Your Event Ticket</p>
                        <div className="flex justify-center">
                          <QRCodeSVG value={ticket.token} size={160} />
                        </div>
                        <p className="text-xs text-gray-400">Show this at check-in</p>
                      </div>
                    ) : (
                      <button
                        onClick={async () => {
                          setTicketLoading(true);
                          try {
                            const t = await getTicket(id);
                            setTicket(t);
                          } catch {
                            toast.error("Could not load ticket");
                          } finally {
                            setTicketLoading(false);
                          }
                        }}
                        disabled={ticketLoading}
                        className="w-full flex items-center justify-center gap-2 py-3 border border-[#EBA814]/50 text-[#EBA814] text-sm font-semibold rounded-xl hover:bg-[#EBA814]/5 transition-colors"
                      >
                        <QrCode size={15} />
                        {ticketLoading ? "Loading..." : "Show QR Ticket"}
                      </button>
                    )}
                  </div>
                )}

                {/* Reminder picker */}
                {!isStarted && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                      <Bell size={11} /> Remind me before
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      {([
                        { label: "1 day before", value: 1440 as const },
                        { label: "1 hour",       value: 60   as const },
                        { label: "15 minutes",   value: 15   as const },
                      ]).map((r) => (
                        <button
                          key={r.value}
                          onClick={async () => {
                            try {
                              await setReminder(id, r.value);
                              setActiveReminders((prev) => new Set(prev).add(r.value));
                              toast.success(`Reminder set: ${r.label}`);
                            } catch {
                              toast.error("Could not set reminder");
                            }
                          }}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                            activeReminders.has(r.value)
                              ? "bg-[#EBA814] text-white border-[#EBA814]"
                              : "border-gray-200 text-gray-600 hover:border-[#EBA814] hover:text-[#EBA814]"
                          }`}
                        >
                          {activeReminders.has(r.value) ? "✓ " : ""}{r.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {!isStarted && (
                  <button
                    onClick={() => { if (confirm("Cancel your registration?")) cancelMutation.mutate(); }}
                    disabled={cancelMutation.isPending}
                    className="w-full py-3 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                  >
                    {cancelMutation.isPending ? "Cancelling..." : "Cancel Registration"}
                  </button>
                )}
              </div>
            )}

            {!isRegistered && !canRegister && (
              <p className="text-center text-sm text-gray-400 py-2">
                {isStarted ? "This event has already started." : "Registration is closed."}
              </p>
            )}
          </div>
        )}

        {!auth && event.status === "APPROVED" && (
          <div className="pt-4 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-500 mb-3">Sign in to register for this event</p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#EBA814] text-white text-sm font-semibold rounded-xl hover:bg-[#D99810] transition-colors"
            >
              Sign In to Register
            </Link>
          </div>
        )}
      </div>

      {/* Officer quick-links */}
      {isEventOfficer && (
        <div className="space-y-3">
          <Link
            href={`/events/${event.id}/manage`}
            className="flex items-center justify-between p-4 bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#EBA814]/10 flex items-center justify-center">
                <List size={18} className="text-[#EBA814]" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Manage Attendees &amp; Check-In</p>
                <p className="text-xs text-gray-400">View registrations, mark attendance, cancel event</p>
              </div>
            </div>
            <ArrowLeft size={16} className="text-gray-400 rotate-180 group-hover:translate-x-1 transition-transform" />
          </Link>

          <Link
            href={`/events/${event.id}/scan`}
            className="flex items-center justify-between p-4 bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <QrCode size={18} className="text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">QR Ticket Scanner</p>
                <p className="text-xs text-gray-400">Scan attendee QR codes at the door</p>
              </div>
            </div>
            <ArrowLeft size={16} className="text-gray-400 rotate-180 group-hover:translate-x-1 transition-transform" />
          </Link>

          {eventEnded && (
            <Link
              href={`/events/${event.id}/feedback`}
              className="flex items-center justify-between p-4 bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
                  <Star size={18} className="text-purple-500" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">View Feedback Report</p>
                  <p className="text-xs text-gray-400">Ratings and comments from attendees</p>
                </div>
              </div>
              <ArrowLeft size={16} className="text-gray-400 rotate-180 group-hover:translate-x-1 transition-transform" />
            </Link>
          )}
        </div>
      )}

      {/* Post-event feedback form for attendees */}
      {auth && eventEnded && myRegistration?.status === "REGISTERED" && (
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare size={18} className="text-[#EBA814]" />
            <h2 className="text-base font-bold text-gray-900">Share Your Feedback</h2>
          </div>

          {myFeedbackData?.feedback ? (
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-100 rounded-xl">
              <CheckCircle2 size={18} className="text-green-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-700">Feedback submitted — thank you!</p>
                <div className="flex gap-0.5 mt-1">
                  {[1,2,3,4,5].map((s) => (
                    <Star key={s} size={14} className={s <= myFeedbackData.feedback!.rating ? "fill-[#EBA814] text-[#EBA814]" : "text-gray-300"} />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <form
              onSubmit={(e) => { e.preventDefault(); if (feedbackRating > 0) feedbackMutation.mutate(); }}
              className="space-y-4"
            >
              {/* Star rating */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Overall Rating <span className="text-red-400">*</span></p>
                <div className="flex gap-1">
                  {[1,2,3,4,5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onMouseEnter={() => setFeedbackHover(s)}
                      onMouseLeave={() => setFeedbackHover(0)}
                      onClick={() => setFeedbackRating(s)}
                      className="p-1 transition-transform hover:scale-110"
                    >
                      <Star
                        size={28}
                        className={
                          s <= (feedbackHover || feedbackRating)
                            ? "fill-[#EBA814] text-[#EBA814]"
                            : "text-gray-300"
                        }
                      />
                    </button>
                  ))}
                  {feedbackRating > 0 && (
                    <span className="ml-2 text-sm text-gray-500 self-center">
                      {["","Poor","Fair","Good","Very Good","Excellent"][feedbackRating]}
                    </span>
                  )}
                </div>
              </div>

              {/* Category ratings */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { key: "organization", label: "Organization" },
                  { key: "content",      label: "Content Quality" },
                  { key: "venue",        label: "Venue & Setup" },
                ].map(({ key, label }) => (
                  <div key={key} className="p-3 bg-[#FAFAFA] rounded-xl">
                    <p className="text-xs font-semibold text-gray-500 mb-1.5">{label}</p>
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setCatRatings((prev) => ({ ...prev, [key]: s }))}
                          className="transition-transform hover:scale-110"
                        >
                          <Star
                            size={16}
                            className={s <= (catRatings[key] ?? 0) ? "fill-[#EBA814] text-[#EBA814]" : "text-gray-300"}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Comment */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Comments (optional)</p>
                <textarea
                  value={feedbackComment}
                  onChange={(e) => setFeedbackComment(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder="Share your experience..."
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#EBA814]/30 focus:border-[#EBA814] resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={feedbackRating === 0 || feedbackMutation.isPending}
                className="w-full py-3 bg-[#EBA814] hover:bg-[#D99810] text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 shadow-[0_4px_14px_rgba(235,168,20,0.2)]"
              >
                {feedbackMutation.isPending ? "Submitting..." : "Submit Feedback"}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Q&A Section */}
      <QASection
        eventId={event.id}
        isOfficer={isOfficer}
        isRegistered={!!myRegistration && myRegistration.status === "REGISTERED"}
        auth={auth}
      />

      {/* Report content link */}
      {auth && (
        <div className="flex justify-end">
          <ReportContentButton targetType="EVENT" targetId={event.id} targetName={event.title} />
        </div>
      )}
    </div>
  );
}

function QASection({
  eventId,
  isOfficer,
  isRegistered,
  auth,
}: {
  eventId: string;
  isOfficer: boolean;
  isRegistered: boolean;
  auth: ReturnType<typeof getAuthState>;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [newQ, setNewQ] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [answerModalQ, setAnswerModalQ] = useState<EventQuestion | null>(null);
  const [answerText, setAnswerText] = useState("");

  const { data: questions = [], isLoading } = useQuery({
    queryKey: ["event-questions", eventId],
    queryFn: () => listQuestions(eventId),
    enabled: open,
  });

  const handleSubmitQ = async () => {
    if (!newQ.trim()) return;
    setSubmitting(true);
    try {
      await submitQuestion(eventId, newQ.trim());
      setNewQ("");
      void qc.invalidateQueries({ queryKey: ["event-questions", eventId] });
    } catch {
      // silent
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpvote = async (qId: string) => {
    try {
      await upvoteQuestion(eventId, qId);
      void qc.invalidateQueries({ queryKey: ["event-questions", eventId] });
    } catch {
      // silent
    }
  };

  const handleAnswer = async () => {
    if (!answerModalQ || !answerText.trim()) return;
    try {
      await answerQuestion(eventId, answerModalQ.id, answerText.trim());
      setAnswerModalQ(null);
      setAnswerText("");
      void qc.invalidateQueries({ queryKey: ["event-questions", eventId] });
    } catch {
      // silent
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
      >
        <div className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
          <MessageSquare size={16} />
          Questions &amp; Answers
        </div>
        {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4 border-t border-gray-100 dark:border-zinc-800">
          {isLoading ? (
            <div className="space-y-3 pt-4">
              {[1,2].map((i) => <div key={i} className="h-14 bg-gray-100 dark:bg-zinc-800 rounded-xl animate-pulse" />)}
            </div>
          ) : questions.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-6">No questions yet. Be the first to ask!</p>
          ) : (
            <div className="space-y-3 pt-3">
              {questions.map((q) => (
                <div key={q.id} className={`rounded-xl p-4 border ${q.isAnswered ? "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10" : "border-gray-200 dark:border-zinc-700"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{q.question}</p>
                      <p className="text-xs text-gray-400 mt-1">by {q.author.name}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => void handleUpvote(q.id)}
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#EBA814] transition-colors"
                      >
                        <ThumbsUp size={13} />
                        <span>{q.upvotes}</span>
                      </button>
                      {q.isAnswered && <span className="text-xs bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 px-2 py-0.5 rounded-full font-medium">Answered</span>}
                      {isOfficer && !q.isAnswered && (
                        <button
                          onClick={() => { setAnswerModalQ(q); setAnswerText(""); }}
                          className="text-xs text-[#EBA814] font-medium hover:underline"
                        >
                          Answer
                        </button>
                      )}
                    </div>
                  </div>
                  {q.isAnswered && q.answer && (
                    <div className="mt-3 bg-green-100 dark:bg-green-900/30 rounded-lg px-3 py-2">
                      <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-1">
                        {q.answeredBy?.name ?? "Officer"} replied:
                      </p>
                      <p className="text-sm text-green-800 dark:text-green-300">{q.answer}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {isRegistered && auth && (
            <div className="flex gap-2 pt-1">
              <input
                value={newQ}
                onChange={(e) => setNewQ(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void handleSubmitQ(); }}
                placeholder="Ask a question..."
                className="flex-1 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-[#EBA814]/40"
              />
              <button
                onClick={() => void handleSubmitQ()}
                disabled={!newQ.trim() || submitting}
                className="px-3 py-2 bg-[#EBA814] text-white rounded-xl text-sm font-medium disabled:opacity-50 hover:bg-[#d4930f] transition-colors"
              >
                <Send size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Answer modal */}
      {answerModalQ && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-xl">
            <h3 className="font-bold text-gray-900 dark:text-white">Answer Question</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-zinc-800 rounded-xl px-4 py-3">
              {answerModalQ.question}
            </p>
            <textarea
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              rows={4}
              placeholder="Type your answer..."
              className="w-full border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-[#EBA814]/40 resize-none"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setAnswerModalQ(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleAnswer()}
                disabled={!answerText.trim()}
                className="px-4 py-2 bg-[#EBA814] text-white rounded-xl text-sm font-medium disabled:opacity-50"
              >
                Submit Answer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
