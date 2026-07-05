"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Monitor, Trash2, ShieldAlert, Clock, MapPin, LogOut } from "lucide-react";
import { getSessions, revokeSession, revokeAllSessions, type SessionInfo } from "@/lib/search";
import { clearAuthState } from "@/lib/tokenStorage";
import { useRouter } from "next/navigation";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseUserAgent(ua: string | null) {
  if (!ua) return "Unknown device";
  if (ua.includes("Mobile") || ua.includes("Android")) return "Mobile browser";
  if (ua.includes("Chrome")) return "Chrome (desktop)";
  if (ua.includes("Firefox")) return "Firefox (desktop)";
  if (ua.includes("Safari")) return "Safari (desktop)";
  return "Desktop browser";
}

function SessionCard({
  session,
  onRevoke,
  revoking,
}: {
  session: SessionInfo;
  onRevoke: (id: string) => void;
  revoking: boolean;
}) {
  const isExpired = new Date(session.expiresAt) < new Date();
  const deviceName = parseUserAgent(session.userAgent);

  return (
    <div className={`flex items-start gap-4 p-4 bg-white rounded-xl border transition-colors ${isExpired ? "border-gray-100 opacity-60" : "border-gray-100 hover:border-gray-200"}`}>
      <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 text-gray-500">
        <Monitor size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 text-sm">{deviceName}</p>
        {session.ipAddress && (
          <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-400">
            <MapPin size={11} />
            {session.ipAddress}
          </div>
        )}
        <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-400">
          <Clock size={11} />
          Started {formatDate(session.createdAt)}
        </div>
        <div className="mt-0.5 text-xs">
          {isExpired ? (
            <span className="text-red-400">Expired</span>
          ) : (
            <span className="text-green-600">Active · expires {formatDate(session.expiresAt)}</span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onRevoke(session.id)}
        disabled={revoking}
        className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
        title="Revoke session"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}

export default function SessionsPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["sessions"],
    queryFn: getSessions,
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokeSession(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      setRevokingId(null);
    },
  });

  const revokeAllMutation = useMutation({
    mutationFn: revokeAllSessions,
    onSuccess: () => {
      clearAuthState();
      router.push("/login");
    },
  });

  const handleRevoke = (id: string) => {
    setRevokingId(id);
    revokeMutation.mutate(id);
  };

  const sessions = data?.sessions ?? [];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Active Sessions</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage where your account is currently signed in. Revoking a session will sign out that device.
        </p>
      </div>

      {/* Security notice */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-100">
        <ShieldAlert size={18} className="text-[#EBA814] flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800">
          If you see a session you don't recognize, revoke it immediately and change your password.
        </p>
      </div>

      {/* Sessions list */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && sessions.length === 0 && (
        <div className="text-center py-10">
          <Monitor size={36} className="mx-auto text-gray-300 mb-2" />
          <p className="text-gray-500 text-sm">No active sessions found.</p>
        </div>
      )}

      {!isLoading && sessions.length > 0 && (
        <div className="space-y-3">
          {sessions.map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              onRevoke={handleRevoke}
              revoking={revokingId === s.id && revokeMutation.isPending}
            />
          ))}
        </div>
      )}

      {/* Revoke all */}
      {!isLoading && sessions.length > 0 && (
        <div className="pt-2 border-t border-gray-100">
          {!confirmAll ? (
            <button
              type="button"
              onClick={() => setConfirmAll(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors"
            >
              <LogOut size={15} />
              Sign out of all sessions
            </button>
          ) : (
            <div className="flex items-center gap-3 p-4 bg-red-50 rounded-xl border border-red-100">
              <p className="flex-1 text-sm text-red-800">
                This will sign you out of every device, including this one. Continue?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmAll(false)}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:bg-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => revokeAllMutation.mutate()}
                  disabled={revokeAllMutation.isPending}
                  className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {revokeAllMutation.isPending ? "Signing out…" : "Sign out all"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
