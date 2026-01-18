import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/Contexts/AuthContext.js";
import type { Client } from "@/types/models.js";
import { useApi } from "@/hooks/useApi.js";

export function useClients(page: number = 1, pageSize: number = 8) {
   const { api } = useApi();
   const queryClient = useQueryClient();
   const { isInitialized, isLoggedin } = useAuth();

   const { data: clientsTotal } = useQuery({
      queryKey: ["clientsTotal"],
      queryFn: async () => {
         const res = await api.get("/clients-total");
         return res.data.clientsTotal;
      },
      enabled: isInitialized && isLoggedin,
   });

   const {
      data: clients = [],
      error: clientsError,
      isLoading: clientsLoading,
   } = useQuery({
      queryKey: ["clients", page, pageSize],
      queryFn: async (): Promise<Client[]> => {
         const res = await api.get("/clients/");
         return res.data.clients;
      },
      enabled: isInitialized && isLoggedin,
   });

   // Create Client mutation
   const createClientMutation = useMutation({
      mutationFn: (projectData: {}) => api.post("/create-client/", projectData),
      onSuccess: () => {
         queryClient.invalidateQueries({ queryKey: ["projects"] });
      },
   });

   // Delete Client mutation
   const deleteClientMutation = useMutation({
      mutationFn: (projectId: number) => api.delete(`/projects/${projectId}/delete/`),
      onSuccess: () => {
         queryClient.invalidateQueries({ queryKey: ["projects"] });
      },
   });

   return {
      clientsTotal,
      clients,
      clientsError,
      clientsLoading,
      createClient: createClientMutation.mutate,
      isCreatingClient: createClientMutation.isPending,
      deleteClient: deleteClientMutation.mutate,
      isDeletingClient: deleteClientMutation.isPending,
   };
}
