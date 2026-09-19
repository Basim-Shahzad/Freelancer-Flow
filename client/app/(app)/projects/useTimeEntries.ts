import api from "@/services/api.service";
import { TimeEntry, TimeEntriesListResponse } from "./timeEntries.types";

export const useTimeEntries = {
   getAll: (projectId?: string) => api.get<TimeEntriesListResponse>("/time-entries/", { params: { projectId } }),
   create: (data: Partial<TimeEntry>) => api.post("/time-entries/", data),
};
