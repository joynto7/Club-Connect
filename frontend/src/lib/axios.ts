import axios from "axios";
import { getAuthState } from "./tokenStorage";

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
