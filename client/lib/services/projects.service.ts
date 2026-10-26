import type {
  ApiProjectStatus, ProjectCreate, ProjectListResponse, ProjectResponse, ProjectUpdate, RetainerPeriodListResponse,
} from "@/lib/api/projects.types";
import { cleanParams, toListResult, type ListParams } from "@/lib/api/pagination";
import { api } from "./api.service";

/** Query params of `GET /projects` (`client_id` is snake_case on the wire). */
export interface ProjectListParams extends ListParams {
  client_id?: string;
  status?: ApiProjectStatus;
}

export const projectsService = {
  list: (params: ProjectListParams = {}) =>
    api.get<ProjectListResponse>("/projects", { params: cleanParams(params) }).then((r) => toListResult(r.data, "projects")),
  get: (id: string) => api.get<ProjectResponse>(`/projects/${id}`).then((r) => r.data),
  create: (body: ProjectCreate) => api.post<ProjectResponse>("/projects", body).then((r) => r.data),
  patch: (id: string, body: ProjectUpdate) => api.patch<ProjectResponse>(`/projects/${id}`, body).then((r) => r.data),
  remove: (id: string) => api.delete(`/projects/${id}`).then(() => undefined),
  retainerPeriods: (id: string) =>
    api.get<RetainerPeriodListResponse>(`/projects/${id}/retainer-periods`).then((r) => r.data.periods),
};
