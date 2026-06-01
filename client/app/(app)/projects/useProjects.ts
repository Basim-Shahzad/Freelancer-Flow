import api from "@/services/api.service";
import type { ProjectListResponse, Project } from "./project.types";

export const useProjects = {
   getAll: () => api.get<ProjectListResponse>("/projects/"),
   get: (id: string) => api.get<Project>(`/projects/${id}/`),
   create: (data: Partial<Project>) => api.post("/projects/", data),
   update: (id: string, data: Partial<Project>) => api.put(`/projects/${id}/`, data),
   delete: (id: string) => api.delete(`/projects/${id}/`),
};
