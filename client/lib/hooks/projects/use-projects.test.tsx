import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getApiErrorStatus } from "@/lib/services/api.service";
import { createTestQueryClient, mockApi, profileFixture, seedAuth } from "@/lib/test";
import { periodResponseFixture, projectResponseFixture } from "@/lib/test/projects";
import { projectKeys, useCreateProject, useDeleteProject, useProject, useProjectOptions, useProjects, useRetainerPeriods, useUpdateProject } from "./use-projects";
import { responseToProject } from "@/lib/api/mappers/projects";

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

const listCalls = () => m.mock.history.get.filter((r) => r.url === "/projects");
const items = (n: number, offset = 0) => Array.from({ length: n }, (_, i) => projectResponseFixture({ id: `p${offset + i}`, name: `Project ${offset + i}` }));

describe("useProjects", () => {
  it("loads the first page", async () => {
    m.mock.onGet("/projects").reply(200, { projects: items(2), total: 2 });
    const { result } = renderHook(() => useProjects(), { wrapper: setup().wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.projects.map((p) => p.id)).toEqual(["p0", "p1"]);
    expect(result.current.data?.total).toBe(2);
    expect(result.current.hasNextPage).toBe(false);
  });

  it("returns an empty list", async () => {
    m.mock.onGet("/projects").reply(200, { projects: [], total: 0 });
    const { result } = renderHook(() => useProjects(), { wrapper: setup().wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ projects: [], total: 0 });
  });

  it("surfaces a 500 and a network error", async () => {
    m.mock.onGet("/projects").replyOnce(500, { detail: "boom" });
    const a = renderHook(() => useProjects(), { wrapper: setup().wrapper });
    await waitFor(() => expect(a.result.current.isError).toBe(true));
    expect(getApiErrorStatus(a.result.current.error)).toBe(500);
    m.mock.onGet("/projects").networkError();
    const b = renderHook(() => useProjects(), { wrapper: setup().wrapper });
    await waitFor(() => expect(b.result.current.isError).toBe(true));
  });

  it("retries after a 401 through the refresh flow", async () => {
    let calls = 0;
    m.mock.onGet("/projects").reply(() => (++calls === 1 ? [401, { detail: "expired" }] : [200, { projects: items(1), total: 1 }]));
    m.refresh.onPost("/auth/refresh").reply(200, { accessToken: "new" });
    const { result } = renderHook(() => useProjects(), { wrapper: setup().wrapper });
    await waitFor(() => expect(result.current.data?.projects).toHaveLength(1));
  });

  it("sends search, client_id and status, and omits them when empty", async () => {
    m.mock.onGet("/projects").reply(200, { projects: [], total: 0 });
    const { result, rerender } = renderHook((f: { search?: string; clientId?: string; status?: "ACTIVE" }) => useProjects(f), { wrapper: setup().wrapper, initialProps: {} });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(listCalls()[0]!.params).toEqual({ skip: 0, limit: 20 });
    rerender({ search: "brand", clientId: "c1", status: "ACTIVE" });
    await waitFor(() => expect(listCalls().at(-1)!.params).toMatchObject({ search: "brand", client_id: "c1", status: "ACTIVE", skip: 0 }));
  });

  it("loads more using the skip offset", async () => {
    m.mock.onGet("/projects").reply((config) => {
      const skip = Number(config.params.skip);
      return [200, { projects: skip === 0 ? items(2) : items(1, 2), total: 3 }];
    });
    const { result } = renderHook(() => useProjects({ limit: 2 }), { wrapper: setup().wrapper });
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    await act(async () => { await result.current.fetchNextPage(); });
    await waitFor(() => expect(result.current.data?.projects).toHaveLength(3));
    expect(listCalls()[1]!.params).toMatchObject({ skip: 2, limit: 2 });
  });
});

describe("useProject", () => {
  it("maps the detail, with a null progressPercent", async () => {
    m.mock.onGet("/projects/p1").reply(200, projectResponseFixture({ progressPercent: null }));
    const { result } = renderHook(() => useProject("p1"), { wrapper: setup().wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({ id: "p1", billingType: "hourly", hourlyRate: 4500, progressPercent: null });
  });

  it("reports a 404", async () => {
    m.mock.onGet("/projects/nope").reply(404, { detail: "Project not found" });
    const { result } = renderHook(() => useProject("nope"), { wrapper: setup().wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(getApiErrorStatus(result.current.error)).toBe(404);
  });
});

describe("mutations", () => {
  it("creates a project and invalidates the lists", async () => {
    m.mock.onGet("/projects").reply(200, { projects: items(1), total: 1 });
    m.mock.onPost("/projects").reply(201, projectResponseFixture({ id: "new" }));
    const { client, wrapper } = setup();
    const { result } = renderHook(() => ({ list: useProjects(), create: useCreateProject() }), { wrapper });
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
    await act(async () => { await result.current.create.mutateAsync({ name: "New", clientId: "c1" }); });
    expect(client.getQueryData(projectKeys.detail("new"))).toBeTruthy();
    await waitFor(() => expect(listCalls().length).toBe(2));
  });

  it("rejects a retainer without amount and interval with 422", async () => {
    m.mock.onPost("/projects").reply(422, { detail: [{ loc: ["body", "retainerAmount"], msg: "retainerAmount is required for RETAINER projects", type: "value_error" }] });
    const { result } = renderHook(() => useCreateProject(), { wrapper: setup().wrapper });
    const err = await act(async () => result.current.mutateAsync({ name: "R", clientId: "c1", billingType: "RETAINER" }).catch((e: unknown) => e));
    expect(getApiErrorStatus(err)).toBe(422);
  });

  it("patches only what it is given", async () => {
    m.mock.onPatch("/projects/p1").reply(200, projectResponseFixture({ name: "Renamed" }));
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useUpdateProject("p1"), { wrapper });
    await act(async () => { await result.current.mutateAsync({ name: "Renamed" }); });
    expect(JSON.parse(m.mock.history.patch[0]!.data)).toEqual({ name: "Renamed" });
    expect(client.getQueryData<{ name: string }>(projectKeys.detail("p1"))?.name).toBe("Renamed");
  });

  it("reports a 404 on update", async () => {
    m.mock.onPatch("/projects/gone").reply(404, { detail: "Project not found" });
    const { result } = renderHook(() => useUpdateProject("gone"), { wrapper: setup().wrapper });
    const err = await act(async () => result.current.mutateAsync({ name: "x" }).catch((e: unknown) => e));
    expect(getApiErrorStatus(err)).toBe(404);
  });

  it("deletes and drops the detail query", async () => {
    m.mock.onDelete("/projects/p1").reply(204);
    const { client, wrapper } = setup();
    client.setQueryData(projectKeys.detail("p1"), projectResponseFixture());
    const { result } = renderHook(() => useDeleteProject(), { wrapper });
    await act(async () => { await result.current.mutateAsync("p1"); });
    expect(client.getQueryData(projectKeys.detail("p1"))).toBeUndefined();
  });

  it("surfaces the server's message when a delete is blocked (409)", async () => {
    m.mock.onDelete("/projects/p1").reply(409, { detail: "Project has invoices and cannot be deleted" });
    const { result } = renderHook(() => useDeleteProject(), { wrapper: setup().wrapper });
    const err = await act(async () => result.current.mutateAsync("p1").catch((e: unknown) => e));
    expect(getApiErrorStatus(err)).toBe(409);
  });
});

describe("useRetainerPeriods", () => {
  const retainer = responseToProject(projectResponseFixture({ billingType: "RETAINER", hourlyRate: null, retainerAmount: "1300.00", retainerInterval: "MONTHLY" }));

  it("maps periods with the retainer amount and the invoiced state", async () => {
    m.mock.onGet("/projects/p1/retainer-periods").reply(200, { periods: [periodResponseFixture({ invoiceId: "inv1" }), periodResponseFixture({ periodStart: "2026-11-01", periodEnd: "2026-11-30", label: "Nov 2026" })] });
    const { result } = renderHook(() => useRetainerPeriods(retainer), { wrapper: setup().wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map((p) => [p.label, p.amount, p.invoiceId])).toEqual([["Oct 2026", 130000, "inv1"], ["Nov 2026", 130000, undefined]]);
  });

  it("does not fetch for a non-retainer project", () => {
    const hourly = responseToProject(projectResponseFixture());
    const { result } = renderHook(() => useRetainerPeriods(hourly), { wrapper: setup().wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(m.mock.history.get.some((r) => r.url?.includes("retainer-periods"))).toBe(false);
  });
});

describe("useProjectOptions", () => {
  it("pages through every project 100 at a time", async () => {
    m.mock.onGet("/projects").reply((config) => {
      const skip = Number(config.params.skip);
      return [200, { projects: items(Math.min(100, 150 - skip), skip), total: 150 }];
    });
    const { result } = renderHook(() => useProjectOptions(), { wrapper: setup().wrapper });
    await waitFor(() => expect(result.current.projects).toHaveLength(150));
    expect(listCalls().map((r) => r.params)).toEqual([{ skip: 0, limit: 100 }, { skip: 100, limit: 100 }]);
    expect(result.current.byId.get("p149")?.name).toBe("Project 149");
  });

  it("shares one request between callers", async () => {
    m.mock.onGet("/projects").reply(200, { projects: items(2), total: 2 });
    const { wrapper } = setup();
    const { result } = renderHook(() => ({ a: useProjectOptions(), b: useProjectOptions() }), { wrapper });
    await waitFor(() => expect(result.current.a.projects).toHaveLength(2));
    expect(listCalls()).toHaveLength(1);
  });
});
