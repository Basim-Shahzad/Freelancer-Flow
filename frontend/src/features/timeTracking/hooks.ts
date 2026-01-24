import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { timeTrackingApi } from "./api.js";
import { useAuthStore } from "@/features/auth/store.js";
import toast from "react-hot-toast";
import type { TimeEntry } from "./type.js";
import { useTimerStore } from "./store.js";
import { useEffect } from "react";

// Fetch time entries
export const useTimeEntries = (page?: number, size?: number) => {
   const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
   const params = page && size ? { page, size } : { paginate: "false" };

   const query = useQuery({
      queryKey: ["timeEntries"],
      queryFn: () => timeTrackingApi.getTimeEntries(params),
      enabled: isAuthenticated,
      staleTime: 1000 * 60 * 5,
      placeholderData: { items: [], total: 0 },
   });

   return {
      ...query,
      data: query.data ?? { items: [], total: 0 },
   };
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
      mutationFn: ({ id, data }: { id: number; data: Partial<TimeEntry> }) => timeTrackingApi.updateTimeEntry(id, data),
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

      if (!timerData || !timerData.active_project_id || !timerData.start_time) {
         return;
      }

      const entryData = {
         project_id: timerData.active_project_id,
         description: timerData.description,
         start_time: new Date(timerData.start_time).toISOString(),
         end_time: new Date().toISOString(),
         duration_minutes: Math.floor(timerData.elapsed_ms / 60000),
         is_billable: timerData.is_billable,
         invoiced: false,
      };

      createMutation.mutate(entryData);
   };

   return {
      // State
      state: {
         active_project_id: timerStore.active_project_id,
         description: timerStore.description,
         status: timerStore.status,
         elapsed_ms: timerStore.elapsed_ms,
         start_time: timerStore.start_time,
         is_billable: timerStore.is_billable,
      },
      // Actions
      startTimer: timerStore.startTimer,
      pauseTimer: timerStore.pauseTimer,
      resumeTimer: timerStore.resumeTimer,
      stopTimer: stopTimerAndSave,
      updateDescription: timerStore.updateDescription,
      toggleBillable: timerStore.toggleBillable,
      // Status
      isSaving: createMutation.isPending,
   };
};
