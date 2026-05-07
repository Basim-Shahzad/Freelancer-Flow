import { api } from "@/services/api.js";
import type { TimeEntry, TimerState, PaginatedTimeEntryListResponse, TimeEntryInList, nonPaginatedTimeEntryListResponse } from "./type.js";

export const timeTrackingApi = {
   getTimeEntries: async (paginate: boolean): Promise<PaginatedTimeEntryListResponse | nonPaginatedTimeEntryListResponse> => {
      const { data } = await api.get("/time-entries/", {
         params: { paginate },
      });
      return paginate ? (data as PaginatedTimeEntryListResponse) : (data as nonPaginatedTimeEntryListResponse)
   },
   createTimeEntry: async (entryData: Partial<TimeEntry & TimeEntryInList>): Promise<TimeEntry> => {
      const { data } = await api.post<TimeEntry>("/time-entries/", entryData);
      return data;
   },

   updateTimeEntry: async (id: string, entryData: Partial<TimeEntry>): Promise<TimeEntry> => {
      const { data } = await api.patch<TimeEntry>(`/time-entries/${id}/`, entryData);
      return data;
   },
};
