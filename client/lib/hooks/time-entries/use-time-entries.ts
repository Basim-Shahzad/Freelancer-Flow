"use client";

import { useMutation, useQueries, useQuery, useQueryClient, type QueryClient, type UseQueryResult } from "@tanstack/react-query";
import axios from "axios";
import { useMemo } from "react";
import {
  addMinutesIso, bulkToWire, inputToCreate, inputToStart, inputToUpdate, localToUtc, responseToTimeEntry,
  type BulkChange, type CurrencyOf, type StartInput, type TimeEntryInput,
} from "@/lib/api/mappers/time-entries";
import { MAX_BATCH, type TimeEntryResponse } from "@/lib/api/time-entries.types";
import { useSession } from "@/lib/hooks/auth/use-auth";
import { projectKeys } from "@/lib/hooks/projects";
import { timeEntriesService } from "@/lib/services/time-entries.service";
import { useAppStore } from "@/lib/store";
import { mergeOutbox, queuedToTimeEntry, resolveRunning, snapshotOf, type EntrySnapshot } from "@/lib/time/outbox";
import { useOutbox } from "@/lib/time/outbox-store";
import type { TimeEntry } from "@/lib/types";
import { timeKeys } from "./keys";
import { flushOutbox } from "./sync";

export { timeKeys } from "./keys";

const PAGE = 100;

/** What a write returns: the entry, and whether it only reached the offline outbox so far. */
export interface WriteResult {
  entry: TimeEntry;
  queued: boolean;
  /** The server copy, when the call went through. */
  raw?: TimeEntryResponse;
}

const isNetworkError = (e: unknown): boolean => axios.isAxiosError(e) && !e.response;
const isOnline = () => useAppStore.getState().online;
const newId = () => globalThis.crypto.randomUUID();

/**
 * Calls the API, or queues the change in the outbox when offline, when the network drops mid-call, or when the
 * entry itself only exists in the outbox (`forceQueue`). Server errors (409, 422, ...) are never queued.
 */
async function viaApiOrQueue(call: () => Promise<TimeEntryResponse>, queue: () => TimeEntry, currencyOf?: CurrencyOf, forceQueue = false): Promise<WriteResult> {
  if (forceQueue || !isOnline()) return { entry: queue(), queued: true };
  try {
    const raw = await call();
    return { entry: responseToTimeEntry(raw, currencyOf), queued: false, raw };
  } catch (e) {
    if (isNetworkError(e)) return { entry: queue(), queued: true };
    throw e;
  }
}

/** Refreshes everything a time change touches. Dashboard and activity keys join here when those steps land. */
function invalidateTime(qc: QueryClient) {
  return Promise.all([qc.invalidateQueries({ queryKey: timeKeys.all }), qc.invalidateQueries({ queryKey: projectKeys.all })]);
}

/** After a write: sync the running-timer cache, replay the outbox when online, refetch. */
function afterWrite(qc: QueryClient, result?: WriteResult) {
  if (result?.raw) qc.setQueryData(timeKeys.running(), result.raw.isRunning ? result.raw : null);
  if (result?.queued && isOnline()) void flushOutbox(qc);
  return invalidateTime(qc);
}

const mutationBase = { networkMode: "always" as const };

/**
 * The caller's running entry. Refetched on window focus and after every time mutation. The offline outbox is laid
 * over the server's answer: a queued stop ends it, a timer started offline is it. Elapsed time is computed by the
 * caller from `startAt`.
 */
export function useRunningTimer(currencyOf?: CurrencyOf) {
  const { isAuthenticated } = useSession();
  const queue = useOutbox((s) => s.items);
  const query = useQuery({
    queryKey: timeKeys.running(),
    queryFn: () => timeEntriesService.running(),
    enabled: isAuthenticated,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
  const server = useMemo(() => (query.data ? responseToTimeEntry(query.data, currencyOf) : null), [query.data, currencyOf]);
  const running = useMemo(() => resolveRunning(server, queue), [server, queue]);
  return { running, query };
}

export function useStartTimer() {
  const qc = useQueryClient();
  return useMutation({
    ...mutationBase,
    mutationFn: (input: StartInput) =>
      viaApiOrQueue(
        () => timeEntriesService.start(inputToStart(input)),
        () => {
          const entry: EntrySnapshot = {
            id: newId(), projectId: input.projectId, milestoneId: input.milestoneId || undefined, description: input.description.trim(),
            billable: input.billable ?? true, startAt: input.startAt ?? new Date().toISOString(),
          };
          useOutbox.getState().enqueue({ type: "start", entry });
          return queuedToTimeEntry({ ...entry, endAt: null, deleted: false, queuedAt: entry.startAt });
        },
      ),
    onSuccess: (r) => afterWrite(qc, r),
  });
}

/** Stops the running entry (`stoppedAt` defaults to now; it is what an offline stop records). */
export function useStopTimer() {
  const qc = useQueryClient();
  return useMutation({
    ...mutationBase,
    mutationFn: ({ entry, stoppedAt = new Date().toISOString() }: { entry: TimeEntry; stoppedAt?: string }) =>
      viaApiOrQueue(
        () => timeEntriesService.stop(entry.id),
        () => {
          useOutbox.getState().enqueue({ type: "stop", entry: snapshotOf(entry), endAt: stoppedAt });
          return { ...entry, endAt: stoppedAt, minutes: Math.max(1, Math.round((new Date(stoppedAt).getTime() - new Date(entry.startAt ?? stoppedAt).getTime()) / 60_000)) };
        },
        undefined,
        entry.unsynced,
      ),
    onSuccess: (r) => afterWrite(qc, r),
  });
}

export function useCreateTimeEntry(currencyOf?: CurrencyOf) {
  const qc = useQueryClient();
  return useMutation({
    ...mutationBase,
    mutationFn: (input: TimeEntryInput) =>
      viaApiOrQueue(
        () => timeEntriesService.create(inputToCreate(input)),
        () => {
          const startAt = localToUtc(input.date, input.startTime);
          const entry: EntrySnapshot = {
            id: newId(), projectId: input.projectId, milestoneId: input.milestoneId || undefined, description: input.description.trim(),
            billable: input.billable, startAt,
          };
          const endAt = addMinutesIso(startAt, input.minutes);
          useOutbox.getState().enqueue({ type: "log", entry, endAt });
          return queuedToTimeEntry({ ...entry, endAt, deleted: false, queuedAt: startAt });
        },
        currencyOf,
      ),
    onSuccess: (r) => afterWrite(qc, r),
  });
}

export function useUpdateTimeEntry(currencyOf?: CurrencyOf) {
  const qc = useQueryClient();
  return useMutation({
    ...mutationBase,
    mutationFn: ({ entry, input }: { entry: TimeEntry; input: TimeEntryInput }) =>
      viaApiOrQueue(
        () => timeEntriesService.patch(entry.id, inputToUpdate(input)),
        () => {
          const startAt = localToUtc(input.date, input.startTime);
          const endAt = addMinutesIso(startAt, input.minutes);
          const snap: EntrySnapshot = {
            ...snapshotOf(entry), description: input.description.trim(), milestoneId: input.milestoneId || undefined, billable: input.billable, startAt,
          };
          useOutbox.getState().enqueue({ type: "update", entry: snap, endAt });
          return queuedToTimeEntry({ ...snap, endAt, deleted: false, queuedAt: startAt });
        },
        currencyOf,
        entry.unsynced,
      ),
    onSuccess: (r) => afterWrite(qc, r),
  });
}

export interface DeleteOutcome {
  deleted: number;
  /** Entries the server refused (e.g. invoiced: 409), with the error. */
  failed: { id: string; error: unknown }[];
  /** Deletes that only reached the outbox. */
  queued: number;
}

/** Deletes entries one by one (the API has no bulk delete), queueing the ones that can't reach the server. */
export function useDeleteTimeEntries() {
  const qc = useQueryClient();
  return useMutation({
    ...mutationBase,
    mutationFn: async (entries: TimeEntry[]): Promise<DeleteOutcome> => {
      const out: DeleteOutcome = { deleted: 0, failed: [], queued: 0 };
      const queueDelete = (e: TimeEntry) => {
        useOutbox.getState().enqueue({ type: "delete", entry: snapshotOf(e), endAt: e.endAt ?? null });
        out.queued += 1;
      };
      for (const e of entries) {
        if (e.unsynced || !isOnline()) { queueDelete(e); continue; }
        try {
          await timeEntriesService.remove(e.id);
          out.deleted += 1;
        } catch (error) {
          if (isNetworkError(error)) queueDelete(e);
          else out.failed.push({ id: e.id, error });
        }
      }
      return out;
    },
    onSettled: (r) => {
      if (r && r.queued > 0 && isOnline()) void flushOutbox(qc);
      return invalidateTime(qc);
    },
  });
}

/**
 * One all-or-nothing call that changes up to 200 entries. Invoiced entries may only change `description` (409);
 * ids that aren't the caller's are a 404; a milestone outside the target project is a 422. Not queued offline.
 * Changing the project re-resolves rates on the server, so the screen refetches instead of recomputing.
 */
export function useBulkUpdateTimeEntries() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, change }: { ids: string[]; change: BulkChange }) => {
      if (ids.length === 0) throw new Error("Select at least one entry.");
      if (ids.length > MAX_BATCH) throw new Error(`Bulk edit takes at most ${MAX_BATCH} entries at a time. Select fewer.`);
      return timeEntriesService.bulk({ ids, set: bulkToWire(change) });
    },
    onSuccess: () => invalidateTime(qc),
  });
}

async function fetchAllForProject(projectId: string): Promise<TimeEntryResponse[]> {
  const items: TimeEntryResponse[] = [];
  for (;;) {
    const page = await timeEntriesService.listByProject(projectId, { skip: items.length, limit: PAGE });
    items.push(...page.items);
    if (page.items.length === 0 || items.length >= page.total) return items;
  }
}

type ProjectQuery = UseQueryResult<TimeEntryResponse[]>;

const combineProjects = (results: ProjectQuery[]) => ({
  data: results.map((r) => r.data),
  isPending: results.some((r) => r.isPending),
  isError: results.some((r) => r.isError),
  isFetching: results.some((r) => r.isFetching),
  error: results.find((r) => r.error)?.error ?? null,
  refetch: () => Promise.all(results.map((r) => r.refetch())),
});

export interface AllTimeEntries {
  data: TimeEntry[] | undefined;
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => Promise<unknown>;
}

/**
 * Every time entry the user has, with the offline outbox laid over it. The API lists entries per project and
 * there is no "list all" endpoint (by decision), so this fetches each project's entries (100 per request) in
 * parallel. `data` stays undefined until every project has loaded, so totals are never partial.
 */
export function useAllTimeEntries(projectIds: string[], currencyOf?: CurrencyOf): AllTimeEntries {
  const { isAuthenticated } = useSession();
  const queue = useOutbox((s) => s.items);
  const combined = useQueries({
    queries: projectIds.map((id) => ({
      queryKey: timeKeys.project(id),
      queryFn: () => fetchAllForProject(id),
      enabled: isAuthenticated,
      staleTime: 30_000,
    })),
    combine: combineProjects,
  });
  const { data: lists, isPending, isError, isFetching, error, refetch } = combined;
  const data = useMemo(() => {
    if (isPending || isError) return undefined;
    const server = lists.flatMap((l) => (l ?? []).map((r) => responseToTimeEntry(r, currencyOf)));
    return mergeOutbox(server, queue);
  }, [lists, isPending, isError, queue, currencyOf]);
  return { data, isPending, isError, isFetching, error, refetch };
}
