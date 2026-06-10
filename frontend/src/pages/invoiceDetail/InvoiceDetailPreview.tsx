import { useFormatters } from "@/hooks/useFormatters.js";
import type { Invoice } from "@/types/models.js";

interface InvoiceDetailPreviewProps {
   invoice: Invoice;
}

export default function InvoiceDetailPreview({ invoice }: InvoiceDetailPreviewProps) {
   const { formatDuration } = useFormatters();

   const statusColorClasses: Record<string, { bg: string; dot: string }> = {
      draft: { bg: "bg-gray-200", dot: "bg-gray-700" },
      sent: { bg: "bg-blue-200", dot: "bg-blue-700" },
      paid: { bg: "bg-green-200", dot: "bg-green-700" },
      overdue: { bg: "bg-red-200", dot: "bg-red-700" },
      cancelled: { bg: "bg-gray-400", dot: "bg-gray-800" },
   };
   const classes = statusColorClasses[invoice?.status ?? "draft"];

   // Use items from backend response
   const invoiceItems = invoice.items || [];

   return (
      <div className="px-4 dark:bg-black shadow-md rounded-lg">
         {/* Header */}
         <div className="flex flex-col sm:flex-row sm:justify-between mb-6">
            <div>
               <h1 className="text-3xl font-bold mb-1">{invoice.invoice_number}</h1>
               <p className="text-gray-600 dark:text-gray-200">
                  Project: {invoice.project?.name || invoice.project_name || "N/A"}
               </p>
            </div>
            <div className="text-right mt-4 sm:mt-0">
               <p className="text-gray-600 dark:text-gray-200">Issue Date: {invoice.issue_date}</p>
               <p className="text-gray-600 dark:text-gray-200">Due Date: {invoice.due_date}</p>
               <p
                  className={`${classes.bg} font-semibold text-sm text-black h-max w-max px-3 py-0.5 rounded-lg mt-1 flex gap-1 items-center capitalize`}>
                  <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${classes.dot}`}></span>
                  {invoice?.status}
               </p>
            </div>
         </div>

         {/* Client Info */}
         <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">Bill To:</h2>
            <p className="text-gray-700 dark:text-gray-200">{invoice.client?.name || invoice.client_name || "N/A"}</p>
         </div>

         {/* Items Table */}
         <div className="overflow-x-auto mb-6">
            <table className="w-full text-left border-collapse">
               <thead>
                  <tr className="dark:bg-gray-900 bg-gray-200 text-black dark:text-white">
                     <th className="px-4 py-2 border-b">Description</th>
                     <th className="px-4 py-2 border-b">Qty/time</th>
                     <th className="px-4 py-2 border-b">Unit Price</th>
                     <th className="px-4 py-2 border-b">Amount ($)</th>
                  </tr>
               </thead>
               <tbody>
                  {invoiceItems.map((item) => (
                     <tr key={item.id} className="">
                        <td className="px-4 py-2 border-b">{item.description}</td>
                        <td className="px-4 py-2 border-b">{formatDuration(Number(item.quantity))}</td>
                        <td className="px-4 py-2 border-b">${Number(item.unit_price).toFixed(2)}</td>
                        <td className="px-4 py-2 border-b">${Number(item.amount).toFixed(2)}</td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>

         {/* Totals */}
         <div className="flex justify-end mb-6">
            <div className="w-full sm:w-1/3">
               <div className="flex justify-between py-1">
                  <span>Subtotal:</span>
                  <span>${Number(invoice.subtotal).toFixed(2)}</span>
               </div>
               {Number(invoice.tax_amount) > 0 && (
                  <div className="flex justify-between py-1">
                     <span>Tax ({Number(invoice.tax_rate).toFixed(2)}%):</span>
                     <span>${Number(invoice.tax_amount).toFixed(2)}</span>
                  </div>
               )}
               <div className="flex justify-between py-1 font-bold text-lg border-t border-gray-300 mt-2 pt-2">
                  <span>Total:</span>
                  <span>${Number(invoice.total).toFixed(2)}</span>
               </div>
            </div>
         </div>

         {/* Notes */}
         {invoice.notes && (
            <div className="mb-6">
               <h2 className="font-semibold mb-2">Notes:</h2>
               <p className="text-gray-700 dark:text-gray-200">{invoice.notes}</p>
            </div>
         )}
      </div>
   );
}
