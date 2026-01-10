import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "./useApi.tsx";
import type { TimeEntry } from "@/types/models.js";
import { useAuth } from "@/Contexts/AuthContext.js";

interface CreateTimeEntryData {
   project_id: number;
   description: string;
   start_time: number;
   end_time: number;
   duration_ms: number;
   is_billable: boolean;
}

export function useTimeTracking() {
   const { api } = useApi();
   const queryClient = useQueryClient();
   const { isInitialized, isLoggedin } = useAuth();

   // Fetch timeEntries
   const {
      data: timeEntries = [],
      error,
      isLoading,
   } = useQuery({
      queryKey: ["time-entries"],
      queryFn: async (): Promise<TimeEntry[]> => {
         try {
            const res = await api.get("/time-entries/");
            return res.data;
         } catch (error) {
            console.error(error);
            throw error;
         }
      },
      enabled: isInitialized && isLoggedin,
   });

   // Create time entry mutation
   const createTimeEntry = useMutation({
      mutationFn: async (timeEntryData: CreateTimeEntryData) => {
         const payload = {
            project_id: timeEntryData.project_id,
            description: timeEntryData.description,
            start_time: new Date(timeEntryData.start_time).toISOString(),
            end_time: new Date(timeEntryData.end_time).toISOString(),
            duration_minutes: Math.floor(timeEntryData.duration_ms / 60000),
            is_billable: timeEntryData.is_billable,
            invoiced: false,
         };
         const res = await api.post("/create-time-entry/", payload);
         return res.data;
      },
      onSuccess: () => {
         queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      },
   });

   return {
      timeEntries,
      timeEntriesError: error,
      timeEntriesLoading: isLoading,
      createTimeEntry: createTimeEntry.mutate,
      createTimeEntryAsync: createTimeEntry.mutateAsync,
      isCreating: createTimeEntry.isPending,
   };
}

export const useUpdateTimeEntryDesc = () => {
   const qc = useQueryClient();
   const { api } = useApi();

   return useMutation({
      mutationFn: ({ id, description }: { id: number; description: string }) =>
         api.patch(`/time-entries/${id}/`, { description }),

      onSuccess: () => {
         qc.invalidateQueries({ queryKey: ["time-entries"] });
      },
   });
};
