import { api } from "./axios";

export type SearchClub = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  logoUrl: string | null;
  tags: string[];
  memberCount: number;
};

export type SearchEvent = {
  id: string;
  title: string;
  description: string | null;
  location: string;
  category: string;
  startsAt: string;
  endsAt: string | null;
  posterUrl: string | null;
  capacity: number | null;
  registeredCount: number;
  club: { id: string; name: string; slug: string };
};

export type SearchAnnouncement = {
  id: string;
  title: string;
  content: string;
  priority: string;
  publishedAt: string;
  club: { id: string; name: string; slug: string } | null;
  createdBy: { id: string; name: string };
};

export type SearchResults = {
  query: string;
  type: string;
  results: {
    clubs: SearchClub[];
    events: SearchEvent[];
    announcements: SearchAnnouncement[];
  };
  total: number;
};

export type RecommendationsResult = {
  interests: string[];
  events: SearchEvent[];
  isPersonalized: boolean;
};

export type SessionInfo = {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
};

export async function globalSearch(q: string, type = "all"): Promise<SearchResults> {
  const response = await api.get<SearchResults>("/search", { params: { q, type } });
  return response.data;
}

export async function getRecommendations(): Promise<RecommendationsResult> {
  const response = await api.get<RecommendationsResult>("/search/recommendations");
  return response.data;
}

export async function getSessions(): Promise<{ sessions: SessionInfo[] }> {
  const response = await api.get<{ sessions: SessionInfo[] }>("/auth/sessions");
  return response.data;
}

export async function revokeSession(id: string): Promise<{ message: string }> {
  const response = await api.delete<{ message: string }>(`/auth/sessions/${id}`);
  return response.data;
}

export async function revokeAllSessions(): Promise<{ message: string }> {
  const response = await api.delete<{ message: string }>("/auth/sessions/all");
  return response.data;
}

export async function resendVerification(email: string): Promise<{ message: string }> {
  const response = await api.post<{ message: string }>("/auth/resend-verification", { email });
  return response.data;
}
