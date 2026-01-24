import { create } from "zustand";

interface ProjectUIState {
   searchQuery: string;
   setSearchQuery: (query: string) => void;
   selectedProjectId: number | null;
   setSelectedProjectId: (id: number | null) => void;
}

export const useProjectStore = create<ProjectUIState>((set) => ({
   searchQuery: "",
   setSearchQuery: (query) => set({ searchQuery: query }),
   selectedProjectId: null,
   setSelectedProjectId: (id) => set({ selectedProjectId: id }),
}));