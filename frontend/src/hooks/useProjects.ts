import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "./useApi.js";
import type { Project } from "@/types/models.js";
import { useAuth } from "@/Contexts/AuthContext.js";

export function useProjects() {
   // page = 1, pageSize = 6
   const { api } = useApi();
   const queryClient = useQueryClient();
   const { isLoggedin, isInitialized } = useAuth();

   // Fetch projects Count
   const { data: projectsTotal } = useQuery({
      queryKey: ["projectsTotal"],
      queryFn: async () => {
         const res = await api.get("/projects-total");
         return res.data.projectsTotal;
      },
      enabled: isInitialized && isLoggedin,
   });

   // Fetch projects
   const {
      data: projects = [],
      error,
      isLoading,
   } = useQuery({
      queryKey: ["projects"],
      queryFn: async (): Promise<Project[]> => {
         const res = await api.get("/projects/");
         return res.data.projects;
      },
      enabled: isInitialized && isLoggedin,
   });

   // Create project mutation
   const createProjectMutation = useMutation({
      mutationFn: (projectData) => api.post("/create-project/", projectData),
      onSuccess: () => {
         queryClient.invalidateQueries({ queryKey: ["projects"] });
      },
   });

   // Delete project mutation
   const deleteProjectMutation = useMutation({
      mutationFn: (projectId) => api.delete(`/projects/${projectId}/delete/`),
      onSuccess: () => {
         queryClient.invalidateQueries({ queryKey: ["projects"] });
      },
   });

   return {
      projectsTotal,
      projects,
      projectsError: error,
      projectsLoading: isLoading,
      createProject: createProjectMutation.mutate,
      isCreating: createProjectMutation.isPending,
      deleteProject: deleteProjectMutation.mutate,
      isDeleting: deleteProjectMutation.isPending,
   };
}

export function useProject(projectId: number) {
   const { api } = useApi();
   const { isLoggedin, isInitialized } = useAuth();
   const queryClient = useQueryClient();

   const {
      data: project = [],
      error: projectFetchError,
      isLoading: fetchingProject,
   } = useQuery({
      queryKey: ["project", projectId],
      queryFn: async () => {
         const res = await api.get(`/projects/${projectId}/`);
         return res.data;
      },
      enabled: !!projectId && isInitialized && isLoggedin,
   });

   const updateStatusMutation = useMutation({
      mutationFn: (newStatus) => api.patch(`/projects/${projectId}/status/`, { status: newStatus }),
      onSuccess: () => {
         queryClient.invalidateQueries({ queryKey: ["project"] });
         queryClient.invalidateQueries({ queryKey: ["projects"] });
      },
   });

   const handleStatusChange = (newStatus) => {
      updateStatusMutation.mutate(newStatus);
   };

   return {
      project,
      projectFetchError,
      fetchingProject,
      handleStatusChange,
   };
}
