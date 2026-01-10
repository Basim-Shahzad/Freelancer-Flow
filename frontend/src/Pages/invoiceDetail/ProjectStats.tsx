import { Clock, DollarSign, Calendar, TrendingUp } from "lucide-react";
import type { Invoice } from "@/types/models.js";

interface InvoiceDetailStatsProps {
   invoice: Invoice;
}

const ProjectStats = ({ invoice }: InvoiceDetailStatsProps) => {

   // Use items from backend response
   const invoiceItems = invoice.items || [];

   // Calculate total hours from items (quantity is in minutes)
   const totalMinutes = invoice.project?.total_time ?? 0;
   const totalHours = (totalMinutes / 60).toFixed(1);

   return (
      <div className="flex flex-col justify-center gap-4">
         {/* Time Tracked Card */}
         <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-3 mb-3">
               <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900">
                  <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
               </div>
               <h3 className="font-semibold text-gray-800 dark:text-gray-100">Total Time Tracked</h3>
            </div>
            <div className="space-y-2">
               <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Total Hours</span>
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{totalHours}h</span>
               </div>
               <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Total Minutes</span>
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{totalMinutes}m</span>
               </div>
               <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Line Items</span>
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{invoiceItems.length}</span>
               </div>
            </div>
         </div>

         {/* Project/Client Info Card */}
         <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-3 mb-3">
               <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900">
                  <Calendar className="w-5 h-5 text-orange-600 dark:text-orange-400" />
               </div>
               <h3 className="font-semibold text-gray-800 dark:text-gray-100">
                  {invoice.project ? "Project Info" : "Invoice Dates"}
               </h3>
            </div>
            <div className="space-y-2">
               {invoice.project ? (
                  <>
                     <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Project</span>
                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                           {typeof invoice.project === "object" ? invoice.project.name : invoice.project_name || "N/A"}
                        </span>
                     </div>
                     {typeof invoice.project === "object" && invoice.project.total_billed && (
                        <div className="flex justify-between items-center">
                           <span className="text-sm text-gray-600 dark:text-gray-400">Total Billed</span>
                           <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                              ${Number(invoice.project.total_billed).toFixed(2)}
                           </span>
                        </div>
                     )}
                  </>
               ) : (
                  <>
                     <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Issue Date</span>
                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                           {new Date(invoice.issue_date || "").toLocaleDateString()}
                        </span>
                     </div>
                     <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Due Date</span>
                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                           {new Date(invoice.due_date).toLocaleDateString()}
                        </span>
                     </div>
                  </>
               )}
               {invoice.client && typeof invoice.client === "object" && (
                  <div className="flex justify-between items-center">
                     <span className="text-sm text-gray-600 dark:text-gray-400">Client</span>
                     <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                        {invoice.client.name}
                     </span>
                  </div>
               )}
               {invoice.client_name && !invoice.client && (
                  <div className="flex justify-between items-center">
                     <span className="text-sm text-gray-600 dark:text-gray-400">Client</span>
                     <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                        {invoice.client_name}
                     </span>
                  </div>
               )}
            </div>
         </div>
      </div>
   );
};

export default ProjectStats;
