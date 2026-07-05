"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search, Plus, Package, CheckCircle, AlertCircle,
  Filter, ArrowRight,
} from "lucide-react";
import {
  listResources, createResourceBooking, createResource,
  RESOURCE_CATEGORIES,
} from "@/lib/venues";
import type { Resource } from "@/lib/venues";
import { getMyClubs } from "@/lib/auth";
import type { MyClub } from "@/lib/auth";
import { getAuthState } from "@/lib/tokenStorage";

function toLocalInputVal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const categoryColors: Record<string, string> = {
  "Audio/Visual":      "bg-purple-50 text-purple-700",
  "Furniture":         "bg-amber-50  text-amber-700",
  "Sports Equipment":  "bg-green-50  text-green-700",
  "Electronics":       "bg-blue-50   text-blue-700",
  "Decorations":       "bg-pink-50   text-pink-700",
  "Catering":          "bg-orange-50 text-orange-700",
  "Transportation":    "bg-teal-50   text-teal-700",
  "General":           "bg-gray-100  text-gray-600",
};

// ── Book Resource Modal ───────────────────────────────────────────────────────

function BookResourceModal({
  resource,
  myClubs,
  onClose,
  onSuccess,
}: {
  resource: Resource;
  myClubs: MyClub[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const now = new Date();
  now.setMinutes(Math.ceil(now.getMinutes() / 30) * 30, 0, 0);
  const later = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  const [form, setForm] = useState({
    startTime: toLocalInputVal(now),
    endTime: toLocalInputVal(later),
    purpose: "",
    quantity: "1",
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
      await createResourceBooking(resource.id, {
        startTime: new Date(form.startTime).toISOString(),
        endTime: new Date(form.endTime).toISOString(),
        purpose: form.purpose,
        quantity: Number(form.quantity),
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
        {success ? (
          <div className="text-center py-4">
            <CheckCircle size={36} className="text-green-500 mx-auto mb-3" />
            <p className="font-bold text-gray-900">Request submitted!</p>
            <p className="text-sm text-gray-500 mt-1">An admin will review your request.</p>
            <div className="flex gap-3 mt-5">
              <button
                onClick={onClose}
                className="flex-1 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50"
              >
                Close
              </button>
              <Link
                href="/my-bookings"
                className="flex-1 py-2 rounded-xl bg-[#EBA814] text-white text-sm font-semibold text-center hover:bg-[#d4960f]"
              >
                View Bookings
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-gray-900">Book: {resource.name}</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {resource.quantity} unit{resource.quantity !== 1 ? "s" : ""} available
                </p>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                  <AlertCircle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Start</label>
                  <input
                    type="datetime-local"
                    required
                    value={form.startTime}
                    onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#EBA814]/40"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">End</label>
                  <input
                    type="datetime-local"
                    required
                    value={form.endTime}
                    onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#EBA814]/40"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Quantity <span className="font-normal text-gray-400">(max {resource.quantity})</span>
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={resource.quantity}
                  value={form.quantity}
                  onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#EBA814]/40"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Purpose</label>
                <textarea
                  required
                  rows={2}
                  placeholder="What will you use this for?"
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
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-3 pt-1">
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
                  {saving ? "Submitting…" : "Submit Request"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

// ── Add Resource Modal ────────────────────────────────────────────────────────

function AddResourceModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (r: Resource) => void;
}) {
  const [form, setForm] = useState({ name: "", category: "General", description: "", quantity: "1" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const { resource } = await createResource({
        name: form.name,
        category: form.category,
        description: form.description || undefined,
        quantity: Number(form.quantity),
      });
      onCreated(resource);
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          "Failed to create resource",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
        <h2 className="text-lg font-bold text-gray-900 mb-5">Add New Resource</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Name</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#EBA814]/40"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#EBA814]/40"
            >
              {RESOURCE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Total Quantity</label>
            <input
              type="number"
              min={1}
              required
              value={form.quantity}
              onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#EBA814]/40"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#EBA814]/40 resize-none"
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
              {saving ? "Creating…" : "Create Resource"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ResourcesPage() {
  const router = useRouter();
  const [resources, setResources] = useState<Resource[]>([]);
  const [myClubs, setMyClubs] = useState<MyClub[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [bookingTarget, setBookingTarget] = useState<Resource | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const auth = getAuthState();
    if (!auth) { router.replace("/login"); return; }
    setIsAdmin(auth.user.role === "UNIVERSITY_ADMIN" || auth.user.role === "SYSTEM_ADMIN");
    getMyClubs().then((d) => setMyClubs(d.clubs));
  }, [router]);

  useEffect(() => {
    const params: { search?: string; category?: string } = {};
    if (search) params.search = search;
    if (category) params.category = category;
    listResources(params)
      .then((d) => setResources(d.resources))
      .finally(() => setLoading(false));
  }, [search, category]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Resources</h1>
          <p className="text-sm text-gray-500 mt-0.5">Request equipment and supplies for your events</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/my-bookings"
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            My Bookings
          </Link>
          {isAdmin && (
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#EBA814] text-white text-sm font-semibold hover:bg-[#d4960f]"
            >
              <Plus size={16} /> Add Resource
            </button>
          )}
        </div>
      </div>

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search resources…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#EBA814]/40 bg-white"
          />
        </div>
        <div className="relative">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="pl-8 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#EBA814]/40 appearance-none"
          >
            <option value="">All Categories</option>
            {RESOURCE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Resource cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-40 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : resources.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-16 text-center">
          <Package size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">
            {search || category ? "No resources match your search" : "No resources available yet"}
          </p>
          {isAdmin && !search && !category && (
            <button
              onClick={() => setShowAdd(true)}
              className="mt-4 inline-flex items-center gap-2 text-sm text-[#EBA814] font-semibold hover:underline"
            >
              <Plus size={14} /> Add the first resource
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {resources.map((resource) => (
            <div
              key={resource.id}
              className="bg-white rounded-2xl shadow-sm p-5 flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="w-11 h-11 rounded-xl bg-[#EBA814]/10 flex items-center justify-center text-[#EBA814] flex-shrink-0">
                  <Package size={20} />
                </div>
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    categoryColors[resource.category] ?? categoryColors.General
                  }`}
                >
                  {resource.category}
                </span>
              </div>

              <div className="flex-1">
                <h3 className="font-bold text-gray-900">{resource.name}</h3>
                {resource.description && (
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{resource.description}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  {resource.quantity} unit{resource.quantity !== 1 ? "s" : ""} total
                </p>
              </div>

              <button
                onClick={() => setBookingTarget(resource)}
                className="flex items-center justify-center gap-2 w-full py-2 rounded-xl bg-[#EBA814]/10 text-[#EBA814] text-sm font-semibold hover:bg-[#EBA814]/20 transition-colors"
              >
                Request Booking <ArrowRight size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {bookingTarget && (
        <BookResourceModal
          resource={bookingTarget}
          myClubs={myClubs}
          onClose={() => setBookingTarget(null)}
          onSuccess={() => setBookingTarget(null)}
        />
      )}

      {showAdd && (
        <AddResourceModal
          onClose={() => setShowAdd(false)}
          onCreated={(r) => {
            setResources((prev) => [r, ...prev]);
            setShowAdd(false);
          }}
        />
      )}
    </div>
  );
}
