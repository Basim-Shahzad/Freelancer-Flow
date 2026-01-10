import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi.js";
import MobileHeader from "@/layout/MobileHeader.jsx";
import InvoiceDetailHeader from "./InvoiceDetailHeader.js";
import InvoiceDetailPreview from "./InvoiceDetailPreview.js";
import { Button } from "@heroui/react";
import { MdPaid } from "react-icons/md";
import { FaFilePdf } from "react-icons/fa6";
import { TfiEmail } from "react-icons/tfi";
import InvoiceStats from "./InvoiceStats.js";
import type { Invoice, InvoiceItem } from "@/types/models.js";
import { LoadingPage } from "../miscPages/LoadingPage.js";
import ProjectStats from "./ProjectStats.js";
import { useInvoices } from "@/hooks/useInvoices.js";
import InvoiceEmailSendModal from "./InvoiceDetailComponents/InvoiceEmailSendModal.js";

type RouteParams = {
   id: string;
};

export default function InvoiceDetail() {
   const { id } = useParams<RouteParams>();
   const { api } = useApi();
   const { handleMarkAsPaid, handleSendEmail } = useInvoices();
   const [isEmailModalOpen, setIsEmailModalOpen] = useState<boolean>(false);

   const {
      data: invoice,
      isLoading,
      isError,
      error,
   } = useQuery<Invoice>({
      queryKey: ["invoice", id],
      queryFn: async () => {
         if (!id) throw new Error("Invoice id is required");
         const res = await api.get<Invoice>(`/invoices/${id}`);
         console.log(res.data);
         return res.data;
      },
      enabled: !!id,
   });

   if (isLoading) return <LoadingPage />;
   if (isError) return <div>Error: {(error as Error).message}</div>;
   if (!invoice) return <div>Invoice not found</div>;

   return (
      <div className="flex flex-col lg:flex-row bg-white text-black dark:bg-[#000000] dark:text-white transition-colors duration-300">
         <header>
            <MobileHeader />
         </header>

         <div className="invisible pl-[296px] hidden lg:sticky lg:top-0 lg:bottom-0 lg:left-0 lg:block"></div>

         <main className="pt-8 pb-12 w-full min-h-screen">
            <div className="grid px-4 gap-4 grid-cols-1 lg:grid-cols-[minmax(200px,300px)_1fr_minmax(200px,300px)] h-full">
               <ProjectStats invoice={invoice} />

               <div className="flex flex-col justify-center border rounded-2xl border-white/10 p-4">
                  <InvoiceDetailPreview invoice={invoice} />
                  <div className="flex flex-wrap justify-center gap-3 mt-4">
                     {/* <Button color="primary" startContent={<TfiEmail />} onPress={() => handleSendEmail(Number(invoice.id))}> 
                        Email to Client
                     </Button> */}
                     <Button color="primary" startContent={<TfiEmail />} onPress={() => setIsEmailModalOpen(true)}>
                        Email to Client
                     </Button>
                     <Button color="secondary" startContent={<FaFilePdf />}>
                        Download as pdf
                     </Button>
                     {/* right now just changes status to "sent," but does not actually send an email.  */}
                     <Button
                        color="success"
                        className="text-white"
                        startContent={<MdPaid />}
                        onPress={() => handleMarkAsPaid(Number(invoice.id))}>
                        Mark as Paid
                     </Button>
                  </div>
               </div>

               <InvoiceStats invoice={invoice} />

               {/* Modal only opens when the send email button is pressed */}
               <InvoiceEmailSendModal isOpen={isEmailModalOpen} onClose={() => setIsEmailModalOpen(false)} invoice={invoice} />

            </div>
         </main>
      </div>
   );
}
