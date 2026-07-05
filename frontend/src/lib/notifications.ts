import { api } from "./axios";

export type NotificationType =
  | "EVENT_APPROVED"
  | "EVENT_REJECTED"
  | "EVENT_CANCELLED"
  | "EVENT_RSVP"
  | "EVENT_WAITLIST_PROMOTED"
  | "CLUB_APPROVED"
  | "CLUB_REJECTED"
  | "MEMBERSHIP_APPROVED"
  | "MEMBERSHIP_REJECTED"
  | "BOOKING_APPROVED"
  | "BOOKING_REJECTED"
  | "ANNOUNCEMENT";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export interface NotificationPreferences {
  id: string;
  userId: string;
  eventUpdates: boolean;
  clubUpdates: boolean;
  bookingUpdates: boolean;
  announcements: boolean;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  clubId: string | null;
  createdById: string;
  publishedAt: string;
  scheduledAt: string | null;
  createdAt: string;
  createdBy: { id: string; name: string; avatarUrl: string | null };
  club: { id: string; name: string; slug: string } | null;
}

// ── Notification API ─────────────────────────────────────────────────────────

export async function getNotifications(): Promise<{ notifications: Notification[]; unreadCount: number }> {
  const { data } = await api.get("/notifications");
  return data;
}

export async function markNotificationRead(id: string): Promise<void> {
  await api.put(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.put("/notifications/read-all");
}

export async function deleteNotification(id: string): Promise<void> {
  await api.delete(`/notifications/${id}`);
}

// ── Preferences API ──────────────────────────────────────────────────────────

export async function getNotificationPreferences(): Promise<{ preferences: NotificationPreferences }> {
  const { data } = await api.get("/users/me/notification-preferences");
  return data;
}

export async function updateNotificationPreferences(
  prefs: Partial<Omit<NotificationPreferences, "id" | "userId">>
): Promise<{ preferences: NotificationPreferences }> {
  const { data } = await api.put("/users/me/notification-preferences", prefs);
  return data;
}

// ── Announcements API ────────────────────────────────────────────────────────

export async function getAnnouncements(): Promise<{ announcements: Announcement[] }> {
  const { data } = await api.get("/announcements");
  return data;
}

export async function createAnnouncement(payload: {
  title: string;
  content: string;
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  clubId?: string;
}): Promise<{ announcement: Announcement }> {
  const { data } = await api.post("/announcements", payload);
  return data;
}

export async function updateAnnouncement(
  id: string,
  payload: { title?: string; content?: string; priority?: string }
): Promise<{ announcement: Announcement }> {
  const { data } = await api.put(`/announcements/${id}`, payload);
  return data;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await api.delete(`/announcements/${id}`);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export const notificationTypeIcon: Record<NotificationType, string> = {
  EVENT_APPROVED:          "✅",
  EVENT_REJECTED:          "❌",
  EVENT_CANCELLED:         "🚫",
  EVENT_RSVP:              "🎟️",
  EVENT_WAITLIST_PROMOTED: "🎉",
  CLUB_APPROVED:           "✅",
  CLUB_REJECTED:           "❌",
  MEMBERSHIP_APPROVED:     "👋",
  MEMBERSHIP_REJECTED:     "❌",
  BOOKING_APPROVED:        "✅",
  BOOKING_REJECTED:        "❌",
  ANNOUNCEMENT:            "📢",
};

export const priorityColors: Record<string, string> = {
  LOW:    "bg-gray-100 text-gray-600",
  NORMAL: "bg-blue-50 text-blue-700",
  HIGH:   "bg-amber-50 text-amber-700",
  URGENT: "bg-red-50 text-red-700",
};
