import { api } from "./axios";

// ── Types ────────────────────────────────────────────────────────────────────

export type BookingStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export type Venue = {
  id: string;
  name: string;
  location: string;
  description?: string | null;
  capacity: number;
  facilities: string[];
  images: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type VenueWithBookings = Venue & {
  bookings: Array<{
    id: string;
    startTime: string;
    endTime: string;
    purpose: string;
    requestedBy: { id: string; name: string };
    club: { id: string; name: string } | null;
  }>;
};

export type VenueBooking = {
  id: string;
  venueId: string;
  venue: { id: string; name: string; location: string; capacity?: number };
  requestedById?: string;
  requestedBy?: { id: string; name: string; email?: string };
  club?: { id: string; name: string; slug: string } | null;
  event?: { id: string; title: string } | null;
  startTime: string;
  endTime: string;
  purpose: string;
  status: BookingStatus;
  adminNote?: string | null;
  createdAt: string;
};

export type Resource = {
  id: string;
  name: string;
  category: string;
  description?: string | null;
  quantity: number;
  isActive: boolean;
  createdAt: string;
};

export type ResourceBooking = {
  id: string;
  resourceId: string;
  resource: { id: string; name: string; category: string };
  requestedById?: string;
  requestedBy?: { id: string; name: string; email?: string };
  club?: { id: string; name: string; slug: string } | null;
  event?: { id: string; title: string } | null;
  quantity: number;
  startTime: string;
  endTime: string;
  purpose: string;
  status: BookingStatus;
  adminNote?: string | null;
  createdAt: string;
};

export type CreateVenueBookingPayload = {
  startTime: string;
  endTime: string;
  purpose: string;
  eventId?: string;
  clubId?: string;
};

export type CreateResourceBookingPayload = {
  startTime: string;
  endTime: string;
  purpose: string;
  quantity?: number;
  eventId?: string;
  clubId?: string;
};

export const RESOURCE_CATEGORIES = [
  "General",
  "Audio/Visual",
  "Furniture",
  "Sports Equipment",
  "Electronics",
  "Decorations",
  "Catering",
  "Transportation",
];

// ── Venue API ─────────────────────────────────────────────────────────────────

export async function listVenues(params?: { search?: string }) {
  const r = await api.get<{ venues: Venue[] }>("/venues", { params });
  return r.data;
}

export async function getVenue(id: string) {
  const r = await api.get<{ venue: VenueWithBookings }>(`/venues/${id}`);
  return r.data;
}

export async function getVenueAvailability(id: string, date: string) {
  const r = await api.get<{
    bookings: Array<{ id: string; startTime: string; endTime: string; purpose: string }>;
  }>(`/venues/${id}/availability`, { params: { date } });
  return r.data;
}

export async function createVenueBooking(venueId: string, data: CreateVenueBookingPayload) {
  const r = await api.post<{ booking: VenueBooking; message: string }>(
    `/venues/${venueId}/book`,
    data,
  );
  return r.data;
}

export async function getMyVenueBookings() {
  const r = await api.get<{ bookings: VenueBooking[] }>("/venues/bookings/mine");
  return r.data;
}

export async function getAllVenueBookings(status?: BookingStatus) {
  const r = await api.get<{ bookings: VenueBooking[] }>("/venues/bookings", {
    params: status ? { status } : {},
  });
  return r.data;
}

export async function approveVenueBooking(bookingId: string) {
  const r = await api.post<{ message: string }>(`/venues/bookings/${bookingId}/approve`);
  return r.data;
}

export async function rejectVenueBooking(bookingId: string, note?: string) {
  const r = await api.post<{ message: string }>(`/venues/bookings/${bookingId}/reject`, { note });
  return r.data;
}

export async function cancelVenueBooking(bookingId: string) {
  const r = await api.delete<{ message: string }>(`/venues/bookings/${bookingId}`);
  return r.data;
}

export async function createVenue(data: {
  name: string;
  location: string;
  description?: string;
  capacity: number;
  facilities?: string[];
}) {
  const r = await api.post<{ venue: Venue; message: string }>("/venues", data);
  return r.data;
}

// ── Resource API ──────────────────────────────────────────────────────────────

export async function listResources(params?: { search?: string; category?: string }) {
  const r = await api.get<{ resources: Resource[] }>("/resources", { params });
  return r.data;
}

export async function createResourceBooking(
  resourceId: string,
  data: CreateResourceBookingPayload,
) {
  const r = await api.post<{ booking: ResourceBooking; message: string }>(
    `/resources/${resourceId}/book`,
    data,
  );
  return r.data;
}

export async function getMyResourceBookings() {
  const r = await api.get<{ bookings: ResourceBooking[] }>("/resources/bookings/mine");
  return r.data;
}

export async function getAllResourceBookings(status?: BookingStatus) {
  const r = await api.get<{ bookings: ResourceBooking[] }>("/resources/bookings", {
    params: status ? { status } : {},
  });
  return r.data;
}

export async function approveResourceBooking(bookingId: string) {
  const r = await api.post<{ message: string }>(`/resources/bookings/${bookingId}/approve`);
  return r.data;
}

export async function rejectResourceBooking(bookingId: string, note?: string) {
  const r = await api.post<{ message: string }>(`/resources/bookings/${bookingId}/reject`, {
    note,
  });
  return r.data;
}

export async function cancelResourceBooking(bookingId: string) {
  const r = await api.delete<{ message: string }>(`/resources/bookings/${bookingId}`);
  return r.data;
}

export async function createResource(data: {
  name: string;
  category?: string;
  description?: string;
  quantity?: number;
}) {
  const r = await api.post<{ resource: Resource; message: string }>("/resources", data);
  return r.data;
}
