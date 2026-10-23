import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getApiErrorStatus } from "@/lib/services/api.service";
import { createTestQueryClient, mockApi, seedAuth } from "@/lib/test";
import { paymentMethodResponseFixture, paymentMethodResponses } from "@/lib/test/payment-methods";
import {
  paymentMethodKeys, useCreatePaymentMethod, useDeletePaymentMethod, usePaymentMethod, usePaymentMethods, useReorderPaymentMethods, useSetDefaultPaymentMethod,
  useTogglePaymentMethod, useUpdatePaymentMethod,
} from "./use-payment-methods";

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

const listCalls = () => m.mock.history.get.filter((r) => r.url === "/payment-methods");
const ids = (list?: { id: string }[]) => list?.map((x) => x.id);
/** A reply the test settles by hand, to observe the optimistic state while the request is in flight. */
function deferred() {
  let release!: (status: number, body?: unknown) => void;
  const gate = new Promise<[number, unknown]>((resolve) => { release = (status, body) => resolve([status, body]); });
  return { gate, release };
}

describe("usePaymentMethods", () => {
  it("loads and maps the list, asking for inactive methods by default", async () => {
    m.mock.onGet("/payment-methods").reply(200, { paymentMethods: paymentMethodResponses() });
    const { result } = renderHook(() => usePaymentMethods(), { wrapper: setup().wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(ids(result.current.data)).toEqual(["pm-payoneer", "pm-esfca", "pm-pkrbank", "pm-raast", "pm-jazzcash"]);
    expect(result.current.data?.[0]).toMatchObject({ kind: "payoneer", enabled: true, isDefault: true });
    expect(listCalls()[0]!.params).toEqual({ include_inactive: true });
  });

  it("can ask for active methods only", async () => {
    m.mock.onGet("/payment-methods").reply(200, { paymentMethods: [] });
    const { result } = renderHook(() => usePaymentMethods({ includeInactive: false }), { wrapper: setup().wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(listCalls()[0]!.params).toEqual({ include_inactive: false });
  });

  it("returns an empty list", async () => {
    m.mock.onGet("/payment-methods").reply(200, { paymentMethods: [] });
    const { result } = renderHook(() => usePaymentMethods(), { wrapper: setup().wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it("surfaces a 500 and a network error", async () => {
    m.mock.onGet("/payment-methods").replyOnce(500, { detail: "boom" });
    const first = renderHook(() => usePaymentMethods(), { wrapper: setup().wrapper });
    await waitFor(() => expect(first.result.current.isError).toBe(true));
    expect(getApiErrorStatus(first.result.current.error)).toBe(500);
    m.mock.onGet("/payment-methods").networkError();
    const second = renderHook(() => usePaymentMethods(), { wrapper: setup().wrapper });
    await waitFor(() => expect(second.result.current.isError).toBe(true));
  });

  it("does not fetch while signed out", async () => {
    seedAuth("unauthenticated");
    const { result } = renderHook(() => usePaymentMethods(), { wrapper: setup().wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(listCalls()).toHaveLength(0);
  });

  it("retries after a 401 through the refresh flow", async () => {
    let calls = 0;
    m.mock.onGet("/payment-methods").reply(() => (++calls === 1 ? [401, { detail: "expired" }] : [200, { paymentMethods: paymentMethodResponses() }]));
    m.refresh.onPost("/auth/refresh").reply(200, { accessToken: "new" });
    const { result } = renderHook(() => usePaymentMethods(), { wrapper: setup().wrapper });
    await waitFor(() => expect(result.current.data).toHaveLength(5));
  });
});

describe("usePaymentMethod", () => {
  it("maps one method and reports a 404", async () => {
    m.mock.onGet("/payment-methods/pm-raast").reply(200, paymentMethodResponseFixture("RAAST"));
    m.mock.onGet("/payment-methods/nope").reply(404, { detail: "Payment method not found" });
    const { wrapper } = setup();
    const ok = renderHook(() => usePaymentMethod("pm-raast"), { wrapper });
    await waitFor(() => expect(ok.result.current.isSuccess).toBe(true));
    expect(ok.result.current.data?.kind).toBe("raast");
    const missing = renderHook(() => usePaymentMethod("nope"), { wrapper });
    await waitFor(() => expect(missing.result.current.isError).toBe(true));
    expect(getApiErrorStatus(missing.result.current.error)).toBe(404);
  });
});

describe("create / update / delete", () => {
  it("creates a method and refetches the lists", async () => {
    m.mock.onGet("/payment-methods").reply(200, { paymentMethods: paymentMethodResponses() });
    m.mock.onPost("/payment-methods").reply(201, paymentMethodResponseFixture("EASYPAISA"));
    const { client, wrapper } = setup();
    const { result } = renderHook(() => ({ list: usePaymentMethods(), create: useCreatePaymentMethod() }), { wrapper });
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
    await act(async () => { await result.current.create.mutateAsync({ type: "EASYPAISA", label: "Easypaisa", details: { mobileNumber: "0321 5550214", accountTitle: "A" } }); });
    expect(client.getQueryData(paymentMethodKeys.detail("pm-easypaisa"))).toBeTruthy();
    await waitFor(() => expect(listCalls()).toHaveLength(2));
  });

  it("rejects a create with 422 (bad IBAN) and 409", async () => {
    m.mock.onPost("/payment-methods").replyOnce(422, { detail: [{ loc: ["body"], msg: "Value error, iban: invalid IBAN checksum" }] });
    m.mock.onPost("/payment-methods").replyOnce(409, { detail: "conflict" });
    const { result } = renderHook(() => useCreatePaymentMethod(), { wrapper: setup().wrapper });
    const body = { type: "WISE_TO_IBAN" as const, label: "Wise", details: { iban: "BE00" } };
    expect(getApiErrorStatus(await act(async () => result.current.mutateAsync(body).catch((e: unknown) => e)))).toBe(422);
    expect(getApiErrorStatus(await act(async () => result.current.mutateAsync(body).catch((e: unknown) => e)))).toBe(409);
  });

  it("patches a method and stores the normalised response", async () => {
    m.mock.onPatch("/payment-methods/pm-wise").reply(200, paymentMethodResponseFixture("WISE_TO_IBAN", { label: "Renamed" }));
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useUpdatePaymentMethod(), { wrapper });
    await act(async () => { await result.current.mutateAsync({ id: "pm-wise", body: { label: "Renamed" } }); });
    expect(JSON.parse(m.mock.history.patch[0]!.data)).toEqual({ label: "Renamed" });
    expect(client.getQueryData<{ label: string }>(paymentMethodKeys.detail("pm-wise"))?.label).toBe("Renamed");
  });

  it("reports a 404 on update", async () => {
    m.mock.onPatch("/payment-methods/gone").reply(404, { detail: "Payment method not found" });
    const { result } = renderHook(() => useUpdatePaymentMethod(), { wrapper: setup().wrapper });
    const err = await act(async () => result.current.mutateAsync({ id: "gone", body: { label: "x" } }).catch((e: unknown) => e));
    expect(getApiErrorStatus(err)).toBe(404);
  });

  it("refetches after a delete instead of removing the row (the server may soft-delete)", async () => {
    let calls = 0;
    // The server soft-deletes: the method is still listed (inactive) after the DELETE.
    m.mock.onGet("/payment-methods").reply(() => [200, { paymentMethods: ++calls === 1 ? paymentMethodResponses() : paymentMethodResponses().map((x) => (x.id === "pm-raast" ? { ...x, isActive: false } : x)) }]);
    m.mock.onDelete("/payment-methods/pm-raast").reply(204);
    const { result } = renderHook(() => ({ list: usePaymentMethods(), del: useDeletePaymentMethod() }), { wrapper: setup().wrapper });
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
    await act(async () => { await result.current.del.mutateAsync("pm-raast"); });
    await waitFor(() => expect(listCalls()).toHaveLength(2));
    expect(ids(result.current.list.data)).toContain("pm-raast");
    expect(result.current.list.data?.find((x) => x.id === "pm-raast")?.enabled).toBe(false);
  });
});

describe("reorder", () => {
  const reversed = () => paymentMethodResponses().reverse().map((x, i) => ({ ...x, sortOrder: i }));

  it("shows the new order before the response and sends every id", async () => {
    const d = deferred();
    m.mock.onGet("/payment-methods").reply(200, { paymentMethods: paymentMethodResponses() });
    m.mock.onPut("/payment-methods/order").reply(() => d.gate);
    const { result } = renderHook(() => ({ list: usePaymentMethods(), reorder: useReorderPaymentMethods() }), { wrapper: setup().wrapper });
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
    const next = ["pm-jazzcash", "pm-raast", "pm-pkrbank", "pm-esfca", "pm-payoneer"];
    act(() => { result.current.reorder.mutate(next); });
    await waitFor(() => expect(ids(result.current.list.data)).toEqual(next));
    expect(result.current.reorder.isPending).toBe(true);
    await act(async () => { d.release(200, { paymentMethods: reversed() }); });
    await waitFor(() => expect(result.current.reorder.isSuccess).toBe(true));
    expect(JSON.parse(m.mock.history.put[0]!.data)).toEqual({ ids: next });
  });

  it("rolls back when the server refuses", async () => {
    const d = deferred();
    m.mock.onGet("/payment-methods").reply(200, { paymentMethods: paymentMethodResponses() });
    m.mock.onPut("/payment-methods/order").reply(() => d.gate);
    const { result } = renderHook(() => ({ list: usePaymentMethods(), reorder: useReorderPaymentMethods() }), { wrapper: setup().wrapper });
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
    const original = ids(result.current.list.data);
    act(() => { result.current.reorder.mutate(["pm-jazzcash", "pm-raast", "pm-pkrbank", "pm-esfca", "pm-payoneer"]); });
    await waitFor(() => expect(ids(result.current.list.data)?.[0]).toBe("pm-jazzcash"));
    await act(async () => { d.release(422, { detail: "ids must list every payment method exactly once" }); });
    await waitFor(() => expect(result.current.reorder.isError).toBe(true));
    await waitFor(() => expect(ids(result.current.list.data)).toEqual(original));
  });
});

describe("set default", () => {
  it("switches the default optimistically, leaving exactly one", async () => {
    const d = deferred();
    m.mock.onGet("/payment-methods").reply(200, { paymentMethods: paymentMethodResponses() });
    m.mock.onPatch("/payment-methods/pm-esfca").reply(() => d.gate);
    const { result } = renderHook(() => ({ list: usePaymentMethods(), def: useSetDefaultPaymentMethod() }), { wrapper: setup().wrapper });
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
    act(() => { result.current.def.mutate({ id: "pm-esfca", isActive: true }); });
    await waitFor(() => expect(result.current.list.data?.filter((x) => x.isDefault).map((x) => x.id)).toEqual(["pm-esfca"]));
    await act(async () => { d.release(200, paymentMethodResponseFixture("ESFCA_WIRE", { isDefault: true })); });
    await waitFor(() => expect(result.current.def.isSuccess).toBe(true));
    expect(JSON.parse(m.mock.history.patch[0]!.data)).toEqual({ isDefault: true });
  });

  it("also activates an inactive method, and rolls back on failure", async () => {
    const d = deferred();
    m.mock.onGet("/payment-methods").reply(200, { paymentMethods: paymentMethodResponses() });
    m.mock.onPatch("/payment-methods/pm-jazzcash").reply(() => d.gate);
    const { result } = renderHook(() => ({ list: usePaymentMethods(), def: useSetDefaultPaymentMethod() }), { wrapper: setup().wrapper });
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
    act(() => { result.current.def.mutate({ id: "pm-jazzcash", isActive: false }); });
    await waitFor(() => expect(result.current.list.data?.find((x) => x.id === "pm-jazzcash")).toMatchObject({ isDefault: true, enabled: true }));
    await act(async () => { d.release(404, { detail: "Payment method not found" }); });
    await waitFor(() => expect(result.current.def.isError).toBe(true));
    await waitFor(() => expect(result.current.list.data?.find((x) => x.id === "pm-jazzcash")).toMatchObject({ isDefault: false, enabled: false }));
    expect(result.current.list.data?.find((x) => x.id === "pm-payoneer")?.isDefault).toBe(true);
    expect(JSON.parse(m.mock.history.patch[0]!.data)).toEqual({ isDefault: true, isActive: true });
  });
});

describe("toggle", () => {
  it("flips isActive optimistically and rolls back on failure", async () => {
    const d = deferred();
    m.mock.onGet("/payment-methods").reply(200, { paymentMethods: paymentMethodResponses() });
    m.mock.onPatch("/payment-methods/pm-raast").reply(() => d.gate);
    const { result } = renderHook(() => ({ list: usePaymentMethods(), toggle: useTogglePaymentMethod() }), { wrapper: setup().wrapper });
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
    act(() => { result.current.toggle.mutate({ id: "pm-raast", isActive: false }); });
    await waitFor(() => expect(result.current.list.data?.find((x) => x.id === "pm-raast")?.enabled).toBe(false));
    await act(async () => { d.release(500, { detail: "boom" }); });
    await waitFor(() => expect(result.current.toggle.isError).toBe(true));
    await waitFor(() => expect(result.current.list.data?.find((x) => x.id === "pm-raast")?.enabled).toBe(true));
    expect(JSON.parse(m.mock.history.patch[0]!.data)).toEqual({ isActive: false });
  });
});
