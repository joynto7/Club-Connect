"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  MapPin, Users, Clock, ArrowLeft, Building2,
  CheckCircle, AlertCircle, Calendar,
} from "lucide-react";
import { getVenue, createVenueBooking } from "@/lib/venues";
import type { VenueWithBookings } from "@/lib/venues";
import { getMyClubs } from "@/lib/auth";
import type { MyClub } from "@/lib/auth";
import { getAuthState } from "@/lib/tokenStorage";

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function toLocalInputVal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── Booking Form ─────────────────────────────────────────────────────────────

function BookingForm({
  venueId,
  myClubs,
  onSuccess,
}: {
  venueId: string;
  myClubs: MyClub[];
  onSuccess: () => void;
}) {
  const now = new Date();
  now.setMinutes(Math.ceil(now.getMinutes() / 30) * 30, 0, 0);
  const later = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  const [form, setForm] = useState({
    startTime: toLocalInputVal(now),
    endTime: toLocalInputVal(later),
    purpose: "",
    clubId: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await createVenueBooking(venueId, {
        startTime: new Date(form.startTime).toISOString(),
        endTime: new Date(form.endTime).toISOString(),
        purpose: form.purpose,
        clubId: form.clubId || undefined,
      });
      setSuccess(true);
      onSuccess();
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          "Failed to submit booking",
      );
    } finally {
      setSaving(false);
    }
  };

  if (success) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
        <CheckCircle size={32} className="text-green-500 mx-auto mb-3" />
        <p className="font-semibold text-green-800">Booking request submitted!</p>
        <p className="text-sm text-green-600 mt-1">
          An admin will review your request shortly.
        </p>
        <Link
          href="/my-bookings"
          className="mt-4 inline-block text-sm font-semibold text-green-700 hover:underline"
        >
          View my bookings →
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
          <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Start Time</label>
          <input
            type="datetime-local"
            required
            value={form.startTime}
            onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#EBA814]/40"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">End Time</label>
          <input
            type="datetime-local"
            required
            value={form.endTime}
            onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#EBA814]/40"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Purpose / Event Description</label>
        <textarea
          required
          rows={3}
          placeholder="Describe how you plan to use this venue…"
          value={form.purpose}
          onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#EBA814]/40 resize-none"
        />
      </div>

      {myClubs.length > 0 && (
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Link to Club <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <select
            value={form.clubId}
            onChange={(e) => setForm((f) => ({ ...f, clubId: e.target.value }))}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#EBA814]/40 bg-white"
          >
            <option value="">— Select a club —</option>
            {myClubs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="w-full py-2.5 rounded-xl bg-[#EBA814] text-white font-semibold text-sm hover:bg-[#d4960f] disabled:opacity-50 transition-colors"
      >
        {saving ? "Submitting…" : "Submit Booking Request"}
      </button>
    </form>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function VenueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [venue, setVenue] = useState<VenueWithBookings | null>(null);
  const [myClubs, setMyClubs] = useState<MyClub[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const auth = getAuthState();
    if (!auth) { router.replace("/login"); return; }

    Promise.all([
      getVenue(id),
      auth ? getMyClubs() : Promise.resolve({ clubs: [] }),
    ])
      .then(([vData, cData]) => {
        setVenue(vData.venue);
        setMyClubs(cData.clubs);
      })
      .catch(() => router.replace("/venues"))
      .finally(() => setLoading(false));
  }, [id, router, refreshKey]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-gray-100 rounded-xl" />
        <div className="h-48 bg-gray-100 rounded-2xl" />
        <div className="h-64 bg-gray-100 rounded-2xl" />
      </div>
    );
  }

  if (!venue) return null;

  const upcomingBookings = venue.bookings.filter(
    (b) => new Date(b.endTime) > new Date(),
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back */}
      <Link
        href="/venues"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft size={16} />
        Back to Venues
      </Link>

      {/* Venue header */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#EBA814]/10 flex items-center justify-center text-[#EBA814] flex-shrink-0">
            <Building2 size={26} />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">{venue.name}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <MapPin size={13} /> {venue.location}
              </span>
              <span className="flex items-center gap-1">
                <Users size={13} /> {venue.capacity} capacity
              </span>
            </div>
            {venue.description && (
              <p className="mt-3 text-sm text-gray-600 leading-relaxed">{venue.description}</p>
            )}
            {venue.facilities.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {venue.facilities.map((f) => (
                  <span
                    key={f}
                    className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium"
                  >
                    {f}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Booking form */}
        <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-base font-bold text-gray-900 mb-4">Request a Booking</h2>
          <p className="text-xs text-gray-500 mb-5">
            Bookings require admin approval. You&apos;ll be able to track the status under{" "}
            <Link href="/my-bookings" className="text-[#EBA814] hover:underline">
              My Bookings
            </Link>
            .
          </p>
          <BookingForm
            venueId={id}
            myClubs={myClubs}
            onSuccess={() => setRefreshKey((k) => k + 1)}
          />
        </div>

        {/* Upcoming bookings */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={16} className="text-gray-400" />
            <h2 className="text-base font-bold text-gray-900">Upcoming Bookings</h2>
          </div>
          {upcomingBookings.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle size={28} className="text-green-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No upcoming bookings — slot is free!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingBookings.map((b) => (
                <div key={b.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <p className="text-xs font-semibold text-gray-700 truncate">{b.purpose}</p>
                  <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                    <Clock size={11} />
                    <span>{fmt(b.startTime)} – {fmt(b.endTime)}</span>
                  </div>
                  {b.club && (
                    <p className="text-xs text-gray-400 mt-0.5">by {b.club.name}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
