import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useAppStore } from "@/lib/store";
import { createTestQueryClient, mockApi, profileFixture, seedAuth } from "@/lib/test";
import { profileKeys, useBusiness, useOnboarded, useSaveBusiness, useUpdateProfile } from "./use-profile";

let m: ReturnType<typeof mockApi>;
beforeEach(() => {
  m = mockApi();
  seedAuth("authenticated");
});
afterEach(() => m.restore());

function setup() {
  const client = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}

describe("useOnboarded / useBusiness", () => {
  it("is not ready until the profile loads, then derives onboarded from the business name", async () => {
    m.mock.onGet("/profile").reply(200, profileFixture());
    const { result } = renderHook(() => useOnboarded(), { wrapper: setup().wrapper });
    expect(result.current).toEqual({ ready: false, onboarded: false });
    await waitFor(() => expect(result.current).toEqual({ ready: true, onboarded: true }));
  });

  it("is not onboarded for a fresh profile", async () => {
    m.mock.onGet("/profile").reply(200, profileFixture({ businessName: null }));
    const { result } = renderHook(() => useOnboarded(), { wrapper: setup().wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.onboarded).toBe(false);
  });

  it("stays not ready (and does not claim onboarded) when the request fails", async () => {
    m.mock.onGet("/profile").reply(500);
    const { result } = renderHook(() => useOnboarded(), { wrapper: setup().wrapper });
    await waitFor(() => expect(m.mock.history.get.length).toBe(1));
    expect(result.current).toEqual({ ready: false, onboarded: false });
  });

  it("retries a 401 through the refresh flow", async () => {
    let calls = 0;
    m.mock.onGet("/profile").reply(() => (++calls === 1 ? [401, { detail: "expired" }] : [200, profileFixture()]));
    m.refresh.onPost("/auth/refresh").reply(200, { accessToken: "new" });
    const { result } = renderHook(() => useBusiness(), { wrapper: setup().wrapper });
    await waitFor(() => expect(result.current.businessName).toBe("Malik Studio"));
  });
});

describe("useUpdateProfile", () => {
  it("updates the cache optimistically and keeps the server response", async () => {
    m.mock.onGet("/profile").reply(200, profileFixture());
    m.mock.onPatch("/profile").reply(200, profileFixture({ businessName: "New Name" }));
    const { client, wrapper } = setup();
    const { result } = renderHook(() => ({ update: useUpdateProfile(), business: useBusiness() }), { wrapper });
    await waitFor(() => expect(result.current.business.businessName).toBe("Malik Studio"));
    act(() => { result.current.update.mutate({ businessName: "New Name" }); });
    await waitFor(() => expect(result.current.update.isSuccess).toBe(true));
    expect(JSON.parse(m.mock.history.patch[0]!.data)).toEqual({ businessName: "New Name" });
    expect(client.getQueryData<{ businessName: string }>(profileKeys.detail)?.businessName).toBe("New Name");
  });

  it("rolls back when the server rejects the change", async () => {
    m.mock.onGet("/profile").reply(200, profileFixture());
    m.mock.onPatch("/profile").reply(422, { detail: [{ loc: ["body", "businessName"], msg: "too long" }] });
    const { wrapper } = setup();
    const { result } = renderHook(() => ({ update: useUpdateProfile(), business: useBusiness() }), { wrapper });
    await waitFor(() => expect(result.current.business.businessName).toBe("Malik Studio"));
    await act(async () => { await result.current.update.mutateAsync({ businessName: "x".repeat(300) }).catch(() => undefined); });
    expect(result.current.business.businessName).toBe("Malik Studio");
  });
});

describe("useSaveBusiness", () => {
  it("sends API fields to PATCH /profile and keeps local-only fields in the store", async () => {
    m.mock.onGet("/profile").reply(200, profileFixture());
    m.mock.onPatch("/profile").reply(200, profileFixture({ businessAddress: "Karachi" }));
    const { wrapper } = setup();
    const { result } = renderHook(() => ({ save: useSaveBusiness(), business: useBusiness() }), { wrapper });
    await waitFor(() => expect(result.current.business.businessName).toBe("Malik Studio"));
    await act(async () => { await result.current.save.save({ address: "Karachi", phone: "123", footerNote: "Bye" }); });
    expect(JSON.parse(m.mock.history.patch[0]!.data)).toEqual({ businessAddress: "Karachi" });
    expect(useAppStore.getState().businessLocal).toMatchObject({ phone: "123", footerNote: "Bye" });
  });

  it("does not touch local fields when the API call fails", async () => {
    m.mock.onGet("/profile").reply(200, profileFixture());
    m.mock.onPatch("/profile").reply(500);
    useAppStore.getState().updateBusinessLocal({ phone: "old" });
    const { wrapper } = setup();
    const { result } = renderHook(() => useSaveBusiness(), { wrapper });
    await act(async () => { await result.current.save({ address: "X", phone: "new" }).catch(() => undefined); });
    expect(useAppStore.getState().businessLocal.phone).toBe("old");
  });
});
