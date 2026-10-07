import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import type { AccessTokenResponse } from "@/lib/api/types";
import { useAuthStore } from "@/lib/store/auth";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

/** Shared axios instance: attaches the in-memory access token and transparently refreshes it on 401. */
export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // sends/receives the httpOnly refresh-token cookie
  headers: { "Content-Type": "application/json" },
});

/** Bare instance (no interceptors) so refreshing can never recurse into itself. */
const bare = axios.create({ baseURL: API_URL, withCredentials: true });

let refreshing: Promise<string> | null = null;

/**
 * Exchanges the refresh cookie for a new access token. Single-flight: concurrent callers share one request,
 * which matters because the server rotates the refresh token on every call.
 */
export function refreshAccessToken(): Promise<string> {
  refreshing ??= bare
    .post<AccessTokenResponse>("/auth/refresh")
    .then((r) => {
      useAuthStore.getState().setAccessToken(r.data.accessToken);
      return r.data.accessToken;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

// Endpoints where a 401 means "bad credentials / no session", not "expired token".
const NO_REFRESH = ["/auth/login", "/auth/register", "/auth/refresh"];

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token && !config.headers.has("Authorization")) config.headers.set("Authorization", `Bearer ${token}`);
  return config;
});

type Retriable = InternalAxiosRequestConfig & { _retried?: boolean };

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as Retriable | undefined;
    if (error.response?.status !== 401 || !original || original._retried || NO_REFRESH.some((p) => original.url?.startsWith(p))) {
      return Promise.reject(error);
    }
    original._retried = true;
    try {
      const token = await refreshAccessToken();
      original.headers.set("Authorization", `Bearer ${token}`);
      return api(original);
    } catch (refreshError) {
      useAuthStore.getState().clear();
      return Promise.reject(refreshError);
    }
  },
);

/** Pulls a human-readable message out of a FastAPI error body (`detail` string or validation list). */
export function getApiErrorMessage(error: unknown, fallback = "Something went wrong. Try again."): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) return "Can’t reach the server. Check your connection and try again.";
    const detail = (error.response.data as { detail?: unknown } | undefined)?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      const msg = detail.map((d: { msg?: string }) => d?.msg).filter(Boolean).join(" ");
      if (msg) return msg;
    }
  }
  return fallback;
}

export const getApiErrorStatus = (error: unknown): number | undefined => (axios.isAxiosError(error) ? error.response?.status : undefined);
