import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { clientsApi } from "./api.js";
import { useAuthStore } from "@/features/auth/store.js";
import type { Client } from "./types.js";
import toast from "react-hot-toast";

export const useClients = (page?: number, size?: number) => {
   const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
   const params = page && size ? { page, size } : { paginate: 'false' };

   return useQuery({
      queryKey: ["clients", page, size],
      queryFn: () => clientsApi.getClients(params), 
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
      }
   });
};

export const useUpdateClient = () => {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: ({ id, data }: { id: number | string; data: Partial<Client> }) => 
         clientsApi.updateClient(id, data),
      onSuccess: (updatedClient) => {
         queryClient.invalidateQueries({ queryKey: ["clients"] });
         queryClient.setQueryData(["client", updatedClient.id], updatedClient);
         toast.success("Client updated");
      },
      onError: (error: any) => {
         toast.error(error?.response?.data?.message || "Failed to update client");
      }
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
      }
   });
};