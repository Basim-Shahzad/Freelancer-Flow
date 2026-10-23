import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getApiErrorStatus } from "@/lib/services/api.service";
import { clientFixture, clientListItemFixture, createTestQueryClient, mockApi, profileFixture, seedAuth } from "@/lib/test";
import { clientKeys, useClient, useClientOptions, useClients, useCreateClient, useDeleteClient, useUpdateClient } from "./use-clients";

let m: ReturnType<typeof mockApi>;
beforeEach(() => {
  m = mockApi();
  seedAuth("authenticated");
  m.mock.onGet("/profile").reply(200, profileFixture());
});
afterEach(() => m.restore());

function setup() {
  const client = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}

const listCalls = () => m.mock.history.get.filter((r) => r.url === "/clients");
const items = (n: number, offset = 0) => Array.from({ length: n }, (_, i) => clientListItemFixture({ id: `c${offset + i}`, name: `Client ${offset + i}` }));

describe("useClients", () => {
  it("loads the first page", async () => {
    m.mock.onGet("/clients").reply(200, { clients: items(2), total: 2 });
    const { result } = renderHook(() => useClients(), { wrapper: setup().wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.clients.map((c) => c.id)).toEqual(["c0", "c1"]);
    expect(result.current.data?.total).toBe(2);
    expect(result.current.hasNextPage).toBe(false);
  });

  it("returns an empty list", async () => {
    m.mock.onGet("/clients").reply(200, { clients: [], total: 0 });
    const { result } = renderHook(() => useClients(), { wrapper: setup().wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ clients: [], total: 0 });
  });

  it("surfaces a 500 as an error", async () => {
    m.mock.onGet("/clients").reply(500, { detail: "boom" });
    const { result } = renderHook(() => useClients(), { wrapper: setup().wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(getApiErrorStatus(result.current.error)).toBe(500);
  });

  it("surfaces a network error", async () => {
    m.mock.onGet("/clients").networkError();
    const { result } = renderHook(() => useClients(), { wrapper: setup().wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("retries after a 401 through the refresh flow", async () => {
    let calls = 0;
    m.mock.onGet("/clients").reply(() => (++calls === 1 ? [401, { detail: "expired" }] : [200, { clients: items(1), total: 1 }]));
    m.refresh.onPost("/auth/refresh").reply(200, { accessToken: "new" });
    const { result } = renderHook(() => useClients(), { wrapper: setup().wrapper });
    await waitFor(() => expect(result.current.data?.clients).toHaveLength(1));
  });

  it("sends the search term and omits it when empty", async () => {
    m.mock.onGet("/clients").reply(200, { clients: [], total: 0 });
    const { result, rerender } = renderHook(({ search }) => useClients({ search }), { wrapper: setup().wrapper, initialProps: { search: "" } });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(listCalls()[0]!.params).not.toHaveProperty("search");
    rerender({ search: "harbor" });
    await waitFor(() => expect(listCalls().at(-1)!.params).toMatchObject({ search: "harbor", skip: 0 }));
  });

  it("loads more using the skip offset", async () => {
    m.mock.onGet("/clients").reply((config) => {
      const skip = Number(config.params.skip);
      return [200, { clients: skip === 0 ? items(2) : items(1, 2), total: 3 }];
    });
    const { result } = renderHook(() => useClients({ limit: 2 }), { wrapper: setup().wrapper });
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    await act(async () => { await result.current.fetchNextPage(); });
    await waitFor(() => expect(result.current.data?.clients).toHaveLength(3));
    expect(listCalls()[1]!.params).toMatchObject({ skip: 2, limit: 2 });
    expect(result.current.hasNextPage).toBe(false);
  });
});

describe("useClient", () => {
  it("maps the detail and falls back to the profile defaults", async () => {
    m.mock.onGet("/clients/c1").reply(200, clientFixture({ currency: null, paymentTermsDays: null }));
    const { result } = renderHook(() => useClient("c1"), { wrapper: setup().wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({ id: "c1", companyName: "Harbor Labs", currency: "USD", termsDays: 14 });
  });

  it("reports a 404", async () => {
    m.mock.onGet("/clients/nope").reply(404, { detail: "Client not found" });
    const { result } = renderHook(() => useClient("nope"), { wrapper: setup().wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(getApiErrorStatus(result.current.error)).toBe(404);
  });
});

describe("mutations", () => {
  it("creates a client and invalidates the lists", async () => {
    m.mock.onGet("/clients").reply(200, { clients: items(1), total: 1 });
    m.mock.onPost("/clients").reply(201, clientFixture({ id: "new" }));
    const { client, wrapper } = setup();
    const { result } = renderHook(() => ({ list: useClients(), create: useCreateClient() }), { wrapper });
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
    await act(async () => { await result.current.create.mutateAsync({ name: "New", email: "n@x.example" }); });
    expect(client.getQueryData(clientKeys.detail("new"))).toBeTruthy();
    await waitFor(() => expect(listCalls().length).toBe(2));
  });

  it("rejects a create with 422 and 409", async () => {
    m.mock.onPost("/clients").replyOnce(422, { detail: [{ loc: ["body", "whatsapp_number"], msg: "Invalid phone number" }] });
    m.mock.onPost("/clients").replyOnce(409, { detail: "A client with this email already exists" });
    const { result } = renderHook(() => useCreateClient(), { wrapper: setup().wrapper });
    const first = await act(async () => result.current.mutateAsync({ name: "A", email: "a@x.example" }).catch((e: unknown) => e));
    expect(getApiErrorStatus(first)).toBe(422);
    const second = await act(async () => result.current.mutateAsync({ name: "A", email: "a@x.example" }).catch((e: unknown) => e));
    expect(getApiErrorStatus(second)).toBe(409);
  });

  it("patches only what it is given", async () => {
    m.mock.onPatch("/clients/c1").reply(200, clientFixture({ name: "Renamed" }));
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useUpdateClient("c1"), { wrapper });
    await act(async () => { await result.current.mutateAsync({ name: "Renamed" }); });
    expect(JSON.parse(m.mock.history.patch[0]!.data)).toEqual({ name: "Renamed" });
    expect(client.getQueryData<{ name: string }>(clientKeys.detail("c1"))?.name).toBe("Renamed");
  });

  it("reports a 404 on update", async () => {
    m.mock.onPatch("/clients/gone").reply(404, { detail: "Client not found" });
    const { result } = renderHook(() => useUpdateClient("gone"), { wrapper: setup().wrapper });
    const err = await act(async () => result.current.mutateAsync({ name: "x" }).catch((e: unknown) => e));
    expect(getApiErrorStatus(err)).toBe(404);
  });

  it("deletes and drops the detail query", async () => {
    m.mock.onDelete("/clients/c1").reply(204);
    const { client, wrapper } = setup();
    client.setQueryData(clientKeys.detail("c1"), clientFixture());
    const { result } = renderHook(() => useDeleteClient(), { wrapper });
    await act(async () => { await result.current.mutateAsync("c1"); });
    expect(client.getQueryData(clientKeys.detail("c1"))).toBeUndefined();
  });

  it("surfaces the server's message when a delete is blocked (409)", async () => {
    m.mock.onDelete("/clients/c1").reply(409, { detail: "Client has invoices and cannot be deleted" });
    const { result } = renderHook(() => useDeleteClient(), { wrapper: setup().wrapper });
    const err = await act(async () => result.current.mutateAsync("c1").catch((e: unknown) => e));
    expect(getApiErrorStatus(err)).toBe(409);
  });
});

describe("useClientOptions", () => {
  it("pages through every client 100 at a time", async () => {
    m.mock.onGet("/clients").reply((config) => {
      const skip = Number(config.params.skip);
      return [200, { clients: items(Math.min(100, 250 - skip), skip), total: 250 }];
    });
    const { result } = renderHook(() => useClientOptions(), { wrapper: setup().wrapper });
    await waitFor(() => expect(result.current.clients).toHaveLength(250));
    expect(listCalls().map((r) => r.params)).toEqual([{ skip: 0, limit: 100 }, { skip: 100, limit: 100 }, { skip: 200, limit: 100 }]);
    expect(result.current.byId.get("c249")?.name).toBe("Client 249");
  });

  it("shares one request between callers", async () => {
    m.mock.onGet("/clients").reply(200, { clients: items(2), total: 2 });
    const { wrapper } = setup();
    const { result } = renderHook(() => ({ a: useClientOptions(), b: useClientOptions() }), { wrapper });
    await waitFor(() => expect(result.current.a.clients).toHaveLength(2));
    expect(result.current.b.clients).toHaveLength(2);
    expect(listCalls()).toHaveLength(1);
  });
});
