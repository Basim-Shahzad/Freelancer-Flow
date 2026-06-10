import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invoicesApi } from "./api.js";
import { useAuthStore } from "@/features/auth/store.js";
import type { InvoiceStatus } from "./types.js";
import { toast } from "react-hot-toast";

export const useInvoices = <T extends boolean>(
   paginate: T,
   status?: InvoiceStatus,
   clientId?: string,
   projectId?: string,
) => {
   const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

   return useQuery({
      queryKey: ["invoices", paginate, status, clientId, projectId],
      queryFn: () => invoicesApi.getInvoices(paginate, status, clientId, projectId),
      enabled: isAuthenticated,
      staleTime: 1000 * 60 * 5,
   });
};

export const useCreateInvoice = () => {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: invoicesApi.createInvoice,
      onSuccess: () => {
         queryClient.invalidateQueries({ queryKey: ["invoices"] });
         toast.success("Invoice created successfully");
      },
      onError: (error: any) => {
         toast.error(error?.response?.data?.message || "Failed to create invoice");
      },
   });
};
