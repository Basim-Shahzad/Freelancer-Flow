import type {
  TimeEntryBulkResult, TimeEntryBulkUpdate, TimeEntryCreate, TimeEntryListResponse, TimeEntryResponse, TimeEntryStart,
  TimeEntrySyncRequest, TimeEntrySyncResponse, TimeEntryUpdate,
} from "@/lib/api/time-entries.types";
import { cleanParams, toListResult, type ListParams } from "@/lib/api/pagination";
import { api } from "./api.service";

export const timeEntriesService = {
  /** The caller's running entry, or `null`. */
  running: () => api.get<TimeEntryResponse | null>("/time-entries/running").then((r) => r.data ?? null),
  start: (body: TimeEntryStart) => api.post<TimeEntryResponse>("/time-entries/start", body).then((r) => r.data),
  stop: (id: string) => api.post<TimeEntryResponse>(`/time-entries/entry/${id}/stop`).then((r) => r.data),
  /** Per project: the API has no "list all" endpoint (by decision). */
  listByProject: (projectId: string, params: ListParams = {}) =>
    api.get<TimeEntryListResponse>(`/time-entries/${projectId}`, { params: cleanParams(params) }).then((r) => toListResult(r.data, "timeEntries")),
  create: (body: TimeEntryCreate) => api.post<TimeEntryResponse>("/time-entries", body).then((r) => r.data),
  patch: (id: string, body: TimeEntryUpdate) => api.patch<TimeEntryResponse>(`/time-entries/entry/${id}`, body).then((r) => r.data),
  remove: (id: string) => api.delete(`/time-entries/entry/${id}`).then(() => undefined),
  bulk: (body: TimeEntryBulkUpdate) => api.patch<TimeEntryBulkResult>("/time-entries/bulk", body).then((r) => r.data),
  sync: (body: TimeEntrySyncRequest) => api.post<TimeEntrySyncResponse>("/time-entries/sync", body).then((r) => r.data.results),
};
