import { api } from "./axios";

export type BackendHealth = {
  status: string;
  message: string;
};

export type EventItem = {
  id: string;
  title: string;
  description?: string;
  startDate?: string;
  endDate?: string;
};

export async function getBackendHealth() {
  const response = await api.get<BackendHealth>("/health/json");
  return response.data;
}

export async function getEvents() {
  const response = await api.get<EventItem[]>("/events");
  return response.data;
}
