import { create } from "zustand";
import { VIEW_CONFIGS } from "@/types/display.types";

export interface DisplayStoreState<T extends string> {
   display: T;
   options: readonly T[];
   setDisplay: (display: T) => void;
}

export function createDisplayStore<T extends string>(allowedOptions: readonly T[]) {
   return create<DisplayStoreState<T>>()((set) => ({
      display: allowedOptions[0],
      options: allowedOptions,
      setDisplay: (display) => set({ display }),
   }));
}

export const useClientsStore = createDisplayStore(VIEW_CONFIGS.clients);
export const useProjectsStore = createDisplayStore(VIEW_CONFIGS.projects);
