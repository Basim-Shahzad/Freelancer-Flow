import { create } from "zustand";
import type { User } from "@/lib/api/types";

/**
 * "idle"            – nothing attempted yet (server render / first paint)
 * "loading"         – silent refresh on app start in flight
 * "authenticated"   – access token + user in memory
 * "unauthenticated" – no valid session
 */
export type AuthStatus = "idle" | "loading" | "authenticated" | "unauthenticated";

/**
 * Why the session ended, so the route gate can react:
 * "expired" – a refresh failed mid-session (toast + `next` redirect); "manual" – the user signed out
 * (plain /login); null – no session on load (redirect with `next`, silently).
 */
export type SignOutReason = "expired" | "manual" | null;

interface AuthState {
  /** Held in memory only (never persisted); the refresh token lives in an httpOnly cookie. */
  accessToken: string | null;
  user: User | null;
  status: AuthStatus;
  signOutReason: SignOutReason;
  setAccessToken(token: string | null): void;
  setUser(user: User | null): void;
  setStatus(status: AuthStatus): void;
  /** Drop everything and mark the session as signed out. */
  clear(reason?: SignOutReason): void;
  /** Consume the sign-out reason once the gate has reacted to it. */
  resetSignOutReason(): void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  accessToken: null,
  user: null,
  status: "idle",
  signOutReason: null,
  setAccessToken: (accessToken) => set({ accessToken }),
  setUser: (user) => set({ user }),
  setStatus: (status) => set({ status }),
  clear: (reason = null) => set({ accessToken: null, user: null, status: "unauthenticated", signOutReason: reason }),
  resetSignOutReason: () => set({ signOutReason: null }),
}));
