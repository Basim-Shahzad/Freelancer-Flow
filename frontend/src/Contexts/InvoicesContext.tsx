import React, { createContext, type ReactNode, useState, useEffect } from "react";
import type { Invoice, Project, Client, TimeEntry, InvoiceItem, InvoiceItemWithMeta } from "../types/models.js";
import { useMutation, useQuery, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";
import { useApi } from "@/hooks/useApi.js";
import { useAuthStore } from "@/features/auth/store.js";
import { useTimeTracking } from "@/hooks/useTimeTracking.js";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";

export type CreateInvoiceInput = Invoice;
type RoundingMethod = "round" | "up" | "down" | "halfEven";

interface InvoicesContextValue {
   createInvoice: (invoiceData: CreateInvoiceInput) => void;
   createInvoiceLoading: boolean;
   invoice: Invoice | null;
   setInvoice: React.Dispatch<React.SetStateAction<Invoice | null>>;
   selectedProject: Project | null;
   setSelectedProject: React.Dispatch<React.SetStateAction<Project | null>>;
   invoiceDueDate: string | null;
   setInvoiceDueDate: React.Dispatch<React.SetStateAction<string | null>>;
   invoiceNotes: string;
   setInvoiceNotes: React.Dispatch<React.SetStateAction<string>>;
   billableEntries: TimeEntry[];
   setBillableEntries: React.Dispatch<React.SetStateAction<TimeEntry[]>>;
   addItemToInvoice: (entry: TimeEntry) => void;
   removeItemFromInvoice: (itemId: number) => void;
   roundInvoice: (value: number, decimals?: number, method?: RoundingMethod) => number;
   isProjectChangeAllowed: boolean;
   handleMarkAsPaid: (invoiceId: number) => void;
   handleSendEmail: (invoiceId: number) => void;
   statusFilter: string | undefined;
   setStatusFilter: React.Dispatch<React.SetStateAction<string | undefined>>;
   clientFilter: number | undefined;
   setClientFilter: React.Dispatch<React.SetStateAction<number | undefined>>;
   projectFilter: number | undefined;
   setProjectFilter: React.Dispatch<React.SetStateAction<number | undefined>>;
   invoices: Invoice[];
   invoicesLoading: boolean;
   invoicesError: Error | null;
}

export const InvoicesContext = createContext<InvoicesContextValue | null>(null);

export const InvoicesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
   const { api } = useApi() as { api: AxiosInstance };
   const queryClient = useQueryClient();
   const user = useAuthStore((state) => state.user);
   const isInitialized = useAuthStore((state) => state.isInitialized)
   const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
   const { timeEntries } = useTimeTracking();
   const navigate = useNavigate();

   function isoToDate(iso: string): string {
      return new Date(iso).toISOString().split("T")[0];
   }

   const [invoice, setInvoice] = useState<Invoice | null>({
      client: null,
      project: null,
      client_id: undefined,
      project_id: undefined,
      invoice_number: "",
      issue_date: new Date().toISOString().split("T")[0],
      due_date: "",
      status: "draft",
      subtotal: 0,
      total: 0,
      tax_amount: 0,
      tax_rate: 0,
      notes: "",
      items: [], // Backend uses items
      InvoiceItems: [],
   } as Invoice);

   const [selectedProject, setSelectedProject] = useState<Project | null>(null);
   const [invoiceDueDate, setInvoiceDueDate] = useState<string | null>(null);
   const [invoiceNotes, setInvoiceNotes] = useState<string>("");
   const [billableEntries, setBillableEntries] = useState<TimeEntry[]>([]);
   const [isProjectChangeAllowed, setIsProjectChangeAllowed] = useState<boolean>(true);

   // Fetch Invoices Filters
   const [statusFilter, setStatusFilter] = useState<string | undefined>();
   const [clientFilter, setClientFilter] = useState<number | undefined>();
   const [projectFilter, setProjectFilter] = useState<number | undefined>();

   const prepareInvoicePayload = (invoice: Invoice): any => {
      // Get items from either items or InvoiceItems
      const invoiceItems = invoice.items?.length ? invoice.items : invoice.InvoiceItems || [];

      return {
         client_id: invoice.client?.id || invoice.client_id, // maybe panga prevously invoice.project?.client?.id
         project_id: invoice.project?.id || invoice.project_id,
         issue_date: invoice.issue_date,
         due_date: invoice.due_date,
         status: invoice.status,
         notes: invoice.notes || "",
         invoice_items: invoiceItems.map((item) => {
            // Remove metadata fields
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

   const {
      data: invoices = [],
      error: invoicesError,
      isLoading: invoicesLoading,
   } = useQuery({
      queryKey: ["invoices", { status: statusFilter, client: clientFilter, project: projectFilter }],
      queryFn: async (): Promise<Invoice[]> => {
         const res = await api.get("/invoices/", {
            params: {
               status: statusFilter,
               client_id: clientFilter,
               project_id: projectFilter,
            },
         });
         return res.data;
      },
      enabled: isInitialized && isAuthenticated,
   });

   const createInvoiceMutation = useMutation({
      mutationFn: async (invoiceData: CreateInvoiceInput): Promise<Invoice> => {
         const cleanPayload = prepareInvoicePayload(invoiceData);
         console.log(cleanPayload);

         if (!cleanPayload.client_id || !cleanPayload.project_id) {
            throw new Error("Client and Project are required");
         }

         if (!cleanPayload.due_date) {
            throw new Error("Due Date is required");
         }

         if (!cleanPayload.invoice_items || cleanPayload.invoice_items.length === 0) {
            throw new Error("Invoice must have at least one item");
         }

         const response = await api.post<Invoice>("/invoices/create/", cleanPayload);
         return response.data;
      },
      onSuccess: (data) => {
         toast.success("Invoice Created", {
            style: {
               background: "#333",
               color: "#fff",
            },
            duration: 2000,
         });
         queryClient.invalidateQueries({ queryKey: ["invoices"] });
         navigate(`/invoices/${data.id}`);
         console.log(`Data Recieved : ${data}`);

         // Reset form state
         setInvoice({
            client: null,
            project: null,
            client_id: undefined,
            project_id: undefined,
            invoice_number: "",
            issue_date: new Date().toISOString().split("T")[0],
            due_date: "",
            status: "draft",
            subtotal: 0,
            total: 0,
            tax_amount: 0,
            tax_rate: 0,
            notes: "",
            items: [],
            InvoiceItems: [],
         } as Invoice);
         setSelectedProject(null);
         setInvoiceNotes("");
         setInvoiceDueDate(null);
         setBillableEntries([]);
      },
      onError: (error: any) => {
         const errorMessage = error?.response?.data?.message || error?.message || "Failed to create invoice";
         toast.error(errorMessage, {
            style: {
               background: "#333",
               color: "#fff",
            },
            duration: 2000,
         });
      },
   });

   const updateInvoiceMutation = useMutation({
      mutationFn: async ({
         invoiceId,
         updates,
      }: {
         invoiceId: number;
         updates: Partial<Invoice> & { _action?: string };
      }) => {
         const { _action, items, InvoiceItems, client, project, ...data } = updates;
         const res = await api.patch<Invoice>(`/invoices/${invoiceId}/update/`, data);
         return { data: res.data, action: _action };
      },
      onSuccess: (result) => {
         queryClient.invalidateQueries({ queryKey: ["invoice"] });

         const messages = {
            mark_paid: "Invoice marked as paid successfully!",
            send_email: "Email sent to client successfully!",
            default: "Invoice updated successfully!",
         };

         const colors = {
            mark_paid: "#10b981",
            send_email: "#3b82f6",
            default: "#333",
         };

         const action = result.action as keyof typeof messages;
         toast.success(messages[action] || messages.default, {
            style: {
               background: colors[action] || colors.default,
               color: "#fff",
            },
            duration: 2000,
         });
      },
      onError: (error: any) => {
         let errorMessage = "Failed to update invoice";

         if (error?.response?.data) {
            if (typeof error.response.data === "object" && !Array.isArray(error.response.data)) {
               const errors = Object.entries(error.response.data)
                  .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(", ") : messages}`)
                  .join("; ");
               errorMessage = errors || errorMessage;
            } else if (typeof error.response.data === "string") {
               errorMessage = error.response.data;
            } else if (error.response.data.message) {
               errorMessage = error.response.data.message;
            } else if (error.response.data.error) {
               errorMessage = error.response.data.error;
            }
         } else if (error?.message) {
            errorMessage = error.message;
         }

         toast.error(errorMessage, {
            style: {
               background: "#ef4444",
               color: "#fff",
            },
            duration: 4000,
         });
      },
   });

   const handleMarkAsPaid = (invoiceId: number) => {
      updateInvoiceMutation.mutate({
         invoiceId,
         updates: {
            status: "paid",
            payment_date: isoToDate(new Date().toISOString()),
            _action: "mark_paid",
         },
      });
   };

   const handleSendEmail = (invoiceId: number) => {
      updateInvoiceMutation.mutate({
         invoiceId,
         updates: {
            status: "sent",
            _action: "send_email",
         },
      });
   };

   // Recalculate totals whenever items change
   useEffect(() => {
      if (!invoice) return;

      // Use whichever array has items
      const items = invoice.items?.length ? invoice.items : invoice.InvoiceItems || [];

      const subtotal = items.reduce((sum, item) => {
         const amount = typeof item.amount === "string" ? parseFloat(item.amount) : item.amount;
         return sum + (amount || 0);
      }, 0);

      const taxRate = typeof invoice.tax_rate === "string" ? parseFloat(invoice.tax_rate) : invoice.tax_rate || 0;
      const taxAmount = subtotal * (taxRate / 100);
      const total = subtotal + taxAmount;

      setInvoice((prev) => {
         if (!prev) return prev;

         // Only update if values actually changed to avoid infinite loops
         if (prev.subtotal === subtotal && prev.tax_amount === taxAmount && prev.total === total) {
            return prev;
         }

         return {
            ...prev,
            subtotal,
            tax_amount: taxAmount,
            total,
         };
      });
   }, [invoice?.items?.length, invoice?.InvoiceItems?.length]);

   const addItemToInvoice = (entry: TimeEntry) => {
      if (!invoice) return;

      // Get hourly rate with proper type handling
      const projectRate =
         typeof selectedProject?.hourly_rate === "string"
            ? parseFloat(selectedProject.hourly_rate)
            : selectedProject?.hourly_rate;

      const userRate = typeof user?.hourly_rate === "string" ? parseFloat(user.hourly_rate) : user?.hourly_rate;

      const hourlyRate = projectRate || userRate || 0;
      const hours = entry.duration_minutes / 60;
      const amount = roundInvoice(hours * hourlyRate, 2);

      const newInvoiceItem: InvoiceItemWithMeta = {
         _timeEntryId: entry.id, // Track the source
         description: entry.description || "Time Entry",
         quantity: entry.duration_minutes,
         unit_price: hourlyRate,
         amount: amount,
      };

      setInvoice((prev) => {
         if (!prev) return prev;

         return {
            ...prev,
            items: [...(prev.items || []), newInvoiceItem],
            InvoiceItems: [...(prev.InvoiceItems || []), newInvoiceItem], // Keep both in sync
         };
      });

      setBillableEntries((prev) => prev.filter((e) => e.id !== entry.id));
   };

   const removeItemFromInvoice = (timeEntryId: number) => {
      if (!invoice) return;

      // Check both arrays for the item
      const itemToRemove =
         invoice.items?.find((item: any) => item._timeEntryId === timeEntryId) ||
         invoice.InvoiceItems?.find((item: any) => item._timeEntryId === timeEntryId);

      if (!itemToRemove) return;

      // Find the original entry from all timeEntries
      const originalEntry = timeEntries.find((e) => e.id === timeEntryId);

      if (originalEntry) {
         setBillableEntries((prev) => [...prev, originalEntry]);
      }

      setInvoice((prev) => {
         if (!prev) return prev;

         return {
            ...prev,
            items: (prev.items || []).filter((item: any) => item._timeEntryId !== timeEntryId),
            InvoiceItems: (prev.InvoiceItems || []).filter((item: any) => item._timeEntryId !== timeEntryId),
         };
      });
   };

   function roundInvoice(value: number, decimals: number = 2, method: RoundingMethod = "round"): number {
      const factor = Math.pow(10, decimals);

      switch (method) {
         case "up":
            return Math.ceil(value * factor) / factor;

         case "down":
            return Math.floor(value * factor) / factor;

         case "halfEven": {
            const scaled = value * factor;
            const floorVal = Math.floor(scaled);
            const diff = scaled - floorVal;

            if (diff > 0.5) return (floorVal + 1) / factor;
            if (diff < 0.5) return floorVal / factor;

            return (floorVal % 2 === 0 ? floorVal : floorVal + 1) / factor;
         }

         case "round":
         default:
            return Math.round(value * factor) / factor;
      }
   }

   useEffect(() => {
      // Check both items arrays
      const itemsCount = (invoice?.items?.length || 0) + (invoice?.InvoiceItems?.length || 0);

      if (!itemsCount) {
         setIsProjectChangeAllowed(true);
         return;
      }

      if (selectedProject && itemsCount > 0) {
         setIsProjectChangeAllowed(false);
      } else {
         setIsProjectChangeAllowed(true);
      }
   }, [selectedProject, invoice?.items?.length, invoice?.InvoiceItems?.length]);

   return (
      <InvoicesContext.Provider
         value={{
            createInvoice: createInvoiceMutation.mutate,
            createInvoiceLoading: createInvoiceMutation.isPending,
            invoice,
            setInvoice,
            selectedProject,
            setSelectedProject,
            invoiceDueDate,
            setInvoiceDueDate,
            invoiceNotes,
            setInvoiceNotes,
            billableEntries,
            setBillableEntries,
            addItemToInvoice,
            removeItemFromInvoice,
            roundInvoice,
            isProjectChangeAllowed,
            handleMarkAsPaid,
            handleSendEmail,
            statusFilter,
            setStatusFilter,
            clientFilter,
            setClientFilter,
            projectFilter,
            setProjectFilter,
            invoices,
            invoicesError,
            invoicesLoading,
         }}>
         {children}
      </InvoicesContext.Provider>
   );
};
