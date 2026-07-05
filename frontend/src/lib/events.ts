import { api } from "./axios";

// ── Types ────────────────────────────────────────────────────────────────────

export type EventStatus     = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "CANCELLED";
export type AttendanceStatus = "REGISTERED" | "CANCELLED";

export type EventClub = { id: string; name: string; slug: string };

export type Event = {
  id: string;
  title: string;
  description?: string | null;
  location: string;
  category: string;
  tags: string[];
  status: EventStatus;
  registrationDeadline?: string | null;
  posterUrl?: string | null;
  contactPerson?: string | null;
  approvalNote?: string | null;
  maxWaitlist?: number | null;
  isVirtual: boolean;
  meetingUrl?: string | null;
  isPaid: boolean;
  ticketPrice?: number | null;
  clubId: string;
  club: EventClub;
  createdById: string;
  createdBy: { id: string; name: string };
  startsAt: string;
  endsAt?: string | null;
  capacity?: number | null;
  createdAt: string;
  updatedAt: string;
  _count?: { attendees: number };
};

export type MyRegistration = {
  id: string;
  status: AttendanceStatus;
  isWaitlisted: boolean;
  checkedIn: boolean;
  waitlistPosition?: number;
} | null;

export type EventTicket = {
  token: string;
  eventTitle: string;
  attendeeName: string;
  startsAt: string;
  location: string;
  clubName: string | null;
};

export type ScanResult = {
  success: boolean;
  alreadyCheckedIn: boolean;
  attendee: { name: string; id: string };
};

export type EventDetail = {
  event: Event;
  myRegistration: MyRegistration;
  waitlistCount: number;
};

export type Attendee = {
  id: string;
  status: AttendanceStatus;
  isWaitlisted: boolean;
  checkedIn: boolean;
  checkedInAt?: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
    department?: string | null;
  };
};

export type CreateEventPayload = {
  title: string;
  description?: string;
  location: string;
  clubId: string;
  category?: string;
  tags?: string[];
  startsAt: string;
  endsAt?: string;
  capacity?: number;
  registrationDeadline?: string;
  posterUrl?: string;
  contactPerson?: string;
  maxWaitlist?: number;
  isVirtual?: boolean;
  meetingUrl?: string;
  isPaid?: boolean;
  ticketPrice?: number;
};

export type UpdateEventPayload = Omit<Partial<CreateEventPayload>, "clubId">;

export const EVENT_CATEGORIES = [
  "General", "Technical", "Cultural", "Sports", "Arts",
  "Academic", "Social", "Environmental", "Music", "Gaming",
];

export const EVENT_DATE_FILTERS = [
  { value: "upcoming", label: "Upcoming" },
  { value: "week",     label: "This Week" },
  { value: "month",    label: "This Month" },
  { value: "",         label: "All" },
];

// ── API functions ─────────────────────────────────────────────────────────────

export async function listEvents(params?: {
  search?: string;
  category?: string;
  date?: string;
  clubId?: string;
}) {
  const r = await api.get<{ events: Event[] }>("/events", { params });
  return r.data;
}

export async function getEvent(id: string) {
  const r = await api.get<EventDetail>(`/events/${id}`);
  return r.data;
}

export async function createEvent(data: CreateEventPayload) {
  const r = await api.post<{ event: Event; message: string }>("/events", data);
  return r.data;
}

export async function updateEvent(id: string, data: UpdateEventPayload) {
  const r = await api.put<{ event: Event; message: string }>(`/events/${id}`, data);
  return r.data;
}

export async function cancelEvent(id: string) {
  const r = await api.delete<{ message: string }>(`/events/${id}`);
  return r.data;
}

export async function approveEvent(id: string) {
  const r = await api.post<{ message: string }>(`/events/${id}/approve`);
  return r.data;
}

export async function rejectEvent(id: string, note?: string) {
  const r = await api.post<{ message: string }>(`/events/${id}/reject`, { note });
  return r.data;
}

export async function registerForEvent(id: string) {
  const r = await api.post<{ message: string; isWaitlisted: boolean; warning?: string }>(`/events/${id}/register`);
  return r.data;
}

export async function cancelRegistration(id: string) {
  const r = await api.delete<{ message: string }>(`/events/${id}/register`);
  return r.data;
}

export async function getAttendees(id: string) {
  const r = await api.get<{ attendees: Attendee[]; event: Pick<Event, "id" | "title" | "capacity" | "maxWaitlist"> }>(`/events/${id}/attendees`);
  return r.data;
}

export async function checkInUser(eventId: string, userId: string) {
  const r = await api.post<{ attendance: Attendee; message: string }>(`/events/${eventId}/checkin/${userId}`);
  return r.data;
}

export async function getMyRegistrations() {
  const r = await api.get<{ registrations: Array<{ id: string; status: AttendanceStatus; isWaitlisted: boolean; event: Event }> }>("/events/me/registrations");
  return r.data;
}

export async function getTicket(eventId: string) {
  const r = await api.get<EventTicket>(`/events/${eventId}/ticket`);
  return r.data;
}

export async function scanTicket(eventId: string, token: string) {
  const r = await api.post<ScanResult>(`/events/${eventId}/scan`, { token });
  return r.data;
}

export async function setReminder(eventId: string, minutesBefore: 1440 | 60 | 15) {
  const r = await api.post<{ message: string }>(`/events/${eventId}/reminders`, { minutesBefore });
  return r.data;
}

export function getEventIcsUrl(eventId: string): string {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:5001";
  return `${base}/events/${eventId}/ics`;
}

export function getGoogleCalendarUrl(event: Pick<Event, "title" | "description" | "location" | "startsAt" | "endsAt">): string {
  const fmt = (d: string) => new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z/, "Z");
  const params = new URLSearchParams({
    action:   "TEMPLATE",
    text:     event.title,
    dates:    `${fmt(event.startsAt)}/${fmt(event.endsAt ?? event.startsAt)}`,
    details:  event.description ? event.description.replace(/<[^>]+>/g, " ").trim() : "",
    location: event.location,
  });
  return `https://www.google.com/calendar/render?${params.toString()}`;
}

// ── U11 — Payments ────────────────────────────────────────────────────────────

export async function createCheckoutSession(eventId: string) {
  const r = await api.post<{ sessionUrl: string }>(`/events/${eventId}/checkout`);
  return r.data;
}

export type PaymentRecord = {
  id: string;
  stripePaymentId: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  event: {
    id: string;
    title: string;
    startsAt: string;
    club: { name: string };
  };
};

export async function getMyPayments() {
  const r = await api.get<PaymentRecord[]>("/payments/my");
  return r.data;
}
