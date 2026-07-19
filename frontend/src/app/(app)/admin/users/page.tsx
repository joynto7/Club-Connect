"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, ChevronLeft, ChevronRight, ShieldOff, ShieldCheck, UserCog, X, CheckSquare, Square, UserX } from "lucide-react";
import {
  listAdminUsers, suspendUser, activateUser, changeUserRole, bulkSuspendUsers,
  type AdminUser,
} from "@/lib/admin";
import { toast } from "sonner";
import { useRequireCapability } from "@/hooks/useRequireCapability";

const ROLES = ["STUDENT", "CLUB_OFFICER", "UNIVERSITY_ADMIN", "SYSTEM_ADMIN"];

const roleColors: Record<string, string> = {
  STUDENT: "bg-gray-100 text-gray-700",
  CLUB_OFFICER: "bg-blue-100 text-blue-700",
  UNIVERSITY_ADMIN: "bg-purple-100 text-purple-700",
  SYSTEM_ADMIN: "bg-red-100 text-red-700",
};

export default function AdminUsersPage() {
  useRequireCapability("manageUsers");
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [suspendedFilter, setSuspendedFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Modal state
  const [suspendTarget, setSuspendTarget] = useState<AdminUser | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [roleTarget, setRoleTarget] = useState<AdminUser | null>(null);
  const [newRole, setNewRole] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-users", page, q, roleFilter, suspendedFilter],
    queryFn: () => listAdminUsers({ page, q: q || undefined, role: roleFilter || undefined, suspended: suspendedFilter || undefined }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-users"] });

  const suspendMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => suspendUser(id, reason || undefined),
    onSuccess: () => { setSuspendTarget(null); setSuspendReason(""); invalidate(); },
  });

  const activateMut = useMutation({
    mutationFn: (id: string) => activateUser(id),
    onSuccess: invalidate,
  });

  const bulkSuspendMut = useMutation({
    mutationFn: (ids: string[]) => bulkSuspendUsers(ids),
    onSuccess: (d) => { toast.success(d.message); setSelected(new Set()); invalidate(); },
    onError: () => toast.error("Bulk suspend failed"),
  });

  const users = data?.users ?? [];
  const allSelected = users.length > 0 && users.every(u => selected.has(u.id));
  const toggleSelect = (id: string) => setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(users.map(u => u.id)));

  const roleMut = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => changeUserRole(id, role),
    onSuccess: () => { setRoleTarget(null); setNewRole(""); invalidate(); },
  });

  const [searchInput, setSearchInput] = useState("");

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        <p className="text-sm text-gray-500 mt-1">Search, suspend, activate, and change roles for all users.</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search name or email…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { setQ(searchInput); setPage(1); } }}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#EBA814]/40"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#EBA814]/40"
        >
          <option value="">All roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
        </select>
        <select
          value={suspendedFilter}
          onChange={(e) => { setSuspendedFilter(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#EBA814]/40"
        >
          <option value="">All statuses</option>
          <option value="false">Active</option>
          <option value="true">Suspended</option>
        </select>
        <button
          onClick={() => { setQ(searchInput); setPage(1); }}
          className="px-4 py-2 rounded-xl bg-[#EBA814] text-white text-sm font-medium hover:bg-[#d9970f]"
        >
          Search
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {isLoading && <div className="p-12 text-center text-gray-400 text-sm">Loading users…</div>}
        {error && <div className="p-12 text-center text-red-500 text-sm">Failed to load users.</div>}
        {data && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 w-10">
                      <button onClick={toggleAll}>
                        {allSelected ? <CheckSquare size={16} className="text-[#EBA814]" /> : <Square size={16} />}
                      </button>
                    </th>
                    <th className="text-left px-5 py-3">User</th>
                    <th className="text-left px-5 py-3">Role</th>
                    <th className="text-left px-5 py-3">Clubs / Events</th>
                    <th className="text-left px-5 py-3">Status</th>
                    <th className="text-left px-5 py-3">Joined</th>
                    <th className="text-right px-5 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.users.map((u) => (
                    <tr key={u.id} className={`hover:bg-gray-50/50 transition-colors ${selected.has(u.id) ? "bg-[#EBA814]/5" : ""}`}>
                      <td className="px-4 py-3">
                        <button onClick={() => toggleSelect(u.id)}>
                          {selected.has(u.id) ? <CheckSquare size={16} className="text-[#EBA814]" /> : <Square size={16} className="text-gray-300" />}
                        </button>
                      </td>
                      <td className="px-5 py-3">
                        <div className="font-medium text-gray-900">{u.name}</div>
                        <div className="text-xs text-gray-400">{u.email}</div>
                        {u.department && <div className="text-xs text-gray-400">{u.department} {u.year && `· Year ${u.year}`}</div>}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roleColors[u.role] ?? "bg-gray-100 text-gray-600"}`}>
                          {u.role.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-600">
                        {u._count.memberships} clubs · {u._count.attendances} events
                      </td>
                      <td className="px-5 py-3">
                        {u.isSuspended ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Suspended</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Active</span>
                        )}
                        {!u.emailVerified && (
                          <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">Unverified</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-gray-400 text-xs">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {u.isSuspended ? (
                            <button
                              onClick={() => activateMut.mutate(u.id)}
                              title="Activate"
                              className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50"
                            >
                              <ShieldCheck size={15} />
                            </button>
                          ) : (
                            <button
                              onClick={() => { setSuspendTarget(u); setSuspendReason(""); }}
                              title="Suspend"
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50"
                            >
                              <ShieldOff size={15} />
                            </button>
                          )}
                          <button
                            onClick={() => { setRoleTarget(u); setNewRole(u.role); }}
                            title="Change role"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                          >
                            <UserCog size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {data.users.length === 0 && (
                    <tr><td colSpan={6} className="px-5 py-12 text-center text-gray-400">No users found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
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

      {/* Suspend modal */}
      {suspendTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Suspend {suspendTarget.name}?</h2>
              <button onClick={() => setSuspendTarget(null)}><X size={18} className="text-gray-400" /></button>
            </div>
            <textarea
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="Reason (optional)"
              rows={3}
              className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-300"
            />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setSuspendTarget(null)} className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button
                onClick={() => suspendMut.mutate({ id: suspendTarget.id, reason: suspendReason })}
                disabled={suspendMut.isPending}
                className="flex-1 py-2 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-60"
              >
                {suspendMut.isPending ? "Suspending…" : "Suspend"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role modal */}
      {/* Bulk action toolbar */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-gray-900 text-white px-5 py-3 rounded-2xl shadow-2xl">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <div className="w-px h-4 bg-gray-600" />
          <button
            onClick={() => bulkSuspendMut.mutate(Array.from(selected))}
            disabled={bulkSuspendMut.isPending}
            className="flex items-center gap-1.5 text-sm font-semibold text-red-400 hover:text-red-300 disabled:opacity-50"
          >
            <UserX size={16} /> Suspend All
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-sm text-gray-400 hover:text-white"
          >
            Cancel
          </button>
        </div>
      )}

      {roleTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Change role for {roleTarget.name}</h2>
              <button onClick={() => setRoleTarget(null)}><X size={18} className="text-gray-400" /></button>
            </div>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#EBA814]/40"
            >
              {ROLES.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
            </select>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setRoleTarget(null)} className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button
                onClick={() => roleMut.mutate({ id: roleTarget.id, role: newRole })}
                disabled={roleMut.isPending || newRole === roleTarget.role}
                className="flex-1 py-2 rounded-xl bg-[#EBA814] text-white text-sm font-medium hover:bg-[#d9970f] disabled:opacity-60"
              >
                {roleMut.isPending ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
