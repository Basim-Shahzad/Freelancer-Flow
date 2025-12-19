import React, { createContext, useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import type { TimerState, TimeEntry } from "../types/models.js";
import { StorageService } from "../services/storage.service.js";
import { useTimeTracking } from "@/hooks/useTimeTracking.js";

/*  types  */

interface TimerContextValue {
   state: TimerState;
   entries: TimeEntry[];
   startTimer: (projectId: number, description?: string) => void;
   pauseTimer: () => void;
   resumeTimer: () => void;
   stopTimer: () => void;
   updateDescription: (description: string) => void;
}

const TimerContext = createContext<TimerContextValue | null>(null);

/* provider  */

export const TimerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
   const { createTimeEntry, timeEntries } = useTimeTracking();

   const [state, setState] = useState<TimerState>(
      () =>
         StorageService.getTimerState() ?? {
            active_project_id: null,
            description: "",
            status: "idle",
            elapsed_ms: 0,
            start_time: null,
         }
   );

   /*  refs  */

   const intervalRef = useRef<number | null>(null);
   const lastTickRef = useRef<number>(Date.now());

   /*  persistence  */

   useEffect(() => {
      StorageService.saveTimerState(state);
   }, [state]);

   /*  timer engine ( using interval )  */

   useEffect(() => {
      if (state.status !== "running") {
         if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
         }
         return;
      }

      lastTickRef.current = Date.now();

      intervalRef.current = window.setInterval(() => {
         const now = Date.now();
         const delta = now - lastTickRef.current;
         lastTickRef.current = now;

         setState((prev) => ({
            ...prev,
            elapsed_ms: prev.elapsed_ms + delta,
         }));
      }, 1000);

      return () => {
         if (intervalRef.current) clearInterval(intervalRef.current);
      };
   }, [state.status]);

   /*  actions  */

   const startTimer = useCallback((projectId: number, description = "") => {
      lastTickRef.current = Date.now();
      setState({
         active_project_id: projectId,
         description,
         status: "running",
         elapsed_ms: 0,
         start_time: Date.now(),
      });
   }, []);

   const pauseTimer = useCallback(() => {
      setState((prev) => ({ ...prev, status: "paused" }));
   }, []);

   const resumeTimer = useCallback(() => {
      lastTickRef.current = Date.now();
      setState((prev) => ({ ...prev, status: "running" }));
   }, []);

   const updateDescription = useCallback((description: string) => {
      setState((prev) => ({ ...prev, description }));
   }, []);

   const stopTimer = useCallback(() => {
      if (!state.active_project_id || !state.start_time) return;

      const entryData = {
         project_id: state.active_project_id,
         description: state.description,
         start_time: state.start_time,
         end_time: Date.now(),
         duration_ms: state.elapsed_ms,
      };

      // Actually send to backend
      createTimeEntry(entryData, {
         onError: (error) => {
            console.error("Failed to save time entry:", error);
            // Show toast notification to user
         },
      });

      // Reset timer
      setState({
         active_project_id: null,
         description: "",
         status: "idle",
         elapsed_ms: 0,
         start_time: null,
      });
   }, [state, createTimeEntry]);

   /*  provider  */

   return (
      <TimerContext.Provider
         value={{
            state,
            entries: timeEntries,
            startTimer,
            pauseTimer,
            resumeTimer,
            stopTimer,
            updateDescription,
         }}>
         {children}
      </TimerContext.Provider>
   );
};

/*  hook  */

export const useTimer = () => {
   const ctx = React.useContext(TimerContext);
   if (!ctx) throw new Error("useTimer must be used within TimerProvider");
   return ctx;
};
