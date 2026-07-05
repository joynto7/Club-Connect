"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, CheckCircle, XCircle, X } from "lucide-react";
import { listContentReports, resolveContentReport, dismissContentReport, type ContentReport } from "@/lib/admin";

const statusColors: Record<string, string> = {
  PENDING:   "bg-yellow-100 text-yellow-700",
  RESOLVED:  "bg-green-100 text-green-700",
  DISMISSED: "bg-gray-100 text-gray-600",
};

const targetTypeColors: Record<string, string> = {
  EVENT:        "bg-blue-100 text-blue-700",
  CLUB:         "bg-purple-100 text-purple-700",
  ANNOUNCEMENT: "bg-orange-100 text-orange-700",
  USER:         "bg-red-100 text-red-700",
};

export default function ContentReportsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [actionTarget, setActionTarget] = useState<{ report: ContentReport; action: "resolve" | "dismiss" } | null>(null);
  const [noteInput, setNoteInput] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["content-reports", page, statusFilter],
    queryFn: () => listContentReports({ page, status: statusFilter || undefined }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["content-reports"] });

  const resolveMut = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => resolveContentReport(id, note || undefined),
    onSuccess: () => { setActionTarget(null); setNoteInput(""); invalidate(); },
  });

  const dismissMut = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => dismissContentReport(id, note || undefined),
    onSuccess: () => { setActionTarget(null); setNoteInput(""); invalidate(); },
  });

  const handleAction = () => {
    if (!actionTarget) return;
    const args = { id: actionTarget.report.id, note: noteInput };
    if (actionTarget.action === "resolve") resolveMut.mutate(args);
    else dismissMut.mutate(args);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Content Moderation</h1>
        <p className="text-sm text-gray-500 mt-1">Review and action user-submitted content reports.</p>
      </div>

      {/* Status filter */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 flex gap-2">
        {["PENDING", "RESOLVED", "DISMISSED", ""].map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              statusFilter === s
                ? "bg-[#EBA814] text-white"
                : "bg-gray-50 text-gray-600 hover:bg-gray-100"
            }`}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {isLoading && <div className="p-12 text-center text-gray-400 text-sm">Loading reports…</div>}
        {error && <div className="p-12 text-center text-red-500 text-sm">Failed to load reports.</div>}
        {data && (
          <>
            <div className="divide-y divide-gray-50">
              {data.reports.map((r) => (
                <div key={r.id} className="p-5 hover:bg-gray-50/50">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${targetTypeColors[r.targetType] ?? "bg-gray-100 text-gray-600"}`}>
                          {r.targetType}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[r.status]}`}>
                          {r.status}
                        </span>
                        <span className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="font-medium text-gray-900 text-sm">{r.reason}</p>
                      {r.description && <p className="text-sm text-gray-500 mt-0.5">{r.description}</p>}
                      <div className="text-xs text-gray-400 mt-1">
                        Reported by <span className="font-medium text-gray-600">{r.reporter.name}</span> ({r.reporter.email})
                        {" · "}Target ID: <code className="font-mono bg-gray-100 px-1 rounded">{r.targetId}</code>
                      </div>
                      {r.resolvedBy && (
                        <div className="text-xs text-gray-400 mt-1">
                          {r.status === "RESOLVED" ? "Resolved" : "Dismissed"} by <span className="font-medium text-gray-600">{r.resolvedBy.name}</span>
                          {r.resolvedNote && <> — <span className="italic">{r.resolvedNote}</span></>}
                        </div>
                      )}
                    </div>
                    {r.status === "PENDING" && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => { setActionTarget({ report: r, action: "resolve" }); setNoteInput(""); }}
                          title="Resolve"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50"
                        >
                          <CheckCircle size={16} />
                        </button>
                        <button
                          onClick={() => { setActionTarget({ report: r, action: "dismiss" }); setNoteInput(""); }}
                          title="Dismiss"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                        >
                          <XCircle size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {data.reports.length === 0 && (
                <div className="p-12 text-center text-gray-400">No reports found.</div>
              )}
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 text-sm text-gray-500">
              <span>{data.total} total</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30">
                  <ChevronLeft size={16} />
                </button>
                <span>Page {data.page} of {data.pages || 1}</span>
                <button onClick={() => setPage((p) => Math.min(data.pages, p + 1))} disabled={page >= data.pages} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Action modal */}
      {actionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 capitalize">
                {actionTarget.action} report
              </h2>
              <button onClick={() => setActionTarget(null)}><X size={18} className="text-gray-400" /></button>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              <span className="font-medium">{actionTarget.report.reason}</span>
              {actionTarget.report.description && <><br />{actionTarget.report.description}</>}
            </p>
            <textarea
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder="Admin note (optional)"
              rows={3}
              className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#EBA814]/40"
            />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setActionTarget(null)} className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button
                onClick={handleAction}
                disabled={resolveMut.isPending || dismissMut.isPending}
                className={`flex-1 py-2 rounded-xl text-white text-sm font-medium disabled:opacity-60 ${
                  actionTarget.action === "resolve" ? "bg-green-500 hover:bg-green-600" : "bg-gray-500 hover:bg-gray-600"
                }`}
              >
                {(resolveMut.isPending || dismissMut.isPending) ? "Saving…" : actionTarget.action === "resolve" ? "Mark Resolved" : "Dismiss"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
