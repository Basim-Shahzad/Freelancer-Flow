import api from "@/services/api.service";
import type { Client, ClientListResponse } from "./clients.types";

export const useClients = {
   getAll: () => api.get<ClientListResponse>("/clients/"),
   get: (id: string) => api.get<Client>(`/clients/${id}/`),
   create: (data: Partial<Client>) => api.post<Client>("/clients/", data),
   update: (id: string, data: Partial<Client>) => api.put(`/clients/${id}/`, data),
   delete: (id: string) => api.delete(`/clients/${id}/`),
};
