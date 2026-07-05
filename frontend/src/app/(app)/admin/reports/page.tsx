"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listReports,
  generateReport,
  downloadReport,
  deleteReport,
  type ReportType,
  type ReportFormat,
  type Report,
} from "@/lib/reports";
import { listClubs } from "@/lib/clubs";
import { listEvents } from "@/lib/events";
import {
  FileText,
  Download,
  Trash2,
  Plus,
  RefreshCw,
  ChevronDown,
  CheckCircle2,
} from "lucide-react";

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const TYPE_LABELS: Record<ReportType, string> = {
  MEMBERS:    "Club Member List",
  ATTENDANCE: "Event Attendance",
  EVENTS:     "All Events",
  SYSTEM:     "System Overview",
};

const TYPE_DESCRIPTIONS: Record<ReportType, string> = {
  MEMBERS:    "All approved members of a club with role, department, and join date.",
  ATTENDANCE: "Registrations and check-in status for a specific event.",
  EVENTS:     "All events across the platform with registration and capacity stats.",
  SYSTEM:     "Platform-wide metrics: users, clubs, events, attendance, and feedback.",
};

const FORMAT_COLOR: Record<ReportFormat, string> = {
  CSV: "bg-green-100 text-green-700",
  PDF: "bg-red-100 text-red-700",
};

const TYPE_COLOR: Record<ReportType, string> = {
  MEMBERS:    "bg-purple-100 text-purple-700",
  ATTENDANCE: "bg-blue-100 text-blue-700",
  EVENTS:     "bg-orange-100 text-orange-700",
  SYSTEM:     "bg-gray-100 text-gray-700",
};

// ── Generate form ─────────────────────────────────────────────────────────────

function GeneratePanel({ onGenerated }: { onGenerated: () => void }) {
  const [type, setType]     = useState<ReportType>("SYSTEM");
  const [format, setFormat] = useState<ReportFormat>("CSV");
  const [clubId, setClubId] = useState("");
  const [eventId, setEventId] = useState("");
  const [error, setError]   = useState("");
  const [success, setSuccess] = useState(false);

  const { data: clubs  } = useQuery({ queryKey: ["clubs"],  queryFn: () => listClubs() });
  const { data: eventsData } = useQuery({ queryKey: ["events-all"], queryFn: () => listEvents() });

  const generate = useMutation({
    mutationFn: () =>
      generateReport({
        type,
        format,
        clubId:  type === "MEMBERS"    ? clubId    : undefined,
        eventId: type === "ATTENDANCE" ? eventId   : undefined,
      }),
    onSuccess: () => {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      onGenerated();
    },
    onError: (e: Error) => setError(e.message),
  });

  const needsClub  = type === "MEMBERS";
  const needsEvent = type === "ATTENDANCE";

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Plus size={16} className="text-[#EBA814]" />
        Generate New Report
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Report type */}
        <div className="sm:col-span-2">
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2 block">
            Report Type
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(Object.keys(TYPE_LABELS) as ReportType[]).map((t) => (
              <button
                key={t}
                onClick={() => { setType(t); setClubId(""); setEventId(""); setError(""); }}
                className={`p-3 rounded-xl border text-left transition-all ${
                  type === t
                    ? "border-[#EBA814] bg-[#FFF8E7]"
                    : "border-gray-100 hover:border-gray-200"
                }`}
              >
                <p className="text-xs font-bold text-gray-900">{TYPE_LABELS[t]}</p>
                <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{TYPE_DESCRIPTIONS[t]}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Club selector */}
        {needsClub && (
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 block">
              Select Club
            </label>
            <div className="relative">
              <select
                value={clubId}
                onChange={(e) => setClubId(e.target.value)}
                className="w-full appearance-none border border-gray-200 rounded-xl px-3 py-2.5 text-sm pr-8 focus:outline-none focus:ring-2 focus:ring-[#EBA814]/40"
              >
                <option value="">— Choose a club —</option>
                {clubs?.clubs?.filter((c: { status: string }) => c.status === "ACTIVE").map((c: { id: string; name: string }) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>
        )}

        {/* Event selector */}
        {needsEvent && (
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 block">
              Select Event
            </label>
            <div className="relative">
              <select
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                className="w-full appearance-none border border-gray-200 rounded-xl px-3 py-2.5 text-sm pr-8 focus:outline-none focus:ring-2 focus:ring-[#EBA814]/40"
              >
                <option value="">— Choose an event —</option>
                {eventsData?.events?.map((e) => (
                  <option key={e.id} value={e.id}>{e.title} ({e.club?.name ?? ""})</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>
        )}

        {/* Format */}
        <div>
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 block">
            Format
          </label>
          <div className="flex gap-2">
            {(["CSV", "PDF"] as ReportFormat[]).map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                  format === f
                    ? "border-[#EBA814] bg-[#FFF8E7] text-[#EBA814]"
                    : "border-gray-200 text-gray-500 hover:border-gray-300"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Generate button */}
        <div className="flex items-end">
          <button
            onClick={() => { setError(""); generate.mutate(); }}
            disabled={generate.isPending || (needsClub && !clubId) || (needsEvent && !eventId)}
            className="w-full py-2.5 bg-[#EBA814] text-white font-semibold text-sm rounded-xl hover:bg-[#d4980e] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {generate.isPending ? (
              <><RefreshCw size={14} className="animate-spin" /> Generating…</>
            ) : success ? (
              <><CheckCircle2 size={14} /> Downloaded!</>
            ) : (
              <><Download size={14} /> Generate &amp; Download</>
            )}
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}
    </div>
  );
}

// ── Report row ────────────────────────────────────────────────────────────────

function ReportRow({ report, onDelete }: { report: Report; onDelete: () => void }) {
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting]       = useState(false);
  const [error, setError]             = useState("");

  const handleDownload = async () => {
    setDownloading(true);
    setError("");
    try {
      await downloadReport(report.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteReport(report.id);
      onDelete();
    } catch (e) {
      setError((e as Error).message);
      setDeleting(false);
    }
  };

  return (
    <div className="flex items-center gap-4 p-4 bg-[#FAFAFA] rounded-xl border border-gray-100 group">
      <div className="flex-shrink-0">
        <FileText size={20} className="text-gray-400" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-gray-900 truncate">{report.name}</p>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${TYPE_COLOR[report.type]}`}>
            {TYPE_LABELS[report.type]}
          </span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${FORMAT_COLOR[report.format]}`}>
            {report.format}
          </span>
        </div>
        <p className="text-xs text-gray-400 mt-0.5">
          {fmtDate(report.createdAt)} · by {report.generatedBy.name}
        </p>
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={handleDownload}
          disabled={downloading}
          title="Re-download"
          className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors disabled:opacity-50"
        >
          {downloading ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          title="Delete record"
          className="p-2 rounded-lg border border-gray-200 text-gray-400 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors disabled:opacity-50"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminReportsPage() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["reports"] });

  const { data: reports, isLoading } = useQuery({
    queryKey: ["reports"],
    queryFn: listReports,
  });

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports &amp; Export</h1>
        <p className="text-sm text-gray-500 mt-1">
          Generate and download CSV or PDF reports for members, events, attendance, and system stats.
        </p>
      </div>

      <GeneratePanel onGenerated={invalidate} />

      {/* Report history */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Report History</h2>

        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && (!reports || reports.length === 0) && (
          <div className="text-center py-12 text-gray-400">
            <FileText size={32} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">No reports generated yet.</p>
          </div>
        )}

        {reports && reports.length > 0 && (
          <div className="space-y-2">
            {reports.map((r) => (
              <ReportRow key={r.id} report={r} onDelete={invalidate} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
