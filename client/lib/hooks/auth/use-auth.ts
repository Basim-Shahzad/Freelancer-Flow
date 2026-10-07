"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { ChangePasswordInput, LoginInput, RegisterInput } from "@/lib/api/types";
import { refreshAccessToken } from "@/lib/services/api.service";
import { authService } from "@/lib/services/auth.service";
import { useAuthStore } from "@/lib/store/auth";

export const authKeys = { me: ["auth", "me"] as const };

/** Current session state from the in-memory store. */
export function useSession() {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  return {
    status,
    user,
    isAuthenticated: status === "authenticated",
    isLoading: status === "idle" || status === "loading",
  };
}

/** Fetches the current user and keeps the auth store in sync. Disabled until an access token exists. */
export function useMe() {
  const token = useAuthStore((s) => s.accessToken);
  const query = useQuery({
    queryKey: authKeys.me,
    queryFn: authService.me,
    enabled: !!token,
    staleTime: 5 * 60_000,
  });
  useEffect(() => {
    if (query.data) useAuthStore.getState().setUser(query.data);
  }, [query.data]);
  return query;
}

/** Runs once on app start: refresh cookie -> access token -> /auth/me. Resolves status to authenticated/unauthenticated. */
export function useAuthBootstrap() {
  const qc = useQueryClient();
  useEffect(() => {
    const { setStatus, setUser, clear } = useAuthStore.getState();
    let cancelled = false;
    setStatus("loading");
    refreshAccessToken()
      .then(() => authService.me())
      .then((user) => {
        if (cancelled) return;
        qc.setQueryData(authKeys.me, user);
        setUser(user);
        setStatus("authenticated");
      })
      .catch(() => {
        if (!cancelled) clear();
      });
    return () => {
      cancelled = true;
    };
  }, [qc]);
}

/** Login returns an access token; we then load the user so callers get a fully-authenticated session. */
export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: LoginInput) => {
      const { accessToken } = await authService.login(input);
      useAuthStore.getState().setAccessToken(accessToken);
      try {
        return await authService.me();
      } catch (e) {
        useAuthStore.getState().clear();
        throw e;
      }
    },
    onSuccess: (user) => {
      qc.setQueryData(authKeys.me, user);
      useAuthStore.setState({ user, status: "authenticated" });
    },
  });
}

/** Creates the account, then signs in with the same credentials (register itself returns no token). */
export function useRegister() {
  const login = useLogin();
  return useMutation({
    mutationFn: async (input: RegisterInput) => {
      await authService.register(input);
      return login.mutateAsync({ email: input.email, password: input.password });
    },
  });
}

function useSignedOut() {
  const qc = useQueryClient();
  return () => {
    useAuthStore.getState().clear();
    qc.clear();
  };
}

export function useLogout() {
  const signedOut = useSignedOut();
  return useMutation({
    mutationFn: authService.logout,
    onSettled: signedOut, // sign out locally even if the server call fails
  });
}

export function useLogoutAll() {
  const signedOut = useSignedOut();
  return useMutation({ mutationFn: authService.logoutAll, onSettled: signedOut });
}

/** Server revokes all sessions on success, so the user must log in again. */
export function useChangePassword() {
  const signedOut = useSignedOut();
  return useMutation({
    mutationFn: (input: ChangePasswordInput) => authService.changePassword(input),
    onSuccess: signedOut,
  });
}
