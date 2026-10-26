import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { TimeEntryResponse } from "@/lib/api/time-entries.types";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/services/api.service";
import { createTestQueryClient, mockApi, seedAuth } from "@/lib/test";
import { runningEntryFixture, timeEntryFixture, timeEntryResponseFixture } from "@/lib/test/time-entries";
import { useAppStore } from "@/lib/store";
import { useOutbox } from "@/lib/time/outbox-store";
import {
  timeKeys, useAllTimeEntries, useBulkUpdateTimeEntries, useCreateTimeEntry, useDeleteTimeEntries, useRunningTimer, useStartTimer,
  useStopTimer, useUpdateTimeEntry,
} from "./use-time-entries";

let m: ReturnType<typeof mockApi>;
beforeEach(() => {
  m = mockApi();
  seedAuth("authenticated");
  useOutbox.getState().reset();
  localStorage.clear();
  useAppStore.setState({ online: true });
});
afterEach(() => m.restore());

function setup() {
  const client = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}

const input = { description: "Work", projectId: "p1", milestoneId: "", date: "2026-10-05", startTime: "09:00", minutes: 60, billable: true };

describe("useRunningTimer", () => {
  it("is null when nothing runs", async () => {
    m.mock.onGet("/time-entries/running").reply(200, null);
    const { result } = renderHook(() => useRunningTimer(), { wrapper: setup().wrapper });
    await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
    expect(result.current.running).toBeNull();
  });

  it("returns the running entry", async () => {
    m.mock.onGet("/time-entries/running").reply(200, runningEntryFixture());
    const { result } = renderHook(() => useRunningTimer(), { wrapper: setup().wrapper });
    await waitFor(() => expect(result.current.running?.id).toBe("r1"));
    expect(result.current.running?.endAt).toBeUndefined();
  });

  it("retries after a 401 through the refresh flow", async () => {
    let calls = 0;
    m.mock.onGet("/time-entries/running").reply(() => (++calls === 1 ? [401, { detail: "expired" }] : [200, runningEntryFixture()]));
    m.refresh.onPost("/auth/refresh").reply(200, { accessToken: "new" });
    const { result } = renderHook(() => useRunningTimer(), { wrapper: setup().wrapper });
    await waitFor(() => expect(result.current.running?.id).toBe("r1"));
  });

  it("surfaces a network error and still shows a timer started offline", async () => {
    m.mock.onGet("/time-entries/running").networkError();
    useOutbox.getState().enqueue({ type: "start", entry: { id: "off", projectId: "p1", description: "Offline", billable: true, startAt: "2026-10-05T09:00:00.000Z" } });
    const { result } = renderHook(() => useRunningTimer(), { wrapper: setup().wrapper });
    await waitFor(() => expect(result.current.query.isError).toBe(true));
    expect(result.current.running).toMatchObject({ id: "off", unsynced: true });
  });
});

describe("useStartTimer / useStopTimer", () => {
  it("starts a timer and puts it into the running cache", async () => {
    m.mock.onPost("/time-entries/start").reply(201, runningEntryFixture());
    const { client, wrapper } = setup();
    m.mock.onGet("/time-entries/running").reply(200, runningEntryFixture());
    const { result } = renderHook(() => useStartTimer(), { wrapper });
    let r;
    await act(async () => { r = await result.current.mutateAsync({ description: "Running task", projectId: "p1" }); });
    expect(r).toMatchObject({ queued: false, entry: { id: "r1" } });
    expect(JSON.parse(m.mock.history.post[0]!.data as string)).toMatchObject({ description: "Running task", projectId: "p1", isBillable: true });
    expect(client.getQueryData(timeKeys.running())).toMatchObject({ id: "r1" });
  });

  it("surfaces the server detail of a 409 when a timer already runs, and queues nothing", async () => {
    m.mock.onPost("/time-entries/start").reply(409, { detail: "A timer is already running" });
    const { result } = renderHook(() => useStartTimer(), { wrapper: setup().wrapper });
    await act(async () => { await result.current.mutateAsync({ description: "x", projectId: "p1" }).catch(() => undefined); });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(getApiErrorStatus(result.current.error)).toBe(409);
    expect(getApiErrorMessage(result.current.error)).toBe("A timer is already running");
    expect(useOutbox.getState().items).toEqual([]);
  });

  it("maps a 422 start error", async () => {
    m.mock.onPost("/time-entries/start").reply(422, { detail: [{ loc: ["body", "description"], msg: "too short", type: "x" }] });
    const { result } = renderHook(() => useStartTimer(), { wrapper: setup().wrapper });
    await act(async () => { await result.current.mutateAsync({ description: "x", projectId: "p1" }).catch(() => undefined); });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(getApiErrorStatus(result.current.error)).toBe(422);
  });

  it("queues a start offline without calling the API", async () => {
    useAppStore.setState({ online: false });
    const { result } = renderHook(() => useStartTimer(), { wrapper: setup().wrapper });
    let r;
    await act(async () => { r = await result.current.mutateAsync({ description: "Offline work", projectId: "p1" }); });
    expect(r).toMatchObject({ queued: true });
    expect(m.mock.history.post).toHaveLength(0);
    expect(useOutbox.getState().items).toHaveLength(1);
    expect(useOutbox.getState().items[0]).toMatchObject({ description: "Offline work", endAt: null, deleted: false });
  });

  it("queues the start when the network drops mid-call", async () => {
    m.mock.onPost("/time-entries/start").networkError();
    const { result } = renderHook(() => useStartTimer(), { wrapper: setup().wrapper });
    await act(async () => { await result.current.mutateAsync({ description: "x", projectId: "p1" }); });
    expect(useOutbox.getState().items).toHaveLength(1);
  });

  it("stops via the API and clears the running cache", async () => {
    m.mock.onPost("/time-entries/entry/r1/stop").reply(200, timeEntryResponseFixture({ id: "r1" }));
    m.mock.onGet("/time-entries/running").reply(200, null);
    const { client, wrapper } = setup();
    client.setQueryData(timeKeys.running(), runningEntryFixture());
    const { result } = renderHook(() => useStopTimer(), { wrapper });
    await act(async () => { await result.current.mutateAsync({ entry: timeEntryFixture({ id: "r1" }) }); });
    expect(client.getQueryData(timeKeys.running())).toBeNull();
  });

  it("queues a stop offline, and a stop of an offline-started timer coalesces into one finished item", async () => {
    useAppStore.setState({ online: false });
    const { result: start } = renderHook(() => useStartTimer(), { wrapper: setup().wrapper });
    let started: { entry: ReturnType<typeof timeEntryFixture> } | undefined;
    await act(async () => { started = (await start.current.mutateAsync({ description: "Off", projectId: "p1" })) as never; });
    const { result: stop } = renderHook(() => useStopTimer(), { wrapper: setup().wrapper });
    await act(async () => { await stop.current.mutateAsync({ entry: started!.entry, stoppedAt: new Date(Date.now() + 3_600_000).toISOString() }); });
    const items = useOutbox.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0]!.endAt).not.toBeNull();
    expect(items[0]!.seenUpdatedAt).toBeUndefined();
    expect(m.mock.history.post).toHaveLength(0);
  });
});

describe("create / update / delete", () => {
  it("creates an entry with UTC start and end", async () => {
    m.mock.onPost("/time-entries").reply(201, timeEntryResponseFixture());
    m.mock.onGet().reply(200, null);
    const { result } = renderHook(() => useCreateTimeEntry(), { wrapper: setup().wrapper });
    await act(async () => { await result.current.mutateAsync(input); });
    const body = JSON.parse(m.mock.history.post[0]!.data as string);
    expect(body).toMatchObject({ projectId: "p1", description: "Work", startTime: new Date(2026, 9, 5, 9, 0).toISOString(), endTime: new Date(2026, 9, 5, 10, 0).toISOString() });
  });

  it("surfaces 422 field errors from create", async () => {
    m.mock.onPost("/time-entries").reply(422, { detail: [{ loc: ["body", "end_time"], msg: "end_time must be after start_time", type: "value_error" }] });
    const { result } = renderHook(() => useCreateTimeEntry(), { wrapper: setup().wrapper });
    await act(async () => { await result.current.mutateAsync(input).catch(() => undefined); });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(getApiErrorStatus(result.current.error)).toBe(422);
  });

  it("queues an offline log with a client-generated UUID", async () => {
    useAppStore.setState({ online: false });
    const { result } = renderHook(() => useCreateTimeEntry(), { wrapper: setup().wrapper });
    await act(async () => { await result.current.mutateAsync(input); });
    expect(useOutbox.getState().items[0]!.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(useOutbox.getState().items[0]!.endAt).toBe(new Date(2026, 9, 5, 10, 0).toISOString());
  });

  it("patches an entry, and shows the locked-entry detail on a 409", async () => {
    m.mock.onPatch("/time-entries/entry/t1").replyOnce(409, { detail: "Invoiced entries cannot be edited" });
    const { result } = renderHook(() => useUpdateTimeEntry(), { wrapper: setup().wrapper });
    await act(async () => { await result.current.mutateAsync({ entry: timeEntryFixture(), input }).catch(() => undefined); });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(getApiErrorMessage(result.current.error)).toBe("Invoiced entries cannot be edited");
    m.mock.onPatch("/time-entries/entry/t1").reply(200, timeEntryResponseFixture({ description: "Work" }));
    m.mock.onGet().reply(200, null);
    await act(async () => { await result.current.mutateAsync({ entry: timeEntryFixture(), input }); });
    expect(JSON.parse(m.mock.history.patch[1]!.data as string)).not.toHaveProperty("projectId");
  });

  it("queues an update of an offline-born entry instead of patching it", async () => {
    const { result } = renderHook(() => useUpdateTimeEntry(), { wrapper: setup().wrapper });
    await act(async () => { await result.current.mutateAsync({ entry: timeEntryFixture({ id: "new", unsynced: true }), input }); });
    expect(m.mock.history.patch).toHaveLength(0);
    expect(useOutbox.getState().items.map((q) => q.id)).toEqual(["new"]);
  });

  it("deletes, reports a 404 and an invoiced 409 per entry, and queues on network failure", async () => {
    m.mock.onDelete("/time-entries/entry/a").reply(204);
    m.mock.onDelete("/time-entries/entry/b").reply(404, { detail: "Not found" });
    m.mock.onDelete("/time-entries/entry/c").reply(409, { detail: "Invoiced" });
    m.mock.onDelete("/time-entries/entry/d").networkError();
    m.mock.onGet().reply(200, null);
    m.mock.onPost("/time-entries/sync").networkError();
    const { result } = renderHook(() => useDeleteTimeEntries(), { wrapper: setup().wrapper });
    let out;
    await act(async () => { out = await result.current.mutateAsync(["a", "b", "c", "d"].map((id) => timeEntryFixture({ id }))); });
    expect(out).toMatchObject({ deleted: 1, queued: 1 });
    expect((out as unknown as { failed: { id: string; error: unknown }[] }).failed.map((f) => [f.id, getApiErrorStatus(f.error)])).toEqual([["b", 404], ["c", 409]]);
    expect(useOutbox.getState().items.map((q) => [q.id, q.deleted])).toEqual([["d", true]]);
  });
});

describe("useBulkUpdateTimeEntries", () => {
  const ids = ["a", "b"];
  it("sends { ids, set } in one call", async () => {
    m.mock.onPatch("/time-entries/bulk").reply(200, { updated: 2, ids });
    m.mock.onGet().reply(200, null);
    const { result } = renderHook(() => useBulkUpdateTimeEntries(), { wrapper: setup().wrapper });
    let r;
    await act(async () => { r = await result.current.mutateAsync({ ids, change: { projectId: "p2", billable: false, milestoneId: null } }); });
    expect(r).toEqual({ updated: 2, ids });
    expect(JSON.parse(m.mock.history.patch[0]!.data as string)).toEqual({ ids, set: { projectId: "p2", isBillable: false, milestoneId: null } });
  });

  it.each([
    [409, "Invoiced entries can only change their description"],
    [404, "Time entry not found"],
    [422, "Milestone does not belong to the target project"],
  ])("surfaces the %i detail", async (status, detail) => {
    m.mock.onPatch("/time-entries/bulk").reply(status, { detail });
    const { result } = renderHook(() => useBulkUpdateTimeEntries(), { wrapper: setup().wrapper });
    await act(async () => { await result.current.mutateAsync({ ids, change: { billable: true } }).catch(() => undefined); });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(getApiErrorStatus(result.current.error)).toBe(status);
    expect(getApiErrorMessage(result.current.error)).toBe(detail);
  });

  it("refuses more than 200 ids without calling the API", async () => {
    const { result } = renderHook(() => useBulkUpdateTimeEntries(), { wrapper: setup().wrapper });
    await act(async () => { await result.current.mutateAsync({ ids: Array.from({ length: 201 }, (_, i) => `e${i}`), change: { billable: true } }).catch(() => undefined); });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toMatch(/at most 200/);
    expect(m.mock.history.patch).toHaveLength(0);
  });
});

describe("useAllTimeEntries", () => {
  const page = (n: number, from: number): TimeEntryResponse[] => Array.from({ length: n }, (_, i) => timeEntryResponseFixture({ id: `e${from + i}`, projectId: "p1" }));

  it("fetches each project and pages 100 at a time", async () => {
    m.mock.onGet("/time-entries/p1").reply((c) => {
      const skip = (c.params as { skip: number }).skip;
      return [200, { timeEntries: skip === 0 ? page(100, 0) : page(20, 100), total: 120 }];
    });
    m.mock.onGet("/time-entries/p2").reply(200, { timeEntries: [timeEntryResponseFixture({ id: "x", projectId: "p2" })], total: 1 });
    const { result } = renderHook(() => useAllTimeEntries(["p1", "p2"]), { wrapper: setup().wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toHaveLength(121);
    const calls = m.mock.history.get.filter((r) => r.url === "/time-entries/p1");
    expect(calls.map((c) => c.params)).toEqual([{ skip: 0, limit: 100 }, { skip: 100, limit: 100 }]);
  });

  it("is empty without projects", async () => {
    const { result } = renderHook(() => useAllTimeEntries([]), { wrapper: setup().wrapper });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.data).toEqual([]);
  });

  it("errors when any project fails to load, instead of showing partial totals", async () => {
    m.mock.onGet("/time-entries/p1").reply(200, { timeEntries: page(1, 0), total: 1 });
    m.mock.onGet("/time-entries/p2").reply(404, { detail: "Project not found" });
    const { result } = renderHook(() => useAllTimeEntries(["p1", "p2"]), { wrapper: setup().wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
    expect(getApiErrorStatus(result.current.error)).toBe(404);
  });

  it("lays the outbox over the server list", async () => {
    m.mock.onGet("/time-entries/p1").reply(200, { timeEntries: page(2, 0), total: 2 });
    useOutbox.getState().enqueue({ type: "log", entry: { id: "q1", projectId: "p1", description: "Queued", billable: true, startAt: "2026-10-05T09:00:00.000Z" }, endAt: "2026-10-05T10:00:00.000Z" });
    useOutbox.getState().enqueue({ type: "delete", entry: { id: "e0", projectId: "p1", description: "", billable: true, startAt: "2026-10-05T09:00:00.000Z", seenUpdatedAt: "v" }, endAt: null });
    const { result } = renderHook(() => useAllTimeEntries(["p1"]), { wrapper: setup().wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data!.map((e) => [e.id, e.unsynced ?? false])).toEqual([["e1", false], ["q1", true]]);
  });
});
