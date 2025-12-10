import { useState, useEffect } from "react";
import { useApi } from "./useApi.jsx";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";

export function useClients(page = 1, pageSize = 8) {
   const { api } = useApi();
   const queryClient = useQueryClient();

   const { data: clientsTotal } = useQuery({
      queryKey: ["clientsTotal"],
      queryFn: async () => {
         const res = await api.get("/clients-total");
         return res.data.clientsTotal;
      },
   });

   const {
      data: clients = [],
      error: clientsError,
      isLoading: clientsLoading,
   } = useQuery({
      queryKey: ["clients", page, pageSize],
      queryFn: async () => {
         try {
            const res = await api.get("/clients/", {
               params: {
                  page: page,
                  page_size: pageSize,
               },
            });
            console.log(res.data.clients);
            return res.data.clients;
         } catch (error) {
            console.error(error);
         }
      },
   });

   // Create project mutation
   const createClientMutation = useMutation({
      mutationFn: (projectData: {}) => api.post("/create-client/", projectData),
      onSuccess: () => {
         queryClient.invalidateQueries({ queryKey: ["projects"] });
      },
   });

   // Delete project mutation
   const deleteClientMutation = useMutation({
      mutationFn: (projectId) => api.delete(`/projects/${projectId}/delete/`),
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
