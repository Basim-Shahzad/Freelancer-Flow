import type { Client } from "../clients/types.js";
import type { Project } from "../projects/types.js";

export interface InvoiceItem {
   id: string;
   description?: string;
   quantity: string;
   unitPrice: string;
   amount: string;
   createdAt: string;
}

export interface InvoiceItemWithMeta extends InvoiceItem {
   _timeEntryId?: number;
}

type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled";

export interface Invoice {
   id: string;
   client: Client;
   project: Project;

   // properties
   isOverdue: boolean;
   isHourlyBasis: boolean;

   invoiceNumber: string;
   issueDate: string;
   dueDate: string;
   status: InvoiceStatus;
   subtotal: string;
   taxRate: string;
   taxAmount: string;
   total: string;
   notes: string;
   paymentDate?: string | null;

   items: InvoiceItem[];

   createdAt: string;
   updatedAt: string;
}

export interface InvoiceInList {
   id: string;
   clientName: string;
   projectName: string;
   invoiceNumber: string;
   issueDate: string;
   dueDate: string;
   isOverdue: boolean;
   status: InvoiceStatus;
   total: string;
   itemsCount: number;
   createdAt: string;
}

export type PaginatedInvoiceListResponse = {
   count: number;
   next: any;
   previous: any;
   results: {
      invoices: InvoiceInList[];
   };
};
