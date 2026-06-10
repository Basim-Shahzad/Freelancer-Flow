import { create } from "zustand";
import type { TimerState } from "./type.js";

const STORAGE_KEY = "timer_state";

// Load from localStorage
const loadTimerState = (): TimerState => {
   try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
         return JSON.parse(stored);
      }
   } catch (error) {
      console.error("Failed to load timer state:", error);
   }

   return {
      active_project_id: null,
      description: "",
      status: "idle",
      elapsed_ms: 0,
      start_time: null,
      is_billable: true,
   };
};

// Save to localStorage
const saveTimerState = (state: TimerState) => {
   try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
   } catch (error) {
      console.error("Failed to save timer state:", error);
   }
};

interface TimerStore extends TimerState {
   // Actions
   startTimer: (projectId: number, description?: string) => void;
   pauseTimer: () => void;
   resumeTimer: () => void;
   stopTimer: () => TimerState | null;
   updateDescription: (description: string) => void;
   toggleBillable: () => void;
   tick: () => void;

   // Internal
   resetTimer: () => void;
}

export const useTimerStore = create<TimerStore>((set, get) => ({
   ...loadTimerState(),

   startTimer: (projectId: number, description = "") => {
      const state: TimerState = {
         active_project_id: projectId,
         description,
         status: "running",
         elapsed_ms: 0,
         start_time: Date.now(),
         is_billable: true,
      };

      set(state);
      saveTimerState(state);
   },

   pauseTimer: () => {
      set((state) => {
         const newState = { ...state, status: "paused" as const };
         saveTimerState(newState);
         return newState;
      });
   },

   resumeTimer: () => {
      set((state) => {
         const newState = { ...state, status: "running" as const };
         saveTimerState(newState);
         return newState;
      });
   },

   stopTimer: () => {
      const state = get();

      if (!state.active_project_id || !state.start_time) {
         return null;
      }

      const timerData: TimerState = {
         active_project_id: state.active_project_id,
         description: state.description,
         status: state.status,
         elapsed_ms: state.elapsed_ms,
         start_time: state.start_time,
         is_billable: state.is_billable,
      };

      get().resetTimer();

      return timerData;
   },

   updateDescription: (description: string) => {
      set((state) => {
         const newState = { ...state, description };
         saveTimerState(newState);
         return newState;
      });
   },

   toggleBillable: () => {
      set((state) => {
         const newState = { ...state, is_billable: !state.is_billable };
         saveTimerState(newState);
         return newState;
      });
   },

   tick: () => {
      set((state) => {
         const newState = {
            ...state,
            elapsed_ms: state.elapsed_ms + 1000,
         };
         saveTimerState(newState);
         return newState;
      });
   },

   resetTimer: () => {
      const resetState: TimerState = {
         active_project_id: null,
         description: "",
         status: "idle",
         elapsed_ms: 0,
         start_time: null,
         is_billable: true,
      };

      set(resetState);
      saveTimerState(resetState);
   },
}));
