import type { Client } from "./types.js";
import { api } from "@/hooks/useApi.js";

export const clientsApi = {
   getClients: async (params?: { page: number; size: number } | { paginate: string }): Promise<{ items: Client[]; total: number }> => {
      const { data } = await api.get("/clients/", {
         params: params || { paginate: 'false' },
      });

      return {
         items: data.clients || [],
         total: data.total || data.count || data.clients?.length || 0,
      };
   },

   getClient: async (id: number | string): Promise<Client> => {
      const { data } = await api.get<Client>(`/clients/${id}/`);
      return data;
   },

   createClient: async (clientData: Omit<Client, "id" | "created_at">): Promise<Client> => {
      const { data } = await api.post<Client>("/create-client/", clientData);
      return data;
   },

   updateClient: async (id: number | string, clientData: Partial<Client>): Promise<Client> => {
      const { data } = await api.patch<Client>(`/clients/${id}/update`, clientData);
      return data;
   },

   deleteClient: async (id: number | string): Promise<void> => {
      await api.delete(`/clients/${id}/delete`);
   },
};