import api from "@/services/api.service";
import { Client, ClientListResponse } from "./types";

export const clientsApi = {
   getAll: async (filters?: any) => {
      const response = await api.get<ClientListResponse>(`/clients/`, {
         params: filters,
      });
      return response.data;
   },

   get: async (clientId: string) => {
      const response = await api.get<Client>(`/clients/${clientId}`);
      return response.data;
   },
   create: async (client: Partial<Client>) => {
      const response = await api.post<Client>("/clients", client);
      return response.data;
   },

   update: async (clientId: string, client: Partial<Client>) => {
      const response = await api.patch<Client>(`/clients/${clientId}`, client);
      return response.data;
   },

   delete: async (clientId: string) => {
      const response = await api.delete(`/clients/${clientId}`);
      return response.data;
   },
};
