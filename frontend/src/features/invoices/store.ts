import { create } from "zustand";
import type { Invoice } from "./types.js";

const EmptyInvoice : Invoice = {
   client: null,
   project: null,
   client_id: undefined,
   project_id: undefined,
   invoice_number: "",
   issue_date: new Date().toISOString().split("T")[0],
   due_date: "",
   status: "draft",
   subtotal: 0,
   total: 0,
   tax_amount: 0,
   tax_rate: 0,
   notes: "",
   items: [], // Backend uses items
   InvoiceItems: [],
};

interface InvoiceUIState {
   invoice: Invoice;
   setInvoice: (invoice: Invoice) => void;
}

export const useInvoiceStore = create<InvoiceUIState>((set) => ({
   invoice: EmptyInvoice,
   setInvoice: (invoice) => set({ invoice: invoice }),
}));
