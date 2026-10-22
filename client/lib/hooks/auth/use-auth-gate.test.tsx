import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient, mockApi, profileFixture, seedAuth } from "@/lib/test";
import { router } from "@/lib/test/navigation";
import { useAuthStore } from "@/lib/store/auth";
import { useAuthGate } from "./use-auth-gate";

vi.mock("next/navigation", () => import("@/lib/test/navigation"));
const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { error: toastError, success: vi.fn() } }));

let m: ReturnType<typeof mockApi>;
/** The profile decides "onboarded": a business name means done, `null` means the wizard still has to run. */
const setProfile = (onboarded: boolean) => m.mock.onGet("/profile").reply(200, profileFixture({ businessName: onboarded ? "Malik Studio" : null }));
const useGate = (opts: Parameters<typeof useAuthGate>[0]) => {
  const client = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return renderHook(() => useAuthGate(opts), { wrapper });
};

afterEach(() => m.restore());

beforeEach(() => {
  vi.clearAllMocks();
  m = mockApi();
  useAuthStore.setState({ accessToken: null, user: null, status: "idle", signOutReason: null });
  setProfile(true);
  window.history.replaceState(null, "", "/projects?tab=time");
});

describe("useAuthGate({ require: 'app' })", () => {
  it.each(["idle", "loading"] as const)("is not ready and does not redirect while status is %s", (status) => {
    useAuthStore.setState({ status });
    const { result } = useGate({ require: "app" });
    expect(result.current).toBe(false);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("stays not ready, without redirecting, until the profile has loaded", async () => {
    seedAuth("authenticated");
    const { result } = useGate({ require: "app" });
    expect(result.current).toBe(false);
    expect(router.replace).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current).toBe(true));
  });

  it("is ready for an authenticated, onboarded user", async () => {
    seedAuth("authenticated");
    const { result } = useGate({ require: "app" });
    await waitFor(() => expect(result.current).toBe(true));
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("sends signed-out users to /login with next", () => {
    seedAuth("unauthenticated");
    const { result } = useGate({ require: "app" });
    expect(result.current).toBe(false);
    expect(router.replace).toHaveBeenCalledWith("/login?next=%2Fprojects%3Ftab%3Dtime");
    expect(toastError).not.toHaveBeenCalled();
  });

  it("sends users who signed out themselves to plain /login", () => {
    seedAuth("unauthenticated");
    useAuthStore.setState({ signOutReason: "manual" });
    useGate({ require: "app" });
    expect(router.replace).toHaveBeenCalledWith("/login");
    expect(toastError).not.toHaveBeenCalled();
  });

  it("toasts once and keeps next when the session expired", () => {
    seedAuth("unauthenticated");
    useAuthStore.setState({ signOutReason: "expired" });
    const { rerender } = useGate({ require: "app" });
    rerender();
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastError.mock.calls[0]?.[0]).toMatch(/session expired/i);
    expect(router.replace).toHaveBeenCalledWith("/login?next=%2Fprojects%3Ftab%3Dtime");
    expect(useAuthStore.getState().signOutReason).toBeNull();
  });

  it("sends authenticated users with an incomplete profile to /onboarding", async () => {
    seedAuth("authenticated");
    m.mock.reset();
    setProfile(false);
    const { result } = useGate({ require: "app" });
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/onboarding?next=%2Fprojects%3Ftab%3Dtime"));
    expect(result.current).toBe(false);
  });

  it("does not carry an auth page into next", async () => {
    seedAuth("authenticated");
    m.mock.reset();
    setProfile(false);
    window.history.replaceState(null, "", "/login");
    useGate({ require: "app" });
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/onboarding"));
  });
});

describe("useAuthGate({ require: 'onboarding' })", () => {
  it("is ready for authenticated users whose profile is incomplete", async () => {
    seedAuth("authenticated");
    m.mock.reset();
    setProfile(false);
    const { result } = useGate({ require: "onboarding" });
    await waitFor(() => expect(result.current).toBe(true));
  });

  it("sends onboarded users to the dashboard", async () => {
    seedAuth("authenticated");
    useGate({ require: "onboarding" });
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/dashboard"));
  });

  it("does not redirect while suspended (wizard is finishing)", async () => {
    seedAuth("authenticated");
    const { result } = useGate({ require: "onboarding", suspended: { current: true } });
    await waitFor(() => expect(result.current).toBe(true));
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("sends signed-out users to /login without next", () => {
    seedAuth("unauthenticated");
    useGate({ require: "onboarding" });
    expect(router.replace).toHaveBeenCalledWith("/login");
  });
});
