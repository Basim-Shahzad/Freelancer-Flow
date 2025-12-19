import type { TimerState } from "../types/models.js";

const STORAGE_KEYS = {
   TIMER_STATE: "timer_state",
} as const;

export const StorageService = {
   getTimerState: (): TimerState | null => {
      const data = localStorage.getItem(STORAGE_KEYS.TIMER_STATE);
      return data ? JSON.parse(data) : null;
   },

   saveTimerState: (state: TimerState): void => {
      localStorage.setItem(STORAGE_KEYS.TIMER_STATE, JSON.stringify(state));
   }
};
