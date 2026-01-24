import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { projectsApi } from "./api.js";
import { useAuthStore } from "@/features/auth/store.js";
import type { Project } from "./types.js";
import toast from "react-hot-toast";

export const useProjects = (page?: number, size?: number) => {
   const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
   const params = page && size ? { page, size } : { paginate: "false" };

   const query = useQuery({
      queryKey: ["projects", page, size],
      queryFn: () => projectsApi.getProjects(params),
      enabled: isAuthenticated,
      staleTime: 1000 * 60 * 5,
      placeholderData: { items: [], total: 0 },
   });

   return {
      ...query,
      data: query.data ?? { items: [], total: 0 },
   };
};

export const useProject = (id: number) => {
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
      mutationFn: ({ id, data }: { id: number; data: Partial<Project> }) => projectsApi.updateProject(id, data),
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
