import { create } from "zustand";
import type { User } from "@/lib/api/types";

/**
 * "idle"            – nothing attempted yet (server render / first paint)
 * "loading"         – silent refresh on app start in flight
 * "authenticated"   – access token + user in memory
 * "unauthenticated" – no valid session
 */
export type AuthStatus = "idle" | "loading" | "authenticated" | "unauthenticated";

interface AuthState {
  /** Held in memory only (never persisted); the refresh token lives in an httpOnly cookie. */
  accessToken: string | null;
  user: User | null;
  status: AuthStatus;
  setAccessToken(token: string | null): void;
  setUser(user: User | null): void;
  setStatus(status: AuthStatus): void;
  /** Drop everything and mark the session as signed out. */
  clear(): void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  accessToken: null,
  user: null,
  status: "idle",
  setAccessToken: (accessToken) => set({ accessToken }),
  setUser: (user) => set({ user }),
  setStatus: (status) => set({ status }),
  clear: () => set({ accessToken: null, user: null, status: "unauthenticated" }),
}));
