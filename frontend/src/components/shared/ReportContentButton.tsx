"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Flag, X } from "lucide-react";
import { submitContentReport } from "@/lib/admin";

type TargetType = "EVENT" | "CLUB" | "ANNOUNCEMENT" | "USER";

const REASONS = [
  "Inappropriate content",
  "Spam or misleading information",
  "Harassment or bullying",
  "Hate speech",
  "Unauthorized use of images",
  "Violates club policies",
  "Other",
];

interface Props {
  targetType: TargetType;
  targetId: string;
  targetName?: string;
}

export default function ReportContentButton({ targetType, targetId, targetName }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const mut = useMutation({
    mutationFn: () => submitContentReport({ targetType, targetId, reason, description: description || undefined }),
    onSuccess: () => { setSubmitted(true); },
  });

  const handleClose = () => {
    setOpen(false);
    setReason("");
    setDescription("");
    setSubmitted(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors"
        title="Report this content"
      >
        <Flag size={13} />
        Report
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Report {targetType.toLowerCase()}{targetName ? `: ${targetName}` : ""}</h2>
              <button onClick={handleClose}><X size={18} className="text-gray-400" /></button>
            </div>

            {submitted ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-3">
                  <Flag size={22} className="text-green-500" />
                </div>
                <p className="font-medium text-gray-900">Report submitted</p>
                <p className="text-sm text-gray-500 mt-1">Our team will review it shortly.</p>
                <button onClick={handleClose} className="mt-4 px-4 py-2 rounded-xl bg-gray-100 text-sm text-gray-700 hover:bg-gray-200">
                  Close
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-gray-700 mb-1.5 block">Reason *</label>
                    <select
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#EBA814]/40"
                    >
                      <option value="">Select a reason…</option>
                      {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700 mb-1.5 block">Additional details (optional)</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe the issue…"
                      rows={3}
                      className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#EBA814]/40"
                    />
                  </div>
                </div>
                {mut.isError && <p className="text-xs text-red-500 mt-2">Failed to submit. Please try again.</p>}
                <div className="flex gap-3 mt-4">
                  <button onClick={handleClose} className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                  <button
                    onClick={() => mut.mutate()}
                    disabled={!reason || mut.isPending}
                    className="flex-1 py-2 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-60"
                  >
                    {mut.isPending ? "Submitting…" : "Submit Report"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
