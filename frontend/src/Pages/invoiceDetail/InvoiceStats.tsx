import { Clock, DollarSign, Calendar, TrendingUp } from "lucide-react";
import type { Invoice } from "@/types/models.js";

interface InvoiceDetailStatsProps {
   invoice: Invoice;
}

export default function InvoiceDetailStats({ invoice }: InvoiceDetailStatsProps) {
   // Calculate days until/past due
   const getDaysUntilDue = () => {
      const today = new Date();
      const dueDate = new Date(invoice.due_date);
      const diffTime = dueDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
   };

   const daysUntilDue = getDaysUntilDue();
   const isOverdue = invoice.is_overdue || daysUntilDue < 0;
   const isPaid = invoice.status === "paid";

   // Use items from backend response
   const invoiceItems = invoice.items || [];

   // Calculate total hours from items (quantity is in minutes)
   const totalMinutes = invoiceItems.reduce((sum, item) => sum + Number(item.quantity), 0);
   const totalHours = (totalMinutes / 60).toFixed(1);

   // Calculate average hourly rate
   const avgHourlyRate =
      invoiceItems.length > 0 && totalMinutes > 0
         ? (Number(invoice.subtotal) / (totalMinutes / 60)).toFixed(2)
         : "0.00";

   return (
      <div className="flex flex-col justify-center gap-4">
         {/* Payment Status Card */}
         <div className="bg-white dark:bg-gray-950 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-3 mb-3">
               <div
                  className={`p-2 rounded-lg ${
                     isPaid
                        ? "bg-green-100 dark:bg-green-900"
                        : isOverdue
                        ? "bg-red-100 dark:bg-red-900"
                        : "bg-blue-100 dark:bg-blue-900"
                  }`}>
                  <DollarSign
                     className={`w-5 h-5 ${
                        isPaid
                           ? "text-green-600 dark:text-green-400"
                           : isOverdue
                           ? "text-red-600 dark:text-red-400"
                           : "text-blue-600 dark:text-blue-400"
                     }`}
                  />
               </div>
               <h3 className="font-semibold text-gray-800 dark:text-gray-100">Payment Status</h3>
            </div>
            <div className="space-y-2">
               <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Status</span>
                  <span
                     className={`px-3 py-1 rounded-full text-xs font-medium ${
                        isPaid
                           ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                           : invoice.status === "sent"
                           ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                           : isOverdue
                           ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                           : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                     }`}>
                     {isPaid
                        ? "Paid"
                        : isOverdue
                        ? "Overdue"
                        : invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                  </span>
               </div>
               {!isPaid && (
                  <div className="flex justify-between items-center">
                     <span className="text-sm text-gray-600 dark:text-gray-400">Due in</span>
                     <span
                        className={`text-sm font-semibold ${
                           isOverdue
                              ? "text-red-600 dark:text-red-400"
                              : daysUntilDue <= 7
                              ? "text-orange-600 dark:text-orange-400"
                              : "text-gray-800 dark:text-gray-200"
                        }`}>
                        {isOverdue ? `${Math.abs(daysUntilDue)} days overdue` : `${daysUntilDue} days`}
                     </span>
                  </div>
               )}
               {isPaid && invoice.payment_date && (
                  <div className="flex justify-between items-center">
                     <span className="text-sm text-gray-600 dark:text-gray-400">Paid on</span>
                     <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                        {new Date(invoice.payment_date).toLocaleDateString()}
                     </span>
                  </div>
               )}
            </div>
         </div>

         {/* Financial Breakdown Card */}
         <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-3 mb-3">
               <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900">
                  <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
               </div>
               <h3 className="font-semibold text-gray-800 dark:text-gray-100">Financial Details</h3>
            </div>
            <div className="space-y-2">
               <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Subtotal</span>
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                     ${Number(invoice.subtotal).toFixed(2)}
                  </span>
               </div>
               {/* <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Tax</span>
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                     ${Number(invoice.tax_amount).toFixed(2)}
                  </span>
               </div> */}
               <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Avg. Hourly Rate</span>
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">${avgHourlyRate}/hr</span>
               </div>
            </div>
         </div>
      </div>
   );
}
