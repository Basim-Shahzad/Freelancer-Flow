import { useState, useEffect } from "react";
import { useApi } from "./useApi.jsx";
import { useQuery } from "@tanstack/react-query";

export function useClients() {
   const { api } = useApi();

   const {
      data: clients = [],
      error : clientsError,
      isLoading : clientsLoading,
   } = useQuery({
      queryKey: ["clients"],
      queryFn: async () => {
         try {
            const res = await api.get("/clients/");
            console.log(res.data.clients);
            return res.data.clients;
         } catch (error) {
            console.error(error);
         }
      }
   });

   return { clients, clientsError, clientsLoading };
}
