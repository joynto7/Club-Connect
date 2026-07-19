"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, Users, ShieldOff, UserX, ShieldCheck, TrendingUp } from "lucide-react";
import { getSystemMonitor } from "@/lib/admin";
import { useRequireCapability } from "@/hooks/useRequireCapability";

function StatTile({ icon, label, value, loading }: {
  icon: React.ReactNode; label: string; value: number | string | undefined; loading: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-[#EBA814]/10 flex items-center justify-center text-[#EBA814] flex-shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-xl font-bold text-gray-900">{loading ? "—" : value ?? 0}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}

export default function SystemMonitorPage() {
  useRequireCapability("viewSystemMonitor");

  const { data, isLoading, error } = useQuery({
    queryKey: ["system-monitor"],
    queryFn: getSystemMonitor,
  });

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">System Monitor</h1>

      {error ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center text-red-500">
          Failed to load system monitor data.
        </div>
      ) : (
      <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatTile icon={<Users size={20} />} label="Total Users" value={data?.totalUsers} loading={isLoading} />
        <StatTile icon={<Activity size={20} />} label="Active Sessions" value={data?.activeSessions} loading={isLoading} />
        <StatTile icon={<UserX size={20} />} label="Suspended Accounts" value={data?.suspendedAccounts} loading={isLoading} />
        <StatTile icon={<ShieldOff size={20} />} label="Locked Out" value={data?.lockedOutAccounts} loading={isLoading} />
        <StatTile icon={<ShieldOff size={20} />} label="Elevated Login Attempts" value={data?.elevatedLoginAttempts} loading={isLoading} />
        <StatTile
          icon={<ShieldCheck size={20} />}
          label="2FA Adoption"
          value={data ? `${Math.round(data.twoFactorAdoption * 100)}%` : undefined}
          loading={isLoading}
        />
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-6">
        <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
          <TrendingUp size={16} className="text-[#EBA814]" /> Signups (last 30 days)
        </h2>
        {isLoading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : !data || data.signupsOverTime.length === 0 ? (
          <p className="text-sm text-gray-500">No signups in the last 30 days.</p>
        ) : (
          <div className="space-y-1">
            {data.signupsOverTime.map((d) => (
              <div key={d.date} className="flex items-center gap-3 text-sm">
                <span className="w-24 text-gray-400 shrink-0">{d.date}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-[#EBA814] rounded-full"
                    style={{ width: `${Math.min(100, d.count * 10)}%` }}
                  />
                </div>
                <span className="w-8 text-right text-gray-600 font-medium">{d.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-6">
        <h2 className="text-base font-bold text-gray-900 mb-4">Recent Admin Actions</h2>
        {isLoading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : !data || data.recentAuditLogs.length === 0 ? (
          <p className="text-sm text-gray-500">No recent admin actions.</p>
        ) : (
          <div className="space-y-2">
            {data.recentAuditLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between text-sm p-2 rounded-lg hover:bg-gray-50">
                <span className="text-gray-700">
                  <span className="font-semibold">{log.actorName}</span> — {log.action.replace(/_/g, " ").toLowerCase()}
                </span>
                <span className="text-xs text-gray-400">{new Date(log.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      </>
      )}
    </div>
  );
}
