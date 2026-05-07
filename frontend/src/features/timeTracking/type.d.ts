import type { Project } from "../projects/types.js";

export interface TimeEntry {
   id: string;
   description: string;
   startTime: string;
   endTime: string;
   durationMinutes: number;
   isBillable: boolean;
   invoiced: boolean;
   invoice?: Invoice | null;
   updatedAt: string;
   project: Project;
   createdAt: string;
}

export interface TimerState {
   selectedProjectId: string | null;
   description: string;
   status: "idle" | "running" | "paused";
   elapsedMs: number;
   startTime: number | null;
   isBillable: boolean;
}

interface TimeEntryInList {
   id: string;
   description: string;
   durationMinutes: number;
   isBillable: boolean;
   invoiced: boolean;
   projectId: string;
   createdAt: string;
}

export type PaginatedTimeEntryListResponse = {
   count: number;
   next: any;
   previous: any;
   results: {
      timeEntries: TimeEntryInList[];
   };
};

export type nonPaginatedTimeEntryListResponse = {
   count: number;
   timeEntries: TimeEntryInList[];
};
