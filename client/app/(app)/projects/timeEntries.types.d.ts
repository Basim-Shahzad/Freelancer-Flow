export interface TimeEntry {
   id: string;
   description: string;
   startTime: string;
   endTime: string;
   durationMinutes: number;
   isBillable: boolean;
   isInvoiced: boolean;
   projectId: string;
   createdAt: string;
   updatedAt: string;
}

export interface TimeEntriesListResponse {
   timeEntries: TimeEntry[];
   total: number;
}