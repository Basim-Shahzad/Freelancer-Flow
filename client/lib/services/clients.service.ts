import type { ClientCreate, ClientListResponse, ClientResponse, ClientUpdate } from "@/lib/api/clients.types";
import { cleanParams, toListResult, type ListParams } from "@/lib/api/pagination";
import { api } from "./api.service";

export const clientsService = {
  list: (params: ListParams = {}) =>
    api.get<ClientListResponse>("/clients", { params: cleanParams(params) }).then((r) => toListResult(r.data, "clients")),
  get: (id: string) => api.get<ClientResponse>(`/clients/${id}`).then((r) => r.data),
  create: (body: ClientCreate) => api.post<ClientResponse>("/clients", body).then((r) => r.data),
  patch: (id: string, body: ClientUpdate) => api.patch<ClientResponse>(`/clients/${id}`, body).then((r) => r.data),
  remove: (id: string) => api.delete(`/clients/${id}`).then(() => undefined),
};
