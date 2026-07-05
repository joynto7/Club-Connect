"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2, Package, Clock, MapPin, AlertCircle,
  CheckCircle, XCircle, Timer, ArrowRight,
} from "lucide-react";
import {
  getMyVenueBookings, getMyResourceBookings,
  cancelVenueBooking, cancelResourceBooking,
} from "@/lib/venues";
import type { VenueBooking, ResourceBooking, BookingStatus } from "@/lib/venues";
import { getAuthState } from "@/lib/tokenStorage";

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const same = s.toDateString() === e.toDateString();
  const dateOpts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const timeOpts: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
  if (same) {
    return `${s.toLocaleDateString("en-US", dateOpts)} · ${s.toLocaleTimeString("en-US", timeOpts)} – ${e.toLocaleTimeString("en-US", timeOpts)}`;
  }
  return `${s.toLocaleDateString("en-US", { ...dateOpts, ...timeOpts })} – ${e.toLocaleDateString("en-US", { ...dateOpts, ...timeOpts })}`;
}

const statusConfig: Record<BookingStatus, { label: string; color: string; icon: React.ReactNode }> = {
  PENDING:   { label: "Pending",   color: "bg-amber-50 text-amber-700",  icon: <Timer size={13} /> },
  APPROVED:  { label: "Approved",  color: "bg-green-50 text-green-700",  icon: <CheckCircle size={13} /> },
  REJECTED:  { label: "Rejected",  color: "bg-red-50 text-red-700",      icon: <XCircle size={13} /> },
  CANCELLED: { label: "Cancelled", color: "bg-gray-100 text-gray-500",   icon: <XCircle size={13} /> },
};

function StatusBadge({ status }: { status: BookingStatus }) {
  const cfg = statusConfig[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.color}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// ── Venue Booking Row ────────────────────────────────────────────────────────

function VenueBookingRow({
  booking,
  onCancel,
}: {
  booking: VenueBooking;
  onCancel: (id: string) => void;
}) {
  const [cancelling, setCancelling] = useState(false);

  const handleCancel = async () => {
    if (!confirm("Cancel this booking request?")) return;
    setCancelling(true);
    try {
      await cancelVenueBooking(booking.id);
      onCancel(booking.id);
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="bg-[#FAFAFA] rounded-xl border border-gray-100 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[#EBA814]/10 flex items-center justify-center text-[#EBA814] flex-shrink-0">
            <Building2 size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <Link
              href={`/venues/${booking.venueId}`}
              className="font-semibold text-sm text-gray-900 hover:text-[#EBA814] truncate block"
            >
              {booking.venue.name}
            </Link>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <MapPin size={11} /> {booking.venue.location}
              </span>
              <span className="flex items-center gap-1">
                <Clock size={11} /> {fmtRange(booking.startTime, booking.endTime)}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1 line-clamp-1">{booking.purpose}</p>
            {booking.club && (
              <p className="text-xs text-gray-400 mt-0.5">Club: {booking.club.name}</p>
            )}
            {booking.adminNote && booking.status === "REJECTED" && (
              <div className="flex items-start gap-1.5 mt-2 bg-red-50 rounded-lg px-2 py-1.5">
                <AlertCircle size={13} className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">{booking.adminNote}</p>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <StatusBadge status={booking.status} />
          {(booking.status === "PENDING" || booking.status === "APPROVED") && (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="text-xs font-semibold text-red-500 hover:text-red-700 disabled:opacity-50"
            >
              {cancelling ? "Cancelling…" : "Cancel"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Resource Booking Row ──────────────────────────────────────────────────────

function ResourceBookingRow({
  booking,
  onCancel,
}: {
  booking: ResourceBooking;
  onCancel: (id: string) => void;
}) {
  const [cancelling, setCancelling] = useState(false);

  const handleCancel = async () => {
    if (!confirm("Cancel this booking request?")) return;
    setCancelling(true);
    try {
      await cancelResourceBooking(booking.id);
      onCancel(booking.id);
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="bg-[#FAFAFA] rounded-xl border border-gray-100 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-500 flex-shrink-0">
            <Package size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-gray-900 truncate">
              {booking.resource.name}
              {booking.quantity > 1 && (
                <span className="ml-1.5 text-xs font-normal text-gray-400">× {booking.quantity}</span>
              )}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs text-gray-400">
              <span className="px-1.5 py-0.5 bg-gray-100 rounded-md">{booking.resource.category}</span>
              <span className="flex items-center gap-1">
                <Clock size={11} /> {fmtRange(booking.startTime, booking.endTime)}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1 line-clamp-1">{booking.purpose}</p>
            {booking.club && (
              <p className="text-xs text-gray-400 mt-0.5">Club: {booking.club.name}</p>
            )}
            {booking.adminNote && booking.status === "REJECTED" && (
              <div className="flex items-start gap-1.5 mt-2 bg-red-50 rounded-lg px-2 py-1.5">
                <AlertCircle size={13} className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">{booking.adminNote}</p>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <StatusBadge status={booking.status} />
          {(booking.status === "PENDING" || booking.status === "APPROVED") && (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="text-xs font-semibold text-red-500 hover:text-red-700 disabled:opacity-50"
            >
              {cancelling ? "Cancelling…" : "Cancel"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

type Tab = "venues" | "resources";

export default function MyBookingsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("venues");
  const [venueBookings, setVenueBookings] = useState<VenueBooking[]>([]);
  const [resourceBookings, setResourceBookings] = useState<ResourceBooking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuthState();
    if (!auth) { router.replace("/login"); return; }

    Promise.all([getMyVenueBookings(), getMyResourceBookings()])
      .then(([vd, rd]) => {
        setVenueBookings(vd.bookings);
        setResourceBookings(rd.bookings);
      })
      .finally(() => setLoading(false));
  }, [router]);

  const skeletonRows = Array.from({ length: 3 }, (_, i) => (
    <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
  ));

  const tabs: { key: Tab; label: string; count: number; icon: React.ReactNode }[] = [
    { key: "venues",    label: "Venue Bookings",    count: venueBookings.length,    icon: <Building2 size={16} /> },
    { key: "resources", label: "Resource Bookings", count: resourceBookings.length, icon: <Package size={16} /> },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Bookings</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track your venue and resource booking requests</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/venues"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            <Building2 size={14} /> Venues
          </Link>
          <Link
            href="/resources"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            <Package size={14} /> Resources
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === t.key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.icon}
            {t.label}
            {!loading && t.count > 0 && (
              <span
                className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                  tab === t.key ? "bg-[#EBA814]/10 text-[#EBA814]" : "bg-gray-200 text-gray-600"
                }`}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        {loading ? (
          <div className="space-y-3">{skeletonRows}</div>
        ) : tab === "venues" ? (
          venueBookings.length === 0 ? (
            <div className="text-center py-12">
              <Building2 size={36} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No venue bookings yet</p>
              <Link
                href="/venues"
                className="mt-3 inline-flex items-center gap-1.5 text-sm text-[#EBA814] font-semibold hover:underline"
              >
                Browse venues <ArrowRight size={13} />
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {venueBookings.map((b) => (
                <VenueBookingRow
                  key={b.id}
                  booking={b}
                  onCancel={(id) =>
                    setVenueBookings((prev) =>
                      prev.map((x) => (x.id === id ? { ...x, status: "CANCELLED" } : x)),
                    )
                  }
                />
              ))}
            </div>
          )
        ) : resourceBookings.length === 0 ? (
          <div className="text-center py-12">
            <Package size={36} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No resource bookings yet</p>
            <Link
              href="/resources"
              className="mt-3 inline-flex items-center gap-1.5 text-sm text-[#EBA814] font-semibold hover:underline"
            >
              Browse resources <ArrowRight size={13} />
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {resourceBookings.map((b) => (
              <ResourceBookingRow
                key={b.id}
                booking={b}
                onCancel={(id) =>
                  setResourceBookings((prev) =>
                    prev.map((x) => (x.id === id ? { ...x, status: "CANCELLED" } : x)),
                  )
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
