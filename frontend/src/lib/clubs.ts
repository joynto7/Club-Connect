import { api } from "./axios";

// ── Types ────────────────────────────────────────────────────────────────────

export type ClubStatus = "PENDING" | "ACTIVE" | "INACTIVE" | "REJECTED";
export type ClubRole   = "MEMBER" | "COORDINATOR" | "PRESIDENT";
export type MembershipStatus = "PENDING" | "APPROVED" | "REJECTED";

export type Club = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  category: string;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  contactEmail?: string | null;
  phone?: string | null;
  socialLinks: Record<string, string>;
  tags: string[];
  status: ClubStatus;
  approvalNote?: string | null;
  createdAt: string;
  createdBy: { id: string; name: string; email?: string };
  _count?: { memberships: number };
};

export type ClubMember = {
  id: string;
  role: ClubRole;
  status: MembershipStatus;
  message?: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
    department?: string | null;
    year?: string | null;
  };
};

export type MyMembership = {
  id: string;
  role: ClubRole;
  status: MembershipStatus;
} | null;

export type ClubDetail = Club & {
  memberships: ClubMember[];
  _count?: { memberships: number; followers: number };
};

export type CreateClubPayload = {
  name: string;
  description?: string;
  category?: string;
  contactEmail?: string;
  phone?: string;
  socialLinks?: Record<string, string>;
  tags?: string[];
  logoUrl?: string;
  bannerUrl?: string;
};

export type UpdateClubPayload = {
  name?: string;
  description?: string;
  category?: string;
  contactEmail?: string;
  phone?: string;
  socialLinks?: Record<string, string>;
  tags?: string[];
  logoUrl?: string;
  bannerUrl?: string;
};

export const CATEGORIES = [
  "General", "Technical", "Cultural", "Sports", "Arts",
  "Academic", "Social", "Environmental", "Music", "Gaming",
];

// ── API functions ─────────────────────────────────────────────────────────────

export async function listClubs(params?: { search?: string; category?: string }) {
  const r = await api.get<{ clubs: Club[] }>("/clubs", { params });
  return r.data;
}

export async function listPendingClubs() {
  const r = await api.get<{ clubs: Club[] }>("/clubs", { params: { status: "PENDING" } });
  return r.data;
}

export async function getClub(slugOrId: string) {
  const r = await api.get<{ club: ClubDetail; myMembership: MyMembership; isFollowing: boolean }>(`/clubs/${slugOrId}`);
  return r.data;
}

export async function createClub(data: CreateClubPayload) {
  const r = await api.post<{ club: Club; message: string }>("/clubs", data);
  return r.data;
}

export async function updateClub(id: string, data: UpdateClubPayload) {
  const r = await api.put<{ club: Club; message: string }>(`/clubs/${id}`, data);
  return r.data;
}

export async function approveClub(id: string) {
  const r = await api.post<{ message: string }>(`/clubs/${id}/approve`);
  return r.data;
}

export async function rejectClub(id: string, note?: string) {
  const r = await api.post<{ message: string }>(`/clubs/${id}/reject`, { note });
  return r.data;
}

// Membership
export async function getMembers(clubId: string, status?: MembershipStatus) {
  const r = await api.get<{ memberships: ClubMember[] }>(`/clubs/${clubId}/members`, {
    params: status ? { status } : {},
  });
  return r.data;
}

export async function requestMembership(clubId: string, message?: string) {
  const r = await api.post<{ message: string }>(`/clubs/${clubId}/members/request`, { message });
  return r.data;
}

export async function approveMembership(clubId: string, userId: string) {
  const r = await api.post<{ message: string }>(`/clubs/${clubId}/members/${userId}/approve`);
  return r.data;
}

export async function rejectMembership(clubId: string, userId: string) {
  const r = await api.post<{ message: string }>(`/clubs/${clubId}/members/${userId}/reject`);
  return r.data;
}

export async function updateMemberRole(clubId: string, userId: string, role: ClubRole) {
  const r = await api.put<{ message: string }>(`/clubs/${clubId}/members/${userId}/role`, { role });
  return r.data;
}

export async function removeMember(clubId: string, userId: string) {
  const r = await api.delete<{ message: string }>(`/clubs/${clubId}/members/${userId}`);
  return r.data;
}
