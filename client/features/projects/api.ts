import api from "@/services/api.service";
import { Project, ProjectListResponse } from "./types";

export const projectsApi = {
   getAll: async (filters?: any) => {
      const response = await api.get<ProjectListResponse>(`/projects/`, {
         params: filters,
      });
      return response.data;
   },

   get: async (projectId: string) => {
      const response = await api.get<Project>(`/projects/${projectId}`);
      return response.data;
   },
   create: async (project: Partial<Project>) => {
      const response = await api.post<Project>("/projects", project);
      return response.data;
   },

   update: async (projectId: string, project: Partial<Project>) => {
      const response = await api.patch<Project>(
         `/projects/${projectId}`,
         project,
      );
      return response.data;
   },

   delete: async (projectId: string) => {
      const response = await api.delete(`/projects/${projectId}`);
      return response.data;
   },
};

