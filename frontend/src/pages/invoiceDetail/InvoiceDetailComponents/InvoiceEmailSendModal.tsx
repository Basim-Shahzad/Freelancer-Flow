import React, { useState, useEffect } from "react";
import {
   Modal,
   ModalContent,
   ModalHeader,
   ModalBody,
   ModalFooter,
   Button,
   Textarea,
   Input,
   Spinner,
} from "@heroui/react";
import { useInvoices } from "@/hooks/useInvoices.js";
import type { Invoice } from "@/types/models.js";
import { useAuthStore } from "@/features/auth/store.js";

type Props = {
   isOpen: boolean;
   onClose: () => void;
   invoice: Invoice;
};

export default function InvoiceEmailSendModal({ isOpen, onClose, invoice }: Props) {
   const { handleSendEmail } = useInvoices();
   const { user } = useAuth();
   const [clientEmail, setClientEmail] = useState(invoice.client?.email);

   // Better default subject
   const defaultSubject = `Invoice #${invoice.invoice_number || invoice.id} for ${
      invoice.project_name || "your project"
   } – ${invoice.client_name}`;

   // Better default body
   const defaultBody = `Hello ${
      invoice.client_name || "Client"
   },\n\nI hope this message finds you well.\n\nPlease find attached the invoice #${
      invoice.invoice_number || invoice.id
   } for "${invoice.project_name || "your project"}". The total amount due is $${
      invoice.total
   }.\n\nKindly review the invoice and let us know if you have any questions. We appreciate your prompt payment.\n\nBest regards,\n${
      user?.username || "Your Company"
   }`;

   const [subject, setSubject] = useState(defaultSubject);
   const [body, setBody] = useState(defaultBody);

   // Simulate PDF attachment
   const [pdfAttached, setPdfAttached] = useState(false);
   const [sending, setSending] = useState(false);

   useEffect(() => {
      if (isOpen) {
         setPdfAttached(false);
         // simulate PDF attaching delay
         const timer = setTimeout(() => setPdfAttached(true), 1500);
         return () => clearTimeout(timer);
      }
   }, [isOpen]);

   const handleSend = async () => {
      if (!pdfAttached) return; // safety
      setSending(true);
      try {
         await handleSendEmail(Number(invoice.id));
         setTimeout(() => {
            setSending(false);
            onClose();
         }, 1200);
      } catch (err) {
         console.error(err);
         setSending(false);
      }
   };

   return (
      <Modal isOpen={isOpen} size="3xl" onClose={onClose}>
         <ModalContent>
            {(onClose) => (
               <>
                  <ModalHeader>Send Invoice Email</ModalHeader>

                  <ModalBody>
                     <div className="flex flex-col w-full gap-4">
                        {/* Subject */}

                        {invoice.client?.email ? (
                           <div className="flex justify-around">
                              <span>
                                 <b>from:</b> {user?.email}
                              </span>
                              <span>
                                 <b>to:</b> {invoice.client?.email}
                              </span>
                           </div>
                        ) : (
                           <Input
                              label="Email"
                              placeholder="Enter Client's Email"
                              type="email"
                              value={clientEmail}
                              onChange={(e) => setClientEmail(e.target.value)}
                              className="w-full"
                           />
                        )}

                        <Input
                           label="Email Subject"
                           placeholder="Enter email subject"
                           value={subject}
                           onChange={(e) => setSubject(e.target.value)}
                           className="w-full"
                        />

                        {/* Body */}
                        <Textarea
                           label="Email Content"
                           variant="faded"
                           className="w-full"
                           value={body}
                           onChange={(e) => setBody(e.target.value)}
                           rows={8}
                        />

                        {/* PDF attaching simulation */}
                        <div className="flex items-center gap-3 p-3 border rounded-md bg-gray-50 dark:bg-gray-900">
                           <Spinner size="sm" color={pdfAttached ? "primary" : "secondary"} />
                           <span className="text-sm">
                              {pdfAttached
                                 ? `Invoice #${invoice.invoice_number || invoice.id}.pdf attached`
                                 : `Attaching invoice #${invoice.invoice_number || invoice.id}.pdf...`}
                           </span>
                        </div>
                     </div>
                  </ModalBody>

                  <ModalFooter className="gap-2">
                     <Button variant="light" onPress={onClose} disabled={sending}>
                        Cancel
                     </Button>
                     <Button color="primary" onPress={handleSend} disabled={sending || !pdfAttached}>
                        {sending ? "Sending..." : !pdfAttached ? "Preparing PDF..." : "Send Email"}
                     </Button>
                  </ModalFooter>
               </>
            )}
         </ModalContent>
      </Modal>
   );
}
