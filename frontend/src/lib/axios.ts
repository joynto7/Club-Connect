import axios from "axios";
import { getAuthState, setAuthState, clearAuthState } from "./tokenStorage";

// Read fresh at build time — do not let a stale build cache reuse an old value here.
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:5001";

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const auth = getAuthState();
  if (auth?.tokens?.accessToken) {
    config.headers = {
      ...(config.headers as any),
      Authorization: `Bearer ${auth.tokens.accessToken}`,
    } as any;
  }
  return config;
});

// A 15-min access token with no refresh path meant every session silently
// died 15 min after login — the UI kept showing cached name/nav from
// localStorage while every real data call 401'd. Refresh once on 401, and
// only give up (send to login) if the refresh token itself is dead too.
let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const auth = getAuthState();
  if (!auth?.tokens?.refreshToken) return null;
  try {
    const { data } = await axios.post<{ accessToken: string; refreshToken: string }>(
      `${API_BASE_URL}/auth/refresh-token`,
      { refreshToken: auth.tokens.refreshToken }
    );
    setAuthState({ tokens: { accessToken: data.accessToken, refreshToken: data.refreshToken }, user: auth.user });
    return data.accessToken;
  } catch {
    return null;
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && original && !original._retried && !String(original.url).includes("/auth/")) {
      original._retried = true;
      refreshing ??= refreshAccessToken().finally(() => { refreshing = null; });
      const newToken = await refreshing;
      if (newToken) {
        original.headers = { ...(original.headers as any), Authorization: `Bearer ${newToken}` };
        return api(original);
      }
      clearAuthState();
      if (typeof window !== "undefined") window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);
