"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Shield, ChevronLeft, ChevronRight, Search, Filter } from "lucide-react";
import { getAuditLog, type AuditEntry } from "@/lib/admin";
import { format } from "date-fns";

const ACTION_COLORS: Record<string, string> = {
  APPROVE_CLUB:           "bg-green-100 text-green-700",
  REJECT_CLUB:            "bg-red-100 text-red-700",
  APPROVE_EVENT:          "bg-green-100 text-green-700",
  REJECT_EVENT:           "bg-red-100 text-red-700",
  SUSPEND_USER:           "bg-red-100 text-red-700",
  ACTIVATE_USER:          "bg-green-100 text-green-700",
  CHANGE_ROLE:            "bg-blue-100 text-blue-700",
  RESOLVE_CONTENT_REPORT: "bg-purple-100 text-purple-700",
  DISMISS_CONTENT_REPORT: "bg-gray-100 text-gray-700",
  UPSERT_SETTING:         "bg-yellow-100 text-yellow-700",
};

const ACTION_LABELS: Record<string, string> = [
  "APPROVE_CLUB", "REJECT_CLUB", "APPROVE_EVENT", "REJECT_EVENT",
  "SUSPEND_USER", "ACTIVATE_USER", "CHANGE_ROLE",
  "RESOLVE_CONTENT_REPORT", "DISMISS_CONTENT_REPORT", "UPSERT_SETTING",
].reduce<Record<string, string>>((acc, a) => ({ ...acc, [a]: a }), {});

function ActionBadge({ action }: { action: string }) {
  const color = ACTION_COLORS[action] ?? "bg-gray-100 text-gray-700";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {action.replace(/_/g, " ")}
    </span>
  );
}

function DetailPopover({ details }: { details: Record<string, unknown> }) {
  const keys = Object.keys(details);
  if (keys.length === 0) return <span className="text-gray-400 text-xs">—</span>;
  return (
    <span className="text-xs text-gray-500 font-mono truncate max-w-[200px] block">
      {keys.map(k => `${k}:${String(details[k])}`).join(", ")}
    </span>
  );
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
      <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500 dark:text-zinc-400">
        {format(new Date(entry.createdAt), "MMM d, yyyy HH:mm:ss")}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-[#EBA814]/20 flex items-center justify-center text-[#EBA814] font-bold text-xs flex-shrink-0">
            {entry.actor.name.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">{entry.actor.name}</p>
            <p className="text-xs text-gray-400">{entry.actor.email}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <ActionBadge action={entry.action} />
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500 dark:text-zinc-400">
        <span className="font-medium text-gray-700 dark:text-zinc-300">{entry.targetType}</span>
        <span className="ml-1 font-mono opacity-60">{entry.targetId.slice(0, 8)}…</span>
      </td>
      <td className="px-4 py-3">
        <DetailPopover details={entry.details} />
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-400 font-mono">
        {entry.ipAddress ?? "—"}
      </td>
    </tr>
  );
}

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [qInput, setQInput] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["audit-log", page, actionFilter, from, to, q],
    queryFn: () => getAuditLog({
      page,
      action: actionFilter || undefined,
      from: from || undefined,
      to: to || undefined,
      q: q || undefined,
    }),
  });

  const totalPages = data?.pages ?? 1;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-900/30">
          <Shield size={20} className="text-purple-600 dark:text-purple-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Audit Log</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400">All administrative actions recorded for accountability</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1">Search Actor</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={qInput}
                onChange={e => setQInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { setQ(qInput); setPage(1); } }}
                placeholder="Actor name…"
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1">Action Type</label>
            <select
              value={actionFilter}
              onChange={e => { setActionFilter(e.target.value); setPage(1); }}
              className="py-2 px-3 text-sm border border-gray-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-white"
            >
              <option value="">All Actions</option>
              {Object.keys(ACTION_LABELS).map(a => (
                <option key={a} value={a}>{a.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1">From</label>
            <input
              type="date"
              value={from}
              onChange={e => { setFrom(e.target.value); setPage(1); }}
              className="py-2 px-3 text-sm border border-gray-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1">To</label>
            <input
              type="date"
              value={to}
              onChange={e => { setTo(e.target.value); setPage(1); }}
              className="py-2 px-3 text-sm border border-gray-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-white"
            />
          </div>

          <button
            onClick={() => { setQ(qInput); setPage(1); }}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-[#EBA814] text-white rounded-lg hover:bg-[#d49612] transition-colors"
          >
            <Filter size={14} /> Filter
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400">Loading audit log…</div>
        ) : error ? (
          <div className="p-12 text-center text-red-500">Failed to load audit log.</div>
        ) : !data?.entries.length ? (
          <div className="p-12 text-center text-gray-400">No audit log entries found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-zinc-800/50 border-b border-gray-100 dark:border-zinc-800">
                <tr>
                  {["Timestamp", "Actor", "Action", "Target", "Details", "IP Address"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
                {data.entries.map(entry => <AuditRow key={entry.id} entry={entry} />)}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {data && data.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-zinc-800">
            <p className="text-sm text-gray-500 dark:text-zinc-400">
              {data.total} entries · Page {data.page} of {data.pages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
