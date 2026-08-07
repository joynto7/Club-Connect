import type { AxiosError } from "axios";
import { api } from "./axios";
import type { AuthState, UserInfo } from "./tokenStorage";

export type RegisterPayload = {
  name: string;
  email: string;
  password: string;
  department?: string;
  year?: string;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type PasswordResetRequestPayload = {
  email: string;
};

export type PasswordResetPayload = {
  token: string;
  password: string;
};

export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: UserInfo;
};

export async function registerUser(payload: RegisterPayload) {
  const response = await api.post<{ message: string; user: UserInfo }>("/auth/register", payload);
  return response.data;
}

export type LoginResponseWith2FA = LoginResponse | { requires2FA: true; tempToken: string };

export async function loginUser(payload: LoginPayload) {
  const response = await api.post<LoginResponseWith2FA>("/auth/login", payload);
  return response.data;
}

export async function requestPasswordReset(payload: PasswordResetRequestPayload) {
  const response = await api.post<{ message: string }>("/auth/request-password-reset", payload);
  return response.data;
}

export async function resetPassword(payload: PasswordResetPayload) {
  const response = await api.post<{ message: string }>("/auth/reset-password", payload);
  return response.data;
}

export type ResendVerificationPayload = {
  email: string;
};

export async function resendVerification(payload: ResendVerificationPayload) {
  const response = await api.post<{ message: string }>("/auth/resend-verification", payload);
  return response.data;
}

export type ChangeUnverifiedEmailPayload = {
  email: string;
  password: string;
  newEmail: string;
};

export async function changeUnverifiedEmail(payload: ChangeUnverifiedEmailPayload) {
  const response = await api.post<{ message: string }>("/auth/change-unverified-email", payload);
  return response.data;
}

// ── Profile ──────────────────────────────────────────────────────
export type UpdateProfilePayload = {
  name?: string;
  department?: string;
  year?: string;
  interests?: string[];
  avatarUrl?: string;
};

export type HistoryEvent = {
  registrationId: string;
  status: string;
  registeredAt: string;
  event: {
    id: string;
    title: string;
    location: string;
    startsAt: string;
    endsAt?: string;
    club: { id: string; name: string; slug: string };
  };
};

export type HistoryClub = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
};

export async function getMyProfile() {
  const response = await api.get<{ user: UserInfo }>("/users/me");
  return response.data;
}

export async function updateMyProfile(payload: UpdateProfilePayload) {
  const response = await api.put<{ user: UserInfo; message: string }>("/users/me", payload);
  return response.data;
}

export async function getMyHistory() {
  const response = await api.get<{
    clubsCreated: HistoryClub[];
    upcomingEvents: HistoryEvent[];
    pastEvents: HistoryEvent[];
  }>("/users/me/history");
  return response.data;
}

export type MyClub = {
  id: string;
  name: string;
  slug: string;
  category: string;
  logoUrl: string | null;
  status: string;
  role: "MEMBER" | "COORDINATOR" | "PRESIDENT";
  memberCount: number;
  pendingCount: number;
};

export async function getMyClubs() {
  const response = await api.get<{ clubs: MyClub[] }>("/users/me/clubs");
  return response.data;
}

// ── Auth State Helpers ────────────────────────────────────────────
export function buildAuthState(data: LoginResponse): AuthState {
  return {
    tokens: {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    },
    user: data.user,
  };
}

// ── U10.5 — 2FA ───────────────────────────────────────────────────────────────
export async function setup2FA() {
  const r = await api.post<{ secret: string; qrDataUrl: string }>("/auth/2fa/setup");
  return r.data;
}

export async function verify2FA(token: string) {
  const r = await api.post<{ message: string }>("/auth/2fa/verify", { token });
  return r.data;
}

export async function disable2FA(token: string) {
  const r = await api.post<{ message: string }>("/auth/2fa/disable", { token });
  return r.data;
}

export async function login2FA(tempToken: string, token: string) {
  const r = await api.post<{ accessToken: string; refreshToken: string; user: { id: string; email: string; name: string; role: string } }>(
    "/auth/2fa/login", { tempToken, token }
  );
  return r.data;
}

export async function exchangeGoogleOAuthCode(code: string) {
  const r = await api.post<{ accessToken: string; refreshToken: string; user: { id: string; email: string; name: string; role: string } }>(
    "/auth/google/exchange", { code }
  );
  return r.data;
}

export function getApiErrorMessage(error: unknown) {
  if (!error || typeof error !== "object") {
    return "An unexpected error occurred.";
  }

  const axiosError = error as AxiosError<{ error?: string }>;
  if (axiosError.response?.data?.error) {
    return axiosError.response.data.error;
  }

  return axiosError.message || "An unexpected error occurred.";
}
