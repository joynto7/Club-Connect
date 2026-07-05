import { api } from "./axios";
import { getAuthState } from "./tokenStorage";

const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:5001";

export type ReportType = "MEMBERS" | "ATTENDANCE" | "EVENTS" | "SYSTEM";
export type ReportFormat = "CSV" | "PDF";

export type Report = {
  id: string;
  type: ReportType;
  format: ReportFormat;
  name: string;
  params: { clubId?: string | null; eventId?: string | null };
  generatedBy: { id: string; name: string; email: string };
  createdAt: string;
};

export type GenerateReportInput = {
  type: ReportType;
  format: ReportFormat;
  clubId?: string;
  eventId?: string;
};

export async function listReports(): Promise<Report[]> {
  const res = await api.get<Report[]>("/reports");
  return res.data;
}

/** Triggers the browser to download the generated file. */
export async function generateReport(input: GenerateReportInput): Promise<void> {
  const auth = getAuthState();
  const token = auth?.tokens?.accessToken ?? "";

  const res = await fetch(`${baseURL}/reports/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const json = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(json.error ?? "Failed to generate report");
  }

  const blob = await res.blob();
  const ext = input.format === "PDF" ? "pdf" : "csv";
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match?.[1] ?? `report.${ext}`;

  triggerDownload(blob, filename);
}

/** Re-downloads a previously generated report. */
export async function downloadReport(reportId: string): Promise<void> {
  const auth = getAuthState();
  const token = auth?.tokens?.accessToken ?? "";

  const res = await fetch(`${baseURL}/reports/${reportId}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const json = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(json.error ?? "Failed to download report");
  }

  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match?.[1] ?? "report";

  triggerDownload(blob, filename);
}

export async function deleteReport(reportId: string): Promise<void> {
  await api.delete(`/reports/${reportId}`);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
