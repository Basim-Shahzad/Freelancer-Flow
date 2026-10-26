import type { TimeEntryResponse, TimeEntrySyncResult } from "@/lib/api/time-entries.types";
import type { TimeEntry } from "@/lib/types";

/** A completed `TimeEntryResponse` (1 h on project p1). */
export function timeEntryResponseFixture(overrides: Partial<TimeEntryResponse> = {}): TimeEntryResponse {
  return {
    id: "t1", projectId: "p1", milestoneId: null, description: "Checkout flow QA", startTime: "2026-10-05T09:00:00Z",
    endTime: "2026-10-05T10:00:00Z", isRunning: false, durationMinutes: 60, isBillable: true, isInvoiced: false, hourlyRate: null,
    createdAt: "2026-10-05T10:00:00Z", updatedAt: "2026-10-05T10:00:00Z", ...overrides,
  };
}

/** A running entry (no `endTime`). */
export function runningEntryFixture(overrides: Partial<TimeEntryResponse> = {}): TimeEntryResponse {
  return timeEntryResponseFixture({ id: "r1", endTime: null, isRunning: true, durationMinutes: 0, description: "Running task", ...overrides });
}

export function syncResultFixture(overrides: Partial<TimeEntrySyncResult> = {}): TimeEntrySyncResult {
  return { id: "t1", status: "created", reason: null, warning: null, entry: timeEntryResponseFixture(), ...overrides };
}

/** A time entry view model. */
export function timeEntryFixture(overrides: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: "t1", projectId: "p1", description: "Checkout flow QA", date: "2026-10-05", startTime: "09:00", minutes: 60, billable: true,
    isInvoiced: false, updatedAt: "2026-10-05T10:00:00.000Z", ...overrides,
  };
}
