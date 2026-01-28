import type { Invoice, GetInvoicesParams } from "./types.js";
import { api } from "@/hooks/useApi.js";

export const invoicesApi = {
   getInvoices: async (params?: GetInvoicesParams): Promise<{ items: Invoice[]; total: number }> => {
      const { data } = await api.get("/invoices/", { params });

      return {
         items: data.invoices || [],
         total: data.total || data.count || data.invoices?.length || 0,
      };
   },

   getInvoice: async (id: number | string): Promise<Invoice> => {
      const { data } = await api.get<Invoice>(`/invoices/${id}/`);
      return data;
   },

   createInvoice: async (invoiceData : Invoice): Promise<Invoice> => {
      const { data } = await api.post<Invoice>("/invoices", invoiceData);
      return data;
   },

   updateInvoice: async (id: number | string, invoiceData: Partial<Invoice>): Promise<Invoice> => {
      const { data } = await api.patch<Invoice>(`/invoices/${id}/`, invoiceData);
      return data;
   },

   deleteInvoice: async (id: number | string): Promise<void> => {
      await api.delete(`/invoices/${id}/`);
   },
};
