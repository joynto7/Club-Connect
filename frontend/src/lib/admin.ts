import { api } from "./axios";

// ── Existing stats types ─────────────────────────────────────────────────────
export type AdminStats = {
  counts: {
    pendingClubs: number;
    pendingEvents: number;
    pendingVenueBookings: number;
    pendingResourceBookings: number;
    totalUsers: number;
    totalActiveClubs: number;
    totalEvents: number;
  };
  pendingClubs: Array<{
    id: string;
    name: string;
    slug: string;
    category: string;
    createdAt: string;
    createdBy: { id: string; name: string };
  }>;
  pendingEvents: Array<{
    id: string;
    title: string;
    category: string;
    startsAt: string;
    createdAt: string;
    club: { id: string; name: string; slug: string };
    createdBy: { id: string; name: string };
  }>;
  pendingVenueBookings: Array<{
    id: string;
    purpose: string;
    startTime: string;
    endTime: string;
    createdAt: string;
    venue: { id: string; name: string; location: string };
    requestedBy: { id: string; name: string };
    club: { id: string; name: string } | null;
  }>;
  pendingResourceBookings: Array<{
    id: string;
    purpose: string;
    quantity: number;
    startTime: string;
    endTime: string;
    createdAt: string;
    resource: { id: string; name: string; category: string };
    requestedBy: { id: string; name: string };
    club: { id: string; name: string } | null;
  }>;
  recentActivity: Array<{
    type: "CLUB_CREATED" | "EVENT_CREATED" | "USER_JOINED";
    title: string;
    subtitle: string;
    link: string;
    createdAt: string;
  }>;
};

// ── UC-7.1 — User management types ──────────────────────────────────────────
export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string | null;
  year: string | null;
  avatarUrl: string | null;
  isSuspended: boolean;
  suspendedReason: string | null;
  emailVerified: boolean;
  createdAt: string;
  _count: { memberships: number; attendances: number; contentReportsSubmitted: number };
};

export type AdminUsersResponse = {
  users: AdminUser[];
  total: number;
  page: number;
  limit: number;
  pages: number;
};

// ── UC-7.3 — Club oversight types ───────────────────────────────────────────
export type AdminClub = {
  id: string;
  name: string;
  slug: string;
  category: string;
  status: string;
  approvalNote: string | null;
  logoUrl: string | null;
  contactEmail: string | null;
  createdAt: string;
  createdBy: { id: string; name: string; email: string };
  _count: { memberships: number; events: number };
};

export type AdminClubsResponse = {
  clubs: AdminClub[];
  total: number;
  page: number;
  limit: number;
  pages: number;
};

// ── UC-7.4 — Event oversight types ──────────────────────────────────────────
export type AdminEvent = {
  id: string;
  title: string;
  category: string;
  status: string;
  location: string;
  startsAt: string;
  endsAt: string | null;
  approvalNote: string | null;
  createdAt: string;
  club: { id: string; name: string; slug: string };
  createdBy: { id: string; name: string };
  _count: { attendees: number };
};

export type AdminEventsResponse = {
  events: AdminEvent[];
  total: number;
  page: number;
  limit: number;
  pages: number;
};

// ── UC-7.5 — Content report types ───────────────────────────────────────────
export type ContentReport = {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  description: string | null;
  status: "PENDING" | "RESOLVED" | "DISMISSED";
  resolvedNote: string | null;
  createdAt: string;
  updatedAt: string;
  reporter: { id: string; name: string; email: string };
  resolvedBy: { id: string; name: string } | null;
};

export type ContentReportsResponse = {
  reports: ContentReport[];
  total: number;
  page: number;
  limit: number;
  pages: number;
};

// ── UC-7.6 — System settings types ──────────────────────────────────────────
export type SystemConfig = {
  id: string;
  key: string;
  value: string;
  label: string;
  createdAt: string;
  updatedAt: string;
};

export type SystemSettingsResponse = {
  settings: SystemConfig[];
  map: Record<string, string>;
};

// ── API functions ────────────────────────────────────────────────────────────
export async function getAdminStats() {
  const r = await api.get<AdminStats>("/admin/stats");
  return r.data;
}

export async function listAdminUsers(params?: {
  page?: number; limit?: number; q?: string; role?: string; suspended?: string;
}) {
  const r = await api.get<AdminUsersResponse>("/admin/users", { params });
  return r.data;
}

export async function suspendUser(id: string, reason?: string) {
  const r = await api.put<{ user: AdminUser; message: string }>(`/admin/users/${id}/suspend`, { reason });
  return r.data;
}

export async function activateUser(id: string) {
  const r = await api.put<{ user: AdminUser; message: string }>(`/admin/users/${id}/activate`);
  return r.data;
}

export async function changeUserRole(id: string, role: string) {
  const r = await api.put<{ user: AdminUser; message: string }>(`/admin/users/${id}/role`, { role });
  return r.data;
}

export async function listAdminClubs(params?: {
  page?: number; limit?: number; q?: string; status?: string;
}) {
  const r = await api.get<AdminClubsResponse>("/admin/clubs", { params });
  return r.data;
}

export async function listAdminEvents(params?: {
  page?: number; limit?: number; q?: string; status?: string;
}) {
  const r = await api.get<AdminEventsResponse>("/admin/events", { params });
  return r.data;
}

export async function listContentReports(params?: {
  page?: number; limit?: number; status?: string;
}) {
  const r = await api.get<ContentReportsResponse>("/admin/content-reports", { params });
  return r.data;
}

export async function resolveContentReport(id: string, note?: string) {
  const r = await api.put(`/admin/content-reports/${id}/resolve`, { note });
  return r.data;
}

export async function dismissContentReport(id: string, note?: string) {
  const r = await api.put(`/admin/content-reports/${id}/dismiss`, { note });
  return r.data;
}

export async function getSystemSettings() {
  const r = await api.get<SystemSettingsResponse>("/admin/settings");
  return r.data;
}

export async function upsertSystemSetting(key: string, value: string, label?: string) {
  const r = await api.put<{ setting: SystemConfig; message: string }>("/admin/settings", {
    key, value, label,
  });
  return r.data;
}

export async function submitContentReport(data: {
  targetType: "EVENT" | "CLUB" | "ANNOUNCEMENT" | "USER";
  targetId: string;
  reason: string;
  description?: string;
}) {
  const r = await api.post("/content/report", data);
  return r.data;
}

// ── U10 — Audit Log ───────────────────────────────────────────────────────────
export type AuditEntry = {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  details: Record<string, unknown>;
  ipAddress: string | null;
  createdAt: string;
  actor: { id: string; name: string; email: string; avatarUrl: string | null };
};

export type AuditLogResponse = {
  entries: AuditEntry[];
  total: number;
  page: number;
  limit: number;
  pages: number;
};

export async function getAuditLog(params: {
  page?: number; action?: string; from?: string; to?: string; q?: string;
}) {
  const r = await api.get<AuditLogResponse>("/admin/audit-log", { params });
  return r.data;
}

// ── U10 — Bulk Operations ─────────────────────────────────────────────────────
export async function bulkApproveClubs(ids: string[]) {
  const r = await api.post<{ approved: number; failed: number; message: string }>("/admin/clubs/bulk-approve", { ids });
  return r.data;
}

export async function bulkApproveEvents(ids: string[]) {
  const r = await api.post<{ approved: number; failed: number; message: string }>("/admin/events/bulk-approve", { ids });
  return r.data;
}

export async function bulkSuspendUsers(ids: string[], reason?: string) {
  const r = await api.post<{ suspended: number; failed: number; message: string }>("/admin/users/bulk-suspend", { ids, reason });
  return r.data;
}

// ── U10 — Email Digest ────────────────────────────────────────────────────────
export type EmailDigestSub = { id?: string; frequency: "DAILY" | "WEEKLY" | "NONE" };

export async function getEmailDigestSub() {
  const r = await api.get<{ subscription: EmailDigestSub }>("/admin/email-digest");
  return r.data.subscription;
}

export async function upsertEmailDigestSub(frequency: "DAILY" | "WEEKLY" | "NONE") {
  const r = await api.put<{ subscription: EmailDigestSub }>("/admin/email-digest", { frequency });
  return r.data.subscription;
}
