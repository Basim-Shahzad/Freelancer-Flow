import { useEffect } from "react";
import styles from "@/Styles/invoiceCreate.module.css";
import { useInvoices } from "@/hooks/useInvoices.js";
import { Button, Textarea } from "@heroui/react";
import { useAuth } from "@/Contexts/AuthContext.jsx";
import { FaMinus, FaPlus } from "react-icons/fa6";
import { TiTick } from "react-icons/ti";
import { useFormatters } from "@/hooks/useFormatters.js";
import type { InvoiceItemWithMeta } from "@/types/models.js";
import { toast, Toaster } from 'react-hot-toast';

const InvoicePreview = () => {
   const { formatDuration } = useFormatters();
   const { user } = useAuth();
   const {
      createInvoice,
      createInvoiceLoading,
      selectedProject,
      invoice,
      setInvoice,
      removeItemFromInvoice,
      setInvoiceNotes,
      invoiceNotes,
      invoiceDueDate,
      roundInvoice,
   } = useInvoices();

   if (!user) return null;
   if (!invoice) return null;

   const statusColorClasses: Record<string, { bg: string; dot: string }> = {
      draft: { bg: "bg-gray-200", dot: "bg-gray-700" },
      sent: { bg: "bg-blue-200", dot: "bg-blue-700" },
      paid: { bg: "bg-green-200", dot: "bg-green-700" },
      overdue: { bg: "bg-red-200", dot: "bg-red-700" },
      cancelled: { bg: "bg-gray-400", dot: "bg-gray-800" },
   };
   const classes = statusColorClasses[invoice?.status ?? "draft"];

   useEffect(() => {
      if (selectedProject) {
         setInvoice((prev) =>
            prev
               ? {
                    ...prev,
                    project: selectedProject,
                    client: selectedProject.client,
                    project_id: selectedProject.id,
                    client_id: selectedProject.client.id,
                 }
               : prev
         );
      }
   }, [selectedProject, setInvoice]);

   useEffect(() => {
      setInvoice((prev) => (prev ? { ...prev, notes: invoiceNotes } : prev));
   }, [invoiceNotes, setInvoice]);

   return (
      <div className={`${styles.container} text-white border border-white/15 rounded-2xl px-3 py-4 `}>
         <div className="flex justify-center item-center h-max">
            <Button
               color="secondary"
               startContent={createInvoiceLoading ? "" : <TiTick className="w-4 h-4" />}
               isLoading={createInvoiceLoading ? true : false}
               onPress={() => createInvoice(invoice)}>
               Confirm Invoice
            </Button>
         </div>
         <div className={styles.header}>
            <div>
               <h1 className={styles.title}>INVOICE</h1>
               <p className={styles.invoiceNumber}>{invoice?.invoice_number}</p>
            </div>

            <div className={`flex flex-col items-end gap-0.5`}>
               <p>
                  <strong>Issue Date:</strong> {invoice?.issue_date}
               </p>
               <p>
                  <strong>Due Date:</strong> {invoiceDueDate ? invoiceDueDate : ""}
               </p>
               <p
                  className={`${classes.bg} text-sm text-black h-max w-max px-2 py-0.5 rounded-lg mt-1 flex gap-1 items-center capitalize`}>
                  <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${classes.dot}`}></span>
                  {invoice?.status}
               </p>
            </div>
         </div>

         <div className={styles.billing}>
            <p className="text-sm">
               <strong>Freelancer:</strong> {user?.username} &nbsp;|&nbsp;
               <strong>Client:</strong> {selectedProject?.client.name} &nbsp;|&nbsp;
               <strong>Project:</strong> {selectedProject?.name} (
               {selectedProject?.hourly_rate ? `$${selectedProject?.hourly_rate}/hr` : `$${user.hourly_rate}/h`})
            </p>
         </div>

         <table className={styles.items}>
            <thead>
               <tr className="text-black">
                  <th>Description</th>
                  <th className={``}>Qty/time</th>
                  <th className={``}>Unit Price</th>
                  <th className={``}>Amount ($)</th>
                  <th></th>
               </tr>
            </thead>

            <tbody>
               {invoice?.InvoiceItems.length > 0 ? (
                  invoice?.InvoiceItems.map((item, index) => (
                     <tr key={(item as any)._timeEntryId || index} className="text-sm">
                        <td>{item.description}</td>
                        <td className={``}>{formatDuration(item.quantity) ?? "-"}</td>
                        <td className={``}>${item.unit_price ?? "-"}</td>
                        <td className={`font-bold`}>${roundInvoice(item.amount)}</td>
                        <td>
                           <FaMinus
                              onClick={() => {
                                 const itemWithMeta = item as InvoiceItemWithMeta;
                                 if (itemWithMeta._timeEntryId) {
                                    removeItemFromInvoice(itemWithMeta._timeEntryId);
                                 }
                              }}
                              className="text-2xl bg-red-900 px-0.5 py-0.5 rounded-xs text-red-400 cursor-pointer"
                           />
                        </td>
                     </tr>
                  ))
               ) : (
                  <tr>
                     <td colSpan={5} className={`text-center text-lg`}>
                        No invoice items
                     </td>
                  </tr>
               )}
            </tbody>
         </table>

         <div className="flex justify-center mb-3">
            <Button color="default" variant="bordered" startContent={<FaPlus />}>
               Add custom Item
            </Button>
         </div>

         <div className={styles.totals}>
            <table>
               <tbody className="text-sm">
                  <tr>
                     <td>Subtotal</td>
                     <td className={styles.right}>${roundInvoice(invoice?.subtotal || 0)}</td>
                  </tr>
                  <tr className={styles.total}>
                     <td>Total</td>
                     <td className={`${styles.right}`}>${roundInvoice(invoice?.total || 0)}</td>
                  </tr>
               </tbody>
            </table>
         </div>

         <div className="my-2">
            <Textarea
               variant="underlined"
               size="sm"
               label="Notes"
               placeholder="Enter your notes"
               value={invoiceNotes}
               onChange={(e) => setInvoiceNotes(e.target.value)}
            />
         </div>

         <div className={styles.footer}>
            {/* <p>Thank you for your business.</p> */}
            <p>This is a preview. Click 'Confirm Invoice' to finalize.</p>
         </div>
      </div>
   );
};

export default InvoicePreview;
