export type UserInfo = {
  id: string;
  email: string;
  name: string;
  role: string;
  department?: string;
  year?: string;
  interests?: string[];
  avatarUrl?: string;
  emailVerified?: boolean;
  isSuspended?: boolean;
  createdAt?: string;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type AuthState = {
  tokens: AuthTokens;
  user: UserInfo;
};

const AUTH_STORAGE_KEY = "club-connect-auth";

export function getAuthState(): AuthState | null {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored) as AuthState;
  } catch {
    return null;
  }
}

export function setAuthState(value: AuthState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(value));
}

export function clearAuthState() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}
