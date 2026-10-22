import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useAuthStore } from "@/lib/store/auth";
import { createTestQueryClient, mockApi, seedAuth } from "@/lib/test";
import { useAuthBootstrap, useChangePassword, useLogin, useLogout, useLogoutAll } from "./use-auth";

let m: ReturnType<typeof mockApi>;
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={createTestQueryClient()}>{children}</QueryClientProvider>;

beforeEach(() => {
  m = mockApi();
  seedAuth("authenticated");
});
afterEach(() => m.restore());

describe("sign-out hooks", () => {
  it("useChangePassword signs out (manual) only on success", async () => {
    m.mock.onPost("/auth/change-password").replyOnce(400, { detail: "bad" }).onPost("/auth/change-password").reply(200, { message: "ok" });
    const { result } = renderHook(() => useChangePassword(), { wrapper });

    await act(() => result.current.mutateAsync({ currentPassword: "a", newPassword: "bbbbbbbb" }).catch(() => undefined));
    expect(useAuthStore.getState().status).toBe("authenticated");

    await act(() => result.current.mutateAsync({ currentPassword: "a", newPassword: "bbbbbbbb" }));
    expect(useAuthStore.getState()).toMatchObject({ status: "unauthenticated", signOutReason: "manual", accessToken: null });
  });

  it.each([
    ["useLogout", useLogout, "/auth/logout"],
    ["useLogoutAll", useLogoutAll, "/auth/logout-all"],
  ] as const)("%s signs out locally even when the server call fails", async (_n, hook, url) => {
    m.mock.onPost(url).networkError();
    const { result } = renderHook(() => hook(), { wrapper });
    await act(() => result.current.mutateAsync().catch(() => undefined));
    await waitFor(() => expect(useAuthStore.getState().status).toBe("unauthenticated"));
    expect(useAuthStore.getState().signOutReason).toBe("manual");
  });
});

describe("useAuthBootstrap", () => {
  beforeEach(() => useAuthStore.setState({ accessToken: null, user: null, status: "idle", signOutReason: null }));

  it("refreshes, loads the user and becomes authenticated", async () => {
    m.refresh.onPost("/auth/refresh").reply(200, { accessToken: "fresh" });
    m.mock.onGet("/auth/me").reply(200, { id: "u1", email: "test@example.com", fullName: "T", role: "freelancer", isActive: true, isVerified: true, createdAt: "", lastLoginAt: null });
    renderHook(() => useAuthBootstrap(), { wrapper });
    await waitFor(() => expect(useAuthStore.getState().status).toBe("authenticated"));
    expect(useAuthStore.getState().accessToken).toBe("fresh");
  });

  it("ends unauthenticated, with no sign-out reason, when the refresh fails", async () => {
    m.refresh.onPost("/auth/refresh").reply(401, { detail: "no cookie" });
    renderHook(() => useAuthBootstrap(), { wrapper });
    await waitFor(() => expect(useAuthStore.getState().status).toBe("unauthenticated"));
    expect(useAuthStore.getState().signOutReason).toBeNull();
  });
});

describe("useLogin", () => {
  it("clears a stale sign-out reason on success", async () => {
    useAuthStore.setState({ status: "unauthenticated", accessToken: null, user: null, signOutReason: "expired" });
    m.mock.onPost("/auth/login").reply(200, { accessToken: "t" });
    m.mock.onGet("/auth/me").reply(200, { id: "u1", email: "test@example.com", fullName: "T", role: "freelancer", isActive: true, isVerified: true, createdAt: "", lastLoginAt: null });
    const { result } = renderHook(() => useLogin(), { wrapper });
    await act(() => result.current.mutateAsync({ email: "test@example.com", password: "pw" }));
    expect(useAuthStore.getState()).toMatchObject({ status: "authenticated", signOutReason: null });
  });
});
