import { api } from "./axios";

export type Feedback = {
  id: string;
  rating: number;
  comment?: string | null;
  categoryRatings: Record<string, number>;
  createdAt: string;
  updatedAt: string;
  user: { id: string; name: string; avatarUrl?: string | null };
};

export type FeedbackStats = {
  totalCount: number;
  avgRating: number;
  distribution: Record<string, number>;
};

export type FeedbackSentiment = {
  sentiment: "positive" | "neutral" | "negative";
  positivePercent: number;
  topThemes: string[];
  summary: string;
};

export type EventFeedbackResponse = {
  feedbacks: Feedback[];
  stats: FeedbackStats;
  sentiment: FeedbackSentiment | null;
  event: { id: string; title: string };
};

export type MonthlyPoint = { month: string; count: number };

export type ClubAnalytics = {
  club: { id: string; name: string; slug: string };
  overview: {
    totalMembers: number;
    totalEvents: number;
    upcomingEvents: number;
    pastEvents: number;
    totalRegistrations: number;
    totalCheckins: number;
    avgAttendanceRate: number;
  };
  memberGrowth: MonthlyPoint[];
  eventsByStatus: Record<string, number>;
  topEvents: Array<{ id: string; title: string; startsAt: string; attendees: number }>;
  feedbackStats: { avgRating: number | null; totalFeedback: number };
};

export type AdminAnalytics = {
  overview: {
    totalUsers: number;
    totalClubs: number;
    totalEvents: number;
    totalAttendance: number;
    avgRating: number | null;
    totalFeedback: number;
  };
  userGrowth: MonthlyPoint[];
  eventGrowth: MonthlyPoint[];
  eventsByCategory: Array<{ category: string; count: number }>;
  clubsByCategory:  Array<{ category: string; count: number }>;
  topClubs: Array<{ id: string; name: string; slug: string; category: string; memberCount: number }>;
  topEvents: Array<{
    id: string; title: string; startsAt: string;
    club: { id: string; name: string; slug: string };
    attendees: number;
  }>;
};

export type SubmitFeedbackPayload = {
  rating: number;
  comment?: string;
  categoryRatings?: Record<string, number>;
};

export async function submitFeedback(eventId: string, data: SubmitFeedbackPayload) {
  const r = await api.post<{ feedback: Feedback; message: string }>(`/events/${eventId}/feedback`, data);
  return r.data;
}

export async function getMyFeedback(eventId: string) {
  const r = await api.get<{ feedback: Feedback | null }>(`/events/${eventId}/feedback/mine`);
  return r.data;
}

export async function getEventFeedback(eventId: string) {
  const r = await api.get<EventFeedbackResponse>(`/events/${eventId}/feedback`);
  return r.data;
}

export async function getClubAnalytics(slugOrId: string) {
  const r = await api.get<ClubAnalytics>(`/clubs/${slugOrId}/analytics`);
  return r.data;
}

export async function getAdminAnalytics() {
  const r = await api.get<AdminAnalytics>(`/admin/analytics`);
  return r.data;
}
