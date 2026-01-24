import type { Project } from "./types.js";
import { api } from "@/hooks/useApi.js";

export const projectsApi = {
   getProjects: async (params?: { page: number; size: number } | { paginate: string }): Promise<{ items: Project[]; total: number }> => {
      const { data } = await api.get("/projects/", {
         params: params || { paginate: 'false' },
      });

      return {
         items: data.projects || [],
         total: data.total || data.count || data.projects?.length || 0,
      };
   },

   getProject: async (id: number | string): Promise<Project> => {
      const { data } = await api.get<Project>(`/projects/${id}/`);
      return data;
   },

   createProject: async (projectData: Omit<Project, "id" | "created_at">): Promise<Project> => {
      const { data } = await api.post<Project>("/create-project/", projectData);
      return data;
   },

   updateProject: async (id: number, projectData: Partial<Project>): Promise<Project> => {
      const { data } = await api.patch<Project>(`/projects/${id}/update/`, projectData);
      return data;
   },

   deleteProject: async (id: number | string): Promise<void> => {
      await api.delete(`/projects/${id}/delete/`);
   },
};

// projects/<int:pk>/status/