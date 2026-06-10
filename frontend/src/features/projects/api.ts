import type { Project, PaginatedProjectListResponse, nonPaginatedProjectListResponse } from "./types.js";
import { api } from "@/services/api.js";

export const projectsApi = {
   getProjects: async (paginate: boolean): Promise<PaginatedProjectListResponse | nonPaginatedProjectListResponse> => {
      const { data } = await api.get("/projects/", {
         params: { paginate },
      });
      return paginate ? (data as PaginatedProjectListResponse) : (data as nonPaginatedProjectListResponse);
   },
   getProject: async (id: string): Promise<Project> => {
      const { data } = await api.get<Project>(`/projects/${id}/`);
      return data;
   },
   createProject: async (projectData: Partial<Project>): Promise<Project> => {
      const { data } = await api.post<Project>("/projects/", projectData);
      return data;
   },
   updateProject: async (id: string, projectData: Partial<Project>): Promise<Project> => {
      const { data } = await api.patch<Project>(`/projects/${id}/`, projectData);
      return data;
   },
   deleteProject: async (id: string): Promise<void> => {
      await api.delete(`/projects/${id}/`);
   },
};
