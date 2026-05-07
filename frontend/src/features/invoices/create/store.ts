import { create } from "zustand";

interface InvoiceUIState {
   selectedClientId: string | null;
   setSelectedClientId: (selectedClientId: string) => void;
}

export const useCreateInvoiceStore = create<InvoiceUIState>((set) => ({
   selectedClientId: null,
   setSelectedClientId: (selectedClientId) => set({ selectedClientId: selectedClientId }),
}));
