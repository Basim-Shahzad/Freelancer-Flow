import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { projectsApi } from "./api.js";
import { useAuthStore } from "@/features/auth/store.js";
import type { Project, PaginatedProjectListResponse, nonPaginatedProjectListResponse } from "./types.js";
import { toast } from "react-hot-toast";

export const useProjects = <T extends boolean>(paginate: T) => {
   const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

   return useQuery({
      queryKey: ["projects", paginate],
      queryFn: () =>
         projectsApi.getProjects(paginate) as Promise<
            T extends true ? PaginatedProjectListResponse : nonPaginatedProjectListResponse
         >,
      enabled: isAuthenticated,
      staleTime: 1000 * 60 * 5,
   });
};

export const useProject = (id: string) => {
   const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

   return useQuery({
      queryKey: ["project", id],
      queryFn: () => projectsApi.getProject(id),
      enabled: isAuthenticated && !!id,
      staleTime: 0,
   });
};

export const useCreateProject = () => {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: projectsApi.createProject,
      onSuccess: () => {
         queryClient.invalidateQueries({ queryKey: ["projects"] });
         toast.success("Project created successfully");
      },
      onError: (error: any) => {
         toast.error(error?.response?.data?.message || "Failed to create project");
      },
   });
};

export const useUpdateProject = () => {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: ({ id, data }: { id: string; data: Partial<Project> }) => projectsApi.updateProject(id, data),
      onSuccess: (updatedProject) => {
         queryClient.refetchQueries({ queryKey: ["projects"] });
         queryClient.setQueryData(["project", updatedProject.id], updatedProject);
         toast.success("Project updated");
      },
      onError: (error: any) => {
         toast.error(error?.response?.data?.message || "Failed to update client");
      },
   });
};

export const useDeleteProject = () => {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: projectsApi.deleteProject,
      onSuccess: () => {
         queryClient.invalidateQueries({ queryKey: ["projects"] });
         toast.success("Project deleted");
      },
      onError: (error: any) => {
         toast.error(error?.response?.data?.message || "Could not delete project");
      },
   });
};
