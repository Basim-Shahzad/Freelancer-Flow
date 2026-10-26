/** Wire types for `/time-entries`, as sent (camelCase). Money is a decimal string; timestamps are UTC ISO strings. */

export interface TimeEntryResponse {
  id: string;
  projectId: string;
  milestoneId: string | null;
  description: string;
  startTime: string;
  /** null while the timer is running. */
  endTime: string | null;
  isRunning: boolean;
  durationMinutes: number;
  isBillable: boolean;
  isInvoiced: boolean;
  hourlyRate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TimeEntryListResponse {
  timeEntries: TimeEntryResponse[];
  total: number;
}

/** `POST /time-entries`: a completed block of time. */
export interface TimeEntryCreate {
  description: string;
  startTime: string;
  endTime: string;
  isBillable?: boolean;
  projectId: string;
  milestoneId?: string | null;
  hourlyRate?: string | null;
}

/** `POST /time-entries/start` */
export interface TimeEntryStart {
  description: string;
  projectId: string;
  milestoneId?: string | null;
  isBillable?: boolean;
  /** Defaults to now on the server; may not be in the future. */
  startTime?: string;
  hourlyRate?: string | null;
}

/** `PATCH /time-entries/entry/{id}`: every field optional. */
export interface TimeEntryUpdate {
  description?: string;
  startTime?: string;
  endTime?: string;
  isBillable?: boolean;
  milestoneId?: string | null;
  hourlyRate?: string | null;
}

export interface TimeEntryBulkSet {
  projectId?: string;
  /** An explicit `null` clears the milestone. */
  milestoneId?: string | null;
  isBillable?: boolean;
  description?: string;
}

/** `PATCH /time-entries/bulk`: 1 to 200 ids, all-or-nothing. */
export interface TimeEntryBulkUpdate {
  ids: string[];
  set: TimeEntryBulkSet;
}

export interface TimeEntryBulkResult {
  updated: number;
  ids: string[];
}

/** One entry recorded offline, keyed by a client-generated UUID. */
export interface TimeEntrySyncItem {
  id: string;
  startTime: string;
  /** null for a still-running timer. */
  endTime: string | null;
  projectId: string;
  milestoneId?: string | null;
  description: string;
  isBillable: boolean;
  /** The server version the client last saw; omitted for new entries. */
  updatedAt?: string | null;
  deleted: boolean;
}

export interface TimeEntrySyncRequest {
  entries: TimeEntrySyncItem[];
}

export type TimeEntrySyncStatus = "created" | "updated" | "deleted" | "conflict" | "rejected";

export interface TimeEntrySyncResult {
  id: string;
  status: TimeEntrySyncStatus;
  reason: string | null;
  warning: "overlap" | null;
  /** Server copy after the sync, when one exists. */
  entry: TimeEntryResponse | null;
}

export interface TimeEntrySyncResponse {
  results: TimeEntrySyncResult[];
}

/** The server accepts at most this many ids / sync items per call. */
export const MAX_BATCH = 200;
