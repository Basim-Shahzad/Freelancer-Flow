// useTimeTracking.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "./useApi.jsx";

// Type for creating time entry (what we send)
interface CreateTimeEntryData {
   project_id: number;
   description: string;
   start_time: number;
   end_time: number;
   duration_ms: number;
}

export function useTimeTracking() {
   const { api } = useApi();
   const queryClient = useQueryClient();

   // Fetch timeEntries
   const {
      data: timeEntries = [],
      error,
      isLoading,
   } = useQuery({
      queryKey: ["time-entries"],
      queryFn: async () => {
         try {
            const res = await api.get("/time-entries/");
            return res.data;
         } catch (error) {
            console.error(error);
            throw error; // ✅ Re-throw so React Query knows it failed
         }
      },
   });

   // Create time entry mutation
   const createTimeEntry = useMutation({
      mutationFn: (timeEntryData: CreateTimeEntryData) => {
         const payload = {
            project_id: timeEntryData.project_id,
            description: timeEntryData.description,
            start_time: new Date(timeEntryData.start_time).toISOString(),
            end_time: new Date(timeEntryData.end_time).toISOString(),
            duration_minutes: Math.round(timeEntryData.duration_ms / 60000),
         };

         return api.post("/create-time-entry/", payload);
      },
      onSuccess: () => {
         queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      },
   });

   return {
      timeEntries,
      error,
      isLoading,
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
