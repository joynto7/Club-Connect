import { api } from "./axios";

export interface ClubIntegration {
  id: string;
  clubId: string;
  type: "SLACK" | "DISCORD";
  webhookUrl: string;
  events: IntegrationEvent[];
  createdAt: string;
  updatedAt: string;
}

export type IntegrationEvent = "NEW_EVENT" | "NEW_MEMBER" | "ANNOUNCEMENT";

export const INTEGRATION_EVENT_LABELS: Record<IntegrationEvent, string> = {
  NEW_EVENT: "New Event Approved",
  NEW_MEMBER: "New Member Joined",
  ANNOUNCEMENT: "New Announcement",
};

export async function listIntegrations(clubId: string): Promise<ClubIntegration[]> {
  const res = await api.get<ClubIntegration[]>(`/clubs/${clubId}/integrations`);
  return res.data;
}

export async function upsertIntegration(
  clubId: string,
  data: { type: "SLACK" | "DISCORD"; webhookUrl: string; events: IntegrationEvent[] }
): Promise<ClubIntegration> {
  const res = await api.post<ClubIntegration>(`/clubs/${clubId}/integrations`, data);
  return res.data;
}

export async function deleteIntegration(clubId: string, integrationId: string): Promise<void> {
  await api.delete(`/clubs/${clubId}/integrations/${integrationId}`);
}
