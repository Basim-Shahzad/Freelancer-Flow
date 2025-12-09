import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useApi } from "../Contexts/Api";

export function useProjects(page = 1, pageSize = 6) {
   const { api } = useApi();
   const queryClient = useQueryClient();

   // Fetch projects Count
   const { data: projectsTotal } = useQuery({
      queryKey: ["projectsTotal"],
      queryFn: async () => {
         const res = await api.get("/projects-total");
         return res.data.projectsTotal;
      },
   });

   // Fetch projects
   const {
      data: projects = [],
      error,
      isLoading,
   } = useQuery({
      queryKey: ["projects", page, pageSize],
      queryFn: async () => {
         try {
            const res = await api.get("/projects/", {
               params: {
                  page: page,
                  page_size: pageSize,
               },
            });
            return res.data.projects;
         } catch (error) {
            console.error(error);
         }
      },
      keepPreviousData: true,
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
      error,
      isLoading,
      createProject: createProjectMutation.mutate,
      isCreating: createProjectMutation.isPending,
      deleteProject: deleteProjectMutation.mutate,
      isDeleting: deleteProjectMutation.isPending,
   };
}

export function useProject(projectId) {
   const { api } = useApi();
   const queryClient = useQueryClient();

   const {
      data: project = [],
      error,
      isLoading,
   } = useQuery({
      queryKey: ["project", projectId],
      queryFn: async () => {
         const res = await api.get(`/projects/${projectId}/`);
         return res.data;
      },
      enabled: !!projectId,
   });

   const updateStatusMutation = useMutation({
      mutationFn: (newStatus) => api.patch(`/projects/${projectId}/status/`, { status: newStatus }),
      onSuccess: () => {
         queryClient.invalidateQueries({ queryKey: ["project", id] });
         queryClient.invalidateQueries({ queryKey: ["projects"] });
      },
   });

   const handleStatusChange = (newStatus) => {
      updateStatusMutation.mutate(newStatus);
   };

   return {
      project,
      error,
      isLoading,
      handleStatusChange,
   };
}
