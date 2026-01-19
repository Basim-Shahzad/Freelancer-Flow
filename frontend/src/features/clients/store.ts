import { create } from "zustand";

interface ClientUIState {
   searchQuery: string;
   setSearchQuery: (query: string) => void;
   selectedClientId: number | null;
   setSelectedClientId: (id: number | null) => void;
}

export const useClientStore = create<ClientUIState>((set) => ({
   searchQuery: "",
   setSearchQuery: (query) => set({ searchQuery: query }),
   selectedClientId: null,
   setSelectedClientId: (id) => set({ selectedClientId: id }),
}));