"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MapPin, Users, Search, Plus, Building2, ChevronRight,
  Wifi, Tv, Wind, Dumbbell, Music, Star,
} from "lucide-react";
import { listVenues, createVenue } from "@/lib/venues";
import type { Venue } from "@/lib/venues";
import { getAuthState } from "@/lib/tokenStorage";

const facilityIcons: Record<string, React.ReactNode> = {
  "WiFi":         <Wifi size={12} />,
  "Projector":    <Tv size={12} />,
  "AC":           <Wind size={12} />,
  "Sound System": <Music size={12} />,
  "Gym":          <Dumbbell size={12} />,
};

function FacilityTag({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
      {facilityIcons[label] ?? <Star size={11} />}
      {label}
    </span>
  );
}

function VenueCard({ venue }: { venue: Venue }) {
  return (
    <Link
      href={`/venues/${venue.id}`}
      className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow p-6 flex flex-col gap-4 group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="w-12 h-12 rounded-xl bg-[#EBA814]/10 flex items-center justify-center text-[#EBA814] flex-shrink-0">
          <Building2 size={22} />
        </div>
        <ChevronRight
          size={16}
          className="text-gray-300 group-hover:text-[#EBA814] transition-colors mt-1 flex-shrink-0"
        />
      </div>

      <div className="flex-1">
        <h3 className="text-base font-bold text-gray-900 group-hover:text-[#EBA814] transition-colors">
          {venue.name}
        </h3>
        <div className="flex items-center gap-1 mt-1 text-sm text-gray-500">
          <MapPin size={13} className="flex-shrink-0" />
          <span className="truncate">{venue.location}</span>
        </div>
        {venue.description && (
          <p className="mt-2 text-sm text-gray-500 line-clamp-2">{venue.description}</p>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-semibold">
          <Users size={12} />
          {venue.capacity} capacity
        </span>
        {venue.facilities.slice(0, 3).map((f) => (
          <FacilityTag key={f} label={f} />
        ))}
        {venue.facilities.length > 3 && (
          <span className="text-xs text-gray-400">+{venue.facilities.length - 3} more</span>
        )}
      </div>
    </Link>
  );
}

// ── Add Venue Modal ──────────────────────────────────────────────────────────

function AddVenueModal({ onClose, onCreated }: { onClose: () => void; onCreated: (v: Venue) => void }) {
  const [form, setForm] = useState({
    name: "", location: "", description: "", capacity: "", facilities: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const facilitiesArr = form.facilities
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean);
      const { venue } = await createVenue({
        name: form.name,
        location: form.location,
        description: form.description || undefined,
        capacity: Number(form.capacity),
        facilities: facilitiesArr,
      });
      onCreated(venue);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create venue";
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
        <h2 className="text-lg font-bold text-gray-900 mb-5">Add New Venue</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}
          {(
            [
              { label: "Venue Name", key: "name", type: "text", required: true },
              { label: "Location", key: "location", type: "text", required: true },
              { label: "Capacity", key: "capacity", type: "number", required: true },
            ] as const
          ).map(({ label, key, type, required }) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
              <input
                type={type}
                required={required}
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#EBA814]/40"
              />
            </div>
          ))}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#EBA814]/40 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Facilities <span className="font-normal text-gray-400">(comma-separated)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. WiFi, Projector, AC"
              value={form.facilities}
              onChange={(e) => setForm((f) => ({ ...f, facilities: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#EBA814]/40"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 rounded-xl bg-[#EBA814] text-white text-sm font-semibold hover:bg-[#d4960f] disabled:opacity-50"
            >
              {saving ? "Creating…" : "Create Venue"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function VenuesPage() {
  const router = useRouter();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const auth = getAuthState();
    if (!auth) { router.replace("/login"); return; }
    setIsAdmin(auth.user.role === "UNIVERSITY_ADMIN" || auth.user.role === "SYSTEM_ADMIN");
  }, [router]);

  useEffect(() => {
    const params = search ? { search } : undefined;
    listVenues(params)
      .then((d) => setVenues(d.venues))
      .finally(() => setLoading(false));
  }, [search]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Venues</h1>
          <p className="text-sm text-gray-500 mt-0.5">Browse and book spaces for your events</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/my-bookings"
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            My Bookings
          </Link>
          {isAdmin && (
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#EBA814] text-white text-sm font-semibold hover:bg-[#d4960f] transition-colors"
            >
              <Plus size={16} />
              Add Venue
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search venues by name or location…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#EBA814]/40 bg-white"
        />
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-52 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : venues.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-16 text-center">
          <Building2 size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">
            {search ? "No venues match your search" : "No venues available yet"}
          </p>
          {isAdmin && !search && (
            <button
              onClick={() => setShowAdd(true)}
              className="mt-4 inline-flex items-center gap-2 text-sm text-[#EBA814] font-semibold hover:underline"
            >
              <Plus size={14} /> Add the first venue
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {venues.map((venue) => (
            <VenueCard key={venue.id} venue={venue} />
          ))}
        </div>
      )}

      {showAdd && (
        <AddVenueModal
          onClose={() => setShowAdd(false)}
          onCreated={(v) => {
            setVenues((prev) => [v, ...prev]);
            setShowAdd(false);
          }}
        />
      )}
    </div>
  );
}
