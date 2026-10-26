import type { MilestoneCreate, MilestoneListResponse, MilestoneResponse, MilestoneUpdate } from "@/lib/api/projects.types";
import { api } from "./api.service";

export const milestonesService = {
  list: (projectId: string) =>
    api.get<MilestoneListResponse>(`/projects/${projectId}/milestones/`).then((r) => r.data.milestones),
  create: (body: MilestoneCreate) => api.post<MilestoneResponse>("/milestones", body).then((r) => r.data),
  patch: (id: string, body: MilestoneUpdate) => api.patch<MilestoneResponse>(`/milestones/${id}`, body).then((r) => r.data),
  remove: (id: string) => api.delete(`/milestones/${id}`).then(() => undefined),
  /** POST only: the GET form is deprecated because a state-changing GET can be prefetched. */
  submit: (id: string) => api.post<MilestoneResponse>(`/milestones/${id}/submit`).then((r) => r.data),
  /** Every milestone id of the project, once, in the desired order. */
  reorder: (projectId: string, milestoneIds: string[]) =>
    api.put<MilestoneListResponse>(`/projects/${projectId}/milestones/order`, { milestoneIds }).then((r) => r.data.milestones),
};
