import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { seedAuth } from "@/lib/test";
import { router } from "@/lib/test/navigation";
import { useAppStore } from "@/lib/store";
import { useAuthStore } from "@/lib/store/auth";
import { useAuthGate } from "./use-auth-gate";

vi.mock("next/navigation", () => import("@/lib/test/navigation"));
const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { error: toastError, success: vi.fn() } }));

const setApp = (hydrated: boolean, onboarded: boolean) => useAppStore.setState({ hydrated, session: { onboarded } });

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ accessToken: null, user: null, status: "idle", signOutReason: null });
  setApp(true, true);
  window.history.replaceState(null, "", "/projects?tab=time");
});

describe("useAuthGate({ require: 'app' })", () => {
  it.each(["idle", "loading"] as const)("is not ready and does not redirect while status is %s", (status) => {
    useAuthStore.setState({ status });
    const { result } = renderHook(() => useAuthGate({ require: "app" }));
    expect(result.current).toBe(false);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("waits for the persisted store to hydrate", () => {
    seedAuth("authenticated");
    setApp(false, true);
    const { result } = renderHook(() => useAuthGate({ require: "app" }));
    expect(result.current).toBe(false);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("is ready for an authenticated, onboarded user", () => {
    seedAuth("authenticated");
    const { result } = renderHook(() => useAuthGate({ require: "app" }));
    expect(result.current).toBe(true);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("sends signed-out users to /login with next", () => {
    seedAuth("unauthenticated");
    const { result } = renderHook(() => useAuthGate({ require: "app" }));
    expect(result.current).toBe(false);
    expect(router.replace).toHaveBeenCalledWith("/login?next=%2Fprojects%3Ftab%3Dtime");
    expect(toastError).not.toHaveBeenCalled();
  });

  it("sends users who signed out themselves to plain /login", () => {
    seedAuth("unauthenticated");
    useAuthStore.setState({ signOutReason: "manual" });
    renderHook(() => useAuthGate({ require: "app" }));
    expect(router.replace).toHaveBeenCalledWith("/login");
    expect(toastError).not.toHaveBeenCalled();
  });

  it("toasts once and keeps next when the session expired", () => {
    seedAuth("unauthenticated");
    useAuthStore.setState({ signOutReason: "expired" });
    const { rerender } = renderHook(() => useAuthGate({ require: "app" }));
    rerender();
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastError.mock.calls[0]?.[0]).toMatch(/session expired/i);
    expect(router.replace).toHaveBeenCalledWith("/login?next=%2Fprojects%3Ftab%3Dtime");
    expect(useAuthStore.getState().signOutReason).toBeNull();
  });

  it("sends authenticated, un-onboarded users to /onboarding", () => {
    seedAuth("authenticated");
    setApp(true, false);
    const { result } = renderHook(() => useAuthGate({ require: "app" }));
    expect(result.current).toBe(false);
    expect(router.replace).toHaveBeenCalledWith("/onboarding");
  });
});

describe("useAuthGate({ require: 'onboarding' })", () => {
  it("is ready for authenticated, un-onboarded users", () => {
    seedAuth("authenticated");
    setApp(true, false);
    expect(renderHook(() => useAuthGate({ require: "onboarding" })).result.current).toBe(true);
  });

  it("sends onboarded users to the dashboard", () => {
    seedAuth("authenticated");
    renderHook(() => useAuthGate({ require: "onboarding" }));
    expect(router.replace).toHaveBeenCalledWith("/dashboard");
  });

  it("does not redirect while suspended (wizard is finishing)", () => {
    seedAuth("authenticated");
    renderHook(() => useAuthGate({ require: "onboarding", suspended: { current: true } }));
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("sends signed-out users to /login without next", () => {
    seedAuth("unauthenticated");
    renderHook(() => useAuthGate({ require: "onboarding" }));
    expect(router.replace).toHaveBeenCalledWith("/login");
  });
});
