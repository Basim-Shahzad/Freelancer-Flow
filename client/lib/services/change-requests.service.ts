import type { ChangeRequestCreate, ChangeRequestListResponse, ChangeRequestResponse, ChangeRequestUpdate } from "@/lib/api/change-requests.types";
import { cleanParams, toListResult, type ListParams } from "@/lib/api/pagination";
import { api } from "./api.service";

export interface ChangeRequestListParams extends ListParams {
  project_id?: string;
  status?: string;
}

export const changeRequestsService = {
  list: (params: ChangeRequestListParams = {}) =>
    api.get<ChangeRequestListResponse>("/change-requests", { params: cleanParams(params) }).then((r) => toListResult(r.data, "changeRequests")),
  get: (id: string) => api.get<ChangeRequestResponse>(`/change-requests/${id}`).then((r) => r.data),
  create: (body: ChangeRequestCreate) => api.post<ChangeRequestResponse>("/change-requests", body).then((r) => r.data),
  patch: (id: string, body: ChangeRequestUpdate) => api.patch<ChangeRequestResponse>(`/change-requests/${id}`, body).then((r) => r.data),
  remove: (id: string) => api.delete(`/change-requests/${id}`).then(() => undefined),
};
