import type { Invoice } from "./types.js";

export const prepareInvoicePayload = (invoice: Invoice): any => {
   // Get items from either items or InvoiceItems
   const invoiceItems = invoice.items?.length ? invoice.items : invoice.InvoiceItems || [];

   return {
      client_id: invoice.client?.id || invoice.client_id,
      project_id: invoice.project?.id || invoice.project_id,
      issue_date: invoice.issue_date,
      due_date: invoice.due_date,
      status: invoice.status,
      notes: invoice.notes || "",
      invoice_items: invoiceItems.map((item) => {
         const cleanItem: any = { ...item };
         delete cleanItem._timeEntryId;
         delete cleanItem.id;
         delete cleanItem.created_at;

         return {
            description: cleanItem.description,
            quantity: String(cleanItem.quantity),
            unit_price: String(cleanItem.unit_price),
         };
      }),
   };
};
