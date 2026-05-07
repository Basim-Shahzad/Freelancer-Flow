import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { timeTrackingApi } from "./api.js";
import { useAuthStore } from "@/features/auth/store.js";
import { toast } from "react-hot-toast";
import type { nonPaginatedTimeEntryListResponse, PaginatedTimeEntryListResponse, TimeEntry } from "./type.js";
import { useTimerStore } from "./store.js";
import { useEffect } from "react";

// Fetch time entries
export const useTimeEntries = <T extends boolean>(paginate: T) => {
   const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

   return useQuery({
      queryKey: ["timeEntries", paginate],
      queryFn: () =>
         timeTrackingApi.getTimeEntries(paginate) as Promise<
            T extends true ? PaginatedTimeEntryListResponse : nonPaginatedTimeEntryListResponse
         >,
      enabled: isAuthenticated,
      staleTime: 1000 * 60 * 5,
   });
};

// Create time entry
export const useCreateTimeEntry = () => {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: timeTrackingApi.createTimeEntry,
      onSuccess: () => {
         queryClient.invalidateQueries({ queryKey: ["timeEntries"] });
         toast.success("Time Entry created successfully");
      },
      onError: (error: any) => {
         toast.error(error?.response?.data?.message || "Failed to create Time Entry");
      },
   });
};

// Update time entry
export const useUpdateTimeEntry = () => {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: ({ id, data }: { id: string; data: Partial<TimeEntry> }) => timeTrackingApi.updateTimeEntry(id, data),
      onSuccess: () => {
         queryClient.invalidateQueries({ queryKey: ["timeEntries"] });
         toast.success("Time Entry updated");
      },
      onError: (error: any) => {
         toast.error(error?.response?.data?.message || "Failed to update Time Entry");
      },
   });
};

// Timer interval hook - manages the running timer
export const useTimerInterval = () => {
   const status = useTimerStore((s) => s.status);
   const tick = useTimerStore((s) => s.tick);

   useEffect(() => {
      if (status === "running") {
         const id = window.setInterval(() => {
            tick();
         }, 1000);

         return () => {
            clearInterval(id);
         };
      }
   }, [status, tick]);
};

// Combined hook for timer with API integration
export const useTimer = () => {
   const timerStore = useTimerStore();
   const createMutation = useCreateTimeEntry();

   const stopTimerAndSave = () => {
      const timerData = timerStore.stopTimer();

      if (!timerData || !timerData.selectedProjectId || !timerData.startTime) {
         return;
      }

      const entryData = {
         projectId: timerData.selectedProjectId,
         description: timerData.description,
         startTime: new Date(timerData.startTime).toISOString(),
         endTime: new Date().toISOString(),
         durationMinutes: Math.floor(timerData.elapsedMs / 60000),
         isBillable: timerData.isBillable,
         invoiced: false,
      };

      createMutation.mutate(entryData);
   };

   return {
      state: {
         selectedProjectId: timerStore.selectedProjectId,
         description: timerStore.description,
         status: timerStore.status,
         elapsedMs: timerStore.elapsedMs,
         startTime: timerStore.startTime,
         isBillable: timerStore.isBillable,
      },
      startTimer: timerStore.startTimer,
      pauseTimer: timerStore.pauseTimer,
      resumeTimer: timerStore.resumeTimer,
      stopTimer: stopTimerAndSave,

      updateDescription: timerStore.updateDescription,
      toggleBillable: timerStore.toggleBillable,
      isSaving: createMutation.isPending,
   };
};
