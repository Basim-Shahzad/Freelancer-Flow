import { projectsApi } from "./api";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
   Project,
   ProjectInList,
   ProjectListResponse,
   ProjectStatus,
   projectStatuses,
} from "./types";
import { AxiosError } from "axios";

export function useProjects() {
   return useQuery<ProjectListResponse, AxiosError<ApiError>>({
      queryKey: ["projects"],
      queryFn: () => projectsApi.getAll(),
   });
}

export function useCreateProject() {
   return useMutation<
      Project,
      AxiosError<ApiValidationError>,
      Partial<Project>
   >({
      mutationFn: (projectData: Partial<Project>) =>
         projectsApi.create(projectData),
   });
}

export function useProject(id: string) {
   return useQuery<Project, AxiosError<ApiError>>({
      queryKey: ["project", id],
      queryFn: () => projectsApi.get(id),
   });
}

export function useUpdateProject(id: string) {
   return useMutation<Project, AxiosError<ApiValidationError>, Partial<Project>>({
      mutationFn: (projectData: Partial<Project>) =>
         projectsApi.update(id, projectData),
   });
}

export function useDeleteProject(projectId: string) {
   return useMutation<void, AxiosError<ApiValidationError>>({
      mutationFn: () => projectsApi.delete(projectId),
   });
}
