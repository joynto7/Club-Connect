"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getEvent, getAttendees, checkInUser, cancelEvent,
  type Attendee,
} from "@/lib/events";
import { getApiErrorMessage } from "@/lib/auth";
import {
  ArrowLeft, Users, CheckCircle2, XCircle, Clock,
  Tag, List, AlertTriangle, Settings, Download, RefreshCw,
} from "lucide-react";
import { generateReport } from "@/lib/reports";
import { useSocket } from "@/hooks/useSocket";
import RichTextDisplay from "@/components/shared/RichTextDisplay";

type Tab = "attendees" | "info";

function AttendeeRow({
  attendee,
  eventId,
  onSuccess,
  onError,
}: {
  attendee: Attendee;
  eventId: string;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const qc = useQueryClient();
  const initials = attendee.user.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  const checkIn = useMutation({
    mutationFn: () => checkInUser(eventId, attendee.user.id),
    onSuccess(d) {
      onSuccess(d.message);
      qc.invalidateQueries({ queryKey: ["attendees", eventId] });
    },
    onError(e) { onError(getApiErrorMessage(e)); },
  });

  return (
    <div className="flex items-center gap-4 p-4 bg-[#FAFAFA] rounded-xl border border-gray-100">
      {attendee.user.avatarUrl ? (
        <img src={attendee.user.avatarUrl} alt={attendee.user.name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
      ) : (
        <div className="w-10 h-10 rounded-full bg-[#EBA814] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
          {initials}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-900 truncate">{attendee.user.name}</p>
        <p className="text-xs text-gray-400 truncate">{attendee.user.email}</p>
        {attendee.user.department && (
          <p className="text-xs text-gray-400">{attendee.user.department}</p>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {attendee.isWaitlisted ? (
          <span className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-700">
            <Clock size={10} /> Waitlist
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">
            <Tag size={10} /> Registered
          </span>
        )}

        {!attendee.isWaitlisted && (
          <button
            onClick={() => checkIn.mutate()}
            disabled={checkIn.isPending}
            title={attendee.checkedIn ? "Undo check-in" : "Mark as checked in"}
            className={`p-2 rounded-lg border transition-colors ${
              attendee.checkedIn
                ? "bg-green-50 border-green-200 text-green-600 hover:bg-green-100"
                : "border-gray-200 text-gray-400 hover:bg-green-50 hover:text-green-600 hover:border-green-200"
            }`}
          >
            <CheckCircle2 size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

function AttendeesTab({
  eventId,
  notify,
}: {
  eventId: string;
  notify: (t: "success" | "error", m: string) => void;
}) {
  const [exporting, setExporting] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["attendees", eventId],
    queryFn: () => getAttendees(eventId),
  });

  const handleExport = async (format: "CSV" | "PDF") => {
    setExporting(true);
    try {
      await generateReport({ type: "ATTENDANCE", format, eventId });
    } catch (e) {
      notify("error", (e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  const attendees   = data?.attendees ?? [];
  const confirmed   = attendees.filter((a) => !a.isWaitlisted);
  const waitlisted  = attendees.filter((a) => a.isWaitlisted);
  const checkedInCount = confirmed.filter((a) => a.checkedIn).length;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (attendees.length === 0) {
    return (
      <div className="text-center py-16">
        <Users size={40} className="text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 font-semibold text-sm">No registrations yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats + export */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="grid grid-cols-3 gap-3 flex-1 min-w-0">
          {[
            { label: "Registered", value: confirmed.length,     color: "text-blue-600 bg-blue-50" },
            { label: "Checked In", value: checkedInCount,        color: "text-green-600 bg-green-50" },
            { label: "Waitlist",   value: waitlisted.length,     color: "text-yellow-600 bg-yellow-50" },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl p-3 text-center ${s.color}`}>
              <p className="text-xl font-bold">{s.value}</p>
              <p className="text-xs font-semibold">{s.label}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => handleExport("CSV")}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-green-50 hover:text-green-700 hover:border-green-200 transition-colors disabled:opacity-50"
          >
            {exporting ? <RefreshCw size={12} className="animate-spin" /> : <Download size={12} />}
            CSV
          </button>
          <button
            onClick={() => handleExport("PDF")}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-colors disabled:opacity-50"
          >
            {exporting ? <RefreshCw size={12} className="animate-spin" /> : <Download size={12} />}
            PDF
          </button>
        </div>
      </div>

      {/* Confirmed */}
      {confirmed.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
            Registered ({confirmed.length})
          </h3>
          <div className="space-y-2">
            {confirmed.map((a) => (
              <AttendeeRow
                key={a.id}
                attendee={a}
                eventId={eventId}
                onSuccess={(m) => notify("success", m)}
                onError={(m) => notify("error", m)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Waitlist */}
      {waitlisted.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
            Waitlist ({waitlisted.length})
          </h3>
          <div className="space-y-2">
            {waitlisted.map((a) => (
              <AttendeeRow
                key={a.id}
                attendee={a}
                eventId={eventId}
                onSuccess={(m) => notify("success", m)}
                onError={(m) => notify("error", m)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoTab({
  event,
  onCancelled,
  notify,
}: {
  event: NonNullable<Awaited<ReturnType<typeof getEvent>>["event"]>;
  onCancelled: () => void;
  notify: (t: "success" | "error", m: string) => void;
}) {
  const qc = useQueryClient();
  const cancelMutation = useMutation({
    mutationFn: () => cancelEvent(event.id),
    onSuccess(d) {
      notify("success", d.message);
      qc.invalidateQueries({ queryKey: ["event", event.id] });
      onCancelled();
    },
    onError(e) { notify("error", getApiErrorMessage(e)); },
  });

  const isCancelled = event.status === "CANCELLED";
  const rows = [
    { label: "Status",    value: event.status.replace("_", " ") },
    { label: "Category",  value: event.category },
    { label: "Location",  value: event.location },
    { label: "Starts",    value: new Date(event.startsAt).toLocaleString() },
    { label: "Ends",      value: event.endsAt ? new Date(event.endsAt).toLocaleString() : "—" },
    { label: "Capacity",  value: event.capacity ? String(event.capacity) : "Unlimited" },
    { label: "Waitlist",  value: event.maxWaitlist ? String(event.maxWaitlist) : "None" },
    { label: "Deadline",  value: event.registrationDeadline ? new Date(event.registrationDeadline).toLocaleDateString() : "—" },
    { label: "Contact",   value: event.contactPerson ?? "—" },
    { label: "Club",      value: event.club.name },
  ];

  return (
    <div className="space-y-5">
      <dl className="space-y-3">
        {rows.map((r) => (
          <div key={r.label} className="flex items-start gap-4 py-2.5 border-b border-gray-50">
            <dt className="w-28 flex-shrink-0 text-xs font-bold text-gray-400 uppercase tracking-wide mt-0.5">{r.label}</dt>
            <dd className="text-sm text-gray-800 font-medium">{r.value}</dd>
          </div>
        ))}
      </dl>

      {event.description && (
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Description</p>
          <RichTextDisplay html={event.description} className="text-gray-700" />
        </div>
      )}

      {event.approvalNote && event.status === "REJECTED" && (
        <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-100 rounded-xl">
          <AlertTriangle size={15} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-red-600 mb-0.5">Rejection Reason</p>
            <p className="text-sm text-red-700">{event.approvalNote}</p>
          </div>
        </div>
      )}

      {!isCancelled && (
        <div className="pt-2">
          <button
            onClick={() => {
              if (confirm("Cancel this event? All registrations will remain but the event will be marked cancelled.")) {
                cancelMutation.mutate();
              }
            }}
            disabled={cancelMutation.isPending}
            className="w-full py-3 border border-red-200 text-red-600 text-sm font-semibold rounded-xl hover:bg-red-50 transition-colors disabled:opacity-70"
          >
            {cancelMutation.isPending ? "Cancelling..." : "Cancel This Event"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function ManageEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }  = use(params);
  const qc      = useQueryClient();
  const socket  = useSocket();
  const [tab, setTab] = useState<Tab>("attendees");
  const [notice, setNotice] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["event", id],
    queryFn: () => getEvent(id),
  });

  // Real-time: join event room, refresh attendee list on any check-in
  useEffect(() => {
    socket.emit("join:event", id);
    const handler = () => {
      void qc.invalidateQueries({ queryKey: ["attendees", id] });
    };
    socket.on("event:checkin", handler);
    return () => {
      socket.emit("leave:event", id);
      socket.off("event:checkin", handler);
    };
  }, [socket, id, qc]);

  const notify = (type: "success" | "error", msg: string) => {
    setNotice({ type, msg });
    setTimeout(() => setNotice(null), 3000);
  };

  const event = data?.event;

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "attendees", label: "Attendees & Check-In", icon: <Users size={14} /> },
    { id: "info",      label: "Event Info",            icon: <List  size={14} /> },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link href={`/events/${id}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft size={14} /> Back to Event
        </Link>
        <div className="flex items-center gap-2">
          <Settings size={20} className="text-[#EBA814]" />
          <h1 className="text-2xl font-bold text-gray-900">
            {event ? `Manage: ${event.title}` : "Manage Event"}
          </h1>
        </div>
      </div>

      {notice && (
        <div className={`p-3 rounded-xl text-sm border flex items-center gap-2 ${
          notice.type === "success" ? "bg-green-50 text-green-700 border-green-100" : "bg-red-50 text-red-700 border-red-100"
        }`}>
          {notice.type === "success" ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
          {notice.msg}
        </div>
      )}

      {isLoading ? (
        <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
      ) : !event ? (
        <p className="text-gray-500 text-center py-16">Event not found or access denied.</p>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm">
          {/* Tab bar */}
          <div className="flex border-b border-gray-100 px-4">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-4 text-sm font-semibold border-b-2 transition-colors ${
                  tab === t.id
                    ? "border-[#EBA814] text-[#EBA814]"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="p-6">
            {tab === "attendees" && (
              <AttendeesTab eventId={event.id} notify={notify} />
            )}
            {tab === "info" && (
              <InfoTab
                event={event}
                onCancelled={() => {}}
                notify={notify}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
