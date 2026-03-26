import type { Client, PaginatedClientListResponse, nonPaginatedClientListResponse } from "./types.js";
import { api } from "@/services/api.js";

export const clientsApi = {
   getClients: async (paginate: boolean): Promise<PaginatedClientListResponse | nonPaginatedClientListResponse> => {
      const { data } = await api.get("/clients/", {
         params: { paginate },
      });
      return paginate ? (data as PaginatedClientListResponse) : (data as nonPaginatedClientListResponse);
   },
   getClient: async (id: number | string): Promise<Client> => {
      const { data } = await api.get<Client>(`/clients/${id}/`);
      return data;
   },
   createClient: async (clientData: Omit<Client, "id" | "createdAt" | "updatedAt">): Promise<Client> => {
      const { data } = await api.post<Client>("/clients/", clientData);
      return data;
   },
   updateClient: async (id: number | string, clientData: Partial<Client>): Promise<Client> => {
      const { data } = await api.patch<Client>(`/clients/${id}/`, clientData);
      return data;
   },
   deleteClient: async (id: number | string): Promise<void> => {
      await api.delete(`/clients/${id}/`);
   },
};
