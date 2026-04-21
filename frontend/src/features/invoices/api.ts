import type { Invoice, PaginatedInvoiceListResponse, InvoiceStatus, nonPaginatedInvoiceListResponse } from "./types.js";
import { api } from "@/services/api.js";

export const invoicesApi = {
   getInvoices: (async (
      paginate: boolean,
      status?: InvoiceStatus,
      clientId?: string,
      projectId?: string,
   ): Promise<PaginatedInvoiceListResponse | nonPaginatedInvoiceListResponse> => {
      const { data } = await api.get("/invoices/", {
         params: { paginate, status, clientId, projectId },
      });
      return data;
   }) as {
      // Overload 1: true -> Paginated
      (
         paginate: true,
         status?: InvoiceStatus,
         clientId?: string,
         projectId?: string,
      ): Promise<PaginatedInvoiceListResponse>;
      // Overload 2: false -> Non-Paginated
      (
         paginate: false,
         status?: InvoiceStatus,
         clientId?: string,
         projectId?: string,
      ): Promise<nonPaginatedInvoiceListResponse>;
   },
   getInvoice: async (id: string): Promise<Invoice> => {
      const { data } = await api.get<Invoice>(`/invoices/${id}/`);
      return data;
   },
   createInvoice: async (invoiceData: Partial<Invoice>): Promise<Invoice> => {
      const { data } = await api.post<Invoice>("/invoices", invoiceData);
      return data;
   },
   updateInvoice: async (id: string, invoiceData: Partial<Invoice>): Promise<Invoice> => {
      const { data } = await api.patch<Invoice>(`/invoices/${id}/`, invoiceData);
      return data;
   },
   deleteInvoice: async (id: string): Promise<void> => {
      await api.delete(`/invoices/${id}/`);
   },
};
