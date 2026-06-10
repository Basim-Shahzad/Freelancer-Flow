import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { clientsApi } from "./api.js";
import { useAuthStore } from "@/features/auth/store.js";
import type { Client, PaginatedClientListResponse, nonPaginatedClientListResponse } from "./types.js";
import { toast } from "react-hot-toast";

export const useClients = <T extends boolean>(paginate: T) => {
   const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

   return useQuery({
      queryKey: ["clients", paginate],
      queryFn: () =>
         clientsApi.getClients(paginate) as Promise<
            T extends true ? PaginatedClientListResponse : nonPaginatedClientListResponse
         >,
      enabled: isAuthenticated,
      staleTime: 1000 * 60 * 5,
   });
};

export const useCreateClient = () => {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: clientsApi.createClient,
      onSuccess: () => {
         queryClient.invalidateQueries({ queryKey: ["clients"] });
         toast.success("Client created successfully");
      },
      onError: (error: any) => {
         toast.error(error?.response?.data?.message || "Failed to create client");
      },
   });
};

export const useUpdateClient = () => {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: ({ id, data }: { id: number | string; data: Partial<Client> }) => clientsApi.updateClient(id, data),
      onSuccess: (updatedClient) => {
         queryClient.invalidateQueries({ queryKey: ["clients"] });
         queryClient.setQueryData(["client", updatedClient.id], updatedClient);
         toast.success("Client updated");
      },
      onError: (error: any) => {
         toast.error(error?.response?.data?.message || "Failed to update client");
      },
   });
};

export const useDeleteClient = () => {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: clientsApi.deleteClient,
      onSuccess: () => {
         queryClient.invalidateQueries({ queryKey: ["clients"] });
         toast.success("Client deleted");
      },
      onError: (error: any) => {
         toast.error(error?.response?.data?.message || "Could not delete client");
      },
   });
};
