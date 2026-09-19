import { useQuery, useMutation } from "@tanstack/react-query";
import { Client, ClientListResponse } from "./types";
import { AxiosError } from "axios";
import { clientsApi } from "./api";

export function useClients() {
   return useQuery<ClientListResponse, AxiosError<ApiError>>({
      queryKey: ["clients"],
      queryFn: () => clientsApi.getAll(),
   });
}

export function useCreateClient() {
   return useMutation<Client, AxiosError<ApiValidationError>, Partial<Client>>({
      mutationFn: (clientData: Partial<Client>) =>
         clientsApi.create(clientData),
   });
}

export function useClient(id: string) {
   return useQuery<Client, AxiosError<ApiError>>({
      queryKey: ["client", id],
      queryFn: () => clientsApi.get(id),
   });
}

export function useUpdateClient(id: string) {
   return useMutation<Client, AxiosError<ApiValidationError>, Partial<Client>>({
      mutationFn: (clientData: Partial<Client>) =>
         clientsApi.update(id, clientData),
   });
}

export function useDeleteClient(clientId: string) {
   return useMutation<void, AxiosError<ApiValidationError>>({
      mutationFn: () => clientsApi.delete(clientId),
   });
}
