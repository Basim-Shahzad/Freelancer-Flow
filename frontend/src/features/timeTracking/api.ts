import { api } from "@/hooks/useApi.js";
import type { TimeEntry, TimerState } from "./type.js";

export const timeTrackingApi = {
   getTimeEntries: async (params?: { page: number; size: number } | { paginate: string }): Promise<{ items: TimeEntry[]; total: number }> => {
      const { data } = await api.get("/time-entries/", {
         params: params || { paginate: 'false' },
      });

      return {
         items: data.timeEntries || [],
         total: data.total || data.count || data.timeEntries?.length || 0,
      };
   },
   createTimeEntry: async (entryData: Omit<TimeEntry, "id" | "created_at">): Promise<TimeEntry> => {
      const { data } = await api.post<TimeEntry>("/create-time-entry/", entryData);
      return data;
   },

   updateTimeEntry: async (id: number, entryData: Partial<TimeEntry>): Promise<TimeEntry> => {
      const { data } = await api.patch<TimeEntry>(`/time-entries/${id}/update/`, entryData);
      return data;
   },
};
