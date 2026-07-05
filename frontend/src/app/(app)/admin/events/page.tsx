"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, ChevronLeft, ChevronRight, ExternalLink, CheckSquare, Square, CheckCheck } from "lucide-react";
import { listAdminEvents, bulkApproveEvents } from "@/lib/admin";
import { toast } from "sonner";

const STATUS_OPTIONS = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "CANCELLED"];

const statusColors: Record<string, string> = {
  DRAFT:            "bg-gray-100 text-gray-600",
  PENDING_APPROVAL: "bg-yellow-100 text-yellow-700",
  APPROVED:         "bg-green-100 text-green-700",
  REJECTED:         "bg-red-100 text-red-700",
  CANCELLED:        "bg-orange-100 text-orange-700",
};

export default function AdminEventsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [qInput, setQInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-events", page, q, statusFilter],
    queryFn: () => listAdminEvents({ page, q: q || undefined, status: statusFilter || undefined }),
  });

  const bulkApproveMut = useMutation({
    mutationFn: (ids: string[]) => bulkApproveEvents(ids),
    onSuccess: (d) => {
      toast.success(d.message);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["admin-events"] });
    },
    onError: () => toast.error("Bulk approve failed"),
  });

  const events = data?.events ?? [];
  const allSelected = events.length > 0 && events.every(e => selected.has(e.id));
  const toggle = (id: string) => setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(events.map(e => e.id)));

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Event Oversight</h1>
        <p className="text-sm text-gray-500 mt-1">View all events across all statuses. Select pending events to bulk approve.</p>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by title…"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { setQ(qInput); setPage(1); } }}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 text-sm bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-[#EBA814]/40"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-[#EBA814]/40"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </select>
        <button
          onClick={() => { setQ(qInput); setPage(1); }}
          className="px-4 py-2 rounded-xl bg-[#EBA814] text-white text-sm font-medium hover:bg-[#d9970f]"
        >
          Search
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden">
        {isLoading && <div className="p-12 text-center text-gray-400 text-sm">Loading events…</div>}
        {error && <div className="p-12 text-center text-red-500 text-sm">Failed to load events.</div>}
        {data && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-zinc-800/50 text-gray-500 dark:text-zinc-400 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 w-10">
                      <button onClick={toggleAll}>
                        {allSelected ? <CheckSquare size={16} className="text-[#EBA814]" /> : <Square size={16} />}
                      </button>
                    </th>
                    <th className="text-left px-5 py-3">Event</th>
                    <th className="text-left px-5 py-3">Club</th>
                    <th className="text-left px-5 py-3">Status</th>
                    <th className="text-left px-5 py-3">Attendees</th>
                    <th className="text-left px-5 py-3">Date</th>
                    <th className="text-left px-5 py-3">Submitted by</th>
                    <th className="text-right px-5 py-3">View</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
                  {events.map((e) => (
                    <tr key={e.id} className={`hover:bg-gray-50/50 dark:hover:bg-zinc-800/50 transition-colors ${selected.has(e.id) ? "bg-[#EBA814]/5" : ""}`}>
                      <td className="px-4 py-3">
                        <button onClick={() => toggle(e.id)}>
                          {selected.has(e.id) ? <CheckSquare size={16} className="text-[#EBA814]" /> : <Square size={16} className="text-gray-300" />}
                        </button>
                      </td>
                      <td className="px-5 py-3">
                        <div className="font-medium text-gray-900 dark:text-white">{e.title}</div>
                        <div className="text-xs text-gray-400">{e.category} · {e.location}</div>
                        {e.approvalNote && (
                          <div className="text-xs text-red-500 mt-0.5 line-clamp-1" title={e.approvalNote}>
                            Note: {e.approvalNote}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <Link href={`/clubs/${e.club.slug}`} className="text-[#EBA814] hover:underline">{e.club.name}</Link>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[e.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {e.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-600 dark:text-zinc-300">{e._count.attendees}</td>
                      <td className="px-5 py-3 text-gray-500 text-xs">{new Date(e.startsAt).toLocaleDateString()}</td>
                      <td className="px-5 py-3 text-gray-600 dark:text-zinc-300">{e.createdBy.name}</td>
                      <td className="px-5 py-3 text-right">
                        <Link href={`/events/${e.id}`} className="p-1.5 inline-flex rounded-lg text-gray-400 hover:text-[#EBA814] hover:bg-[#EBA814]/10">
                          <ExternalLink size={15} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {events.length === 0 && (
                    <tr><td colSpan={8} className="px-5 py-12 text-center text-gray-400">No events found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-zinc-800 text-sm text-gray-500">
              <span>{data.total} total</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-30">
                  <ChevronLeft size={16} />
                </button>
                <span>Page {data.page} of {data.pages || 1}</span>
                <button onClick={() => setPage((p) => Math.min(data.pages, p + 1))} disabled={page >= data.pages} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-30">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Bulk action toolbar */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-5 py-3 rounded-2xl shadow-2xl">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <div className="w-px h-4 bg-gray-600 dark:bg-gray-300" />
          <button
            onClick={() => bulkApproveMut.mutate(Array.from(selected))}
            disabled={bulkApproveMut.isPending}
            className="flex items-center gap-1.5 text-sm font-semibold text-green-400 dark:text-green-600 hover:text-green-300 dark:hover:text-green-700 disabled:opacity-50"
          >
            <CheckCheck size={16} /> Approve All
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-sm text-gray-400 dark:text-gray-500 hover:text-white dark:hover:text-gray-700"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
