"use client";

import { useState } from "react";
import EmptyState from "@/components/EmptyState";
import Header from "@/components/Header";
import FiltersHeader from "@/components/FiltersHeader";
import { useQuery } from "@tanstack/react-query";
import { Spinner } from "@heroui/react";
import { useProjects } from "./useProjects";
import ProjectCard from "./components/ProjectCard";
import ProjectsTable from "./components/ProjectsTable";
import ProjectContainer from "./components/ProjectContainer";
import { useProjectsStore } from "@/stores/useDisplayStore";

const ProjectsIcon = () => (
   <svg width="52" height="52" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="4" width="19" height="19" rx="4" stroke="currentColor" strokeWidth="1.5" />
      <rect x="29" y="4" width="19" height="19" rx="4" stroke="currentColor" strokeWidth="1.5" />
      <rect x="4" y="29" width="19" height="19" rx="4" stroke="currentColor" strokeWidth="1.5" />
      <rect x="29" y="29" width="19" height="19" rx="4" stroke="currentColor" strokeWidth="1.5" />
   </svg>
);

export default function ProjectsPage() {
   const projectsStore = useProjectsStore();
   const { display } = projectsStore;
   const [page, setPage] = useState(1);

   const {
      data: res,
      isLoading,
      isError,
      error,
   } = useQuery({
      queryKey: ["projects", page],
      queryFn: () => useProjects.getAll(),
   });

   if (isLoading)
      // TEMP BUT WORKS FN
      return (
         <div className="">
            <Spinner className="absolute right-2/5 top-3/7" />
         </div>
      );

   if (isError)
      return (
         <div className="">
            <p className="absolute right-2/5 top-3/7 text-red-500">Error: {error.message}</p>
         </div>
      ); // TEMP BUT WORKS FN

   if (res?.data?.projects?.length === 0)
      return (
         <EmptyState
            icon={<ProjectsIcon />}
            title="Projects"
            description="You don't have any projects."
            primaryAction={{
               label: "Create new project",
               onClick() {
                  console.log("Create new project"); // TODO : Create new project modal
               },
            }}
         />
      );

   return (
      <main className="h=full">
         <Header title="Projects" />
         <FiltersHeader chips={[`${res?.data.total} projects`]} displayStore={projectsStore} />

         {display === "board" && (
            <section className="mx-8 my-8 h-full flex gap-4 overflow-x-auto">
               {Object.values(
                  (res?.data.projects ?? []).reduce<
                     Record<string, { clientName: string; projects: typeof res.data.projects }>
                  >((groups, project) => {
                     const clientId = project.client?.id ?? "no-client";
                     const clientName = project.client?.name ?? "No Client";

                     if (!groups[clientId]) {
                        groups[clientId] = { clientName, projects: [] };
                     }
                     groups[clientId].projects.push(project);

                     return groups;
                  }, {}),
               ).map(({ clientName, projects }) => (
                  <article key={clientName}>
                     <ProjectContainer title={clientName} count={projects.length}>
                        <div className="flex flex-col gap-2">
                           {projects.map((project) => (
                              <ProjectCard project={project} key={project.id} />
                           ))}
                        </div>
                     </ProjectContainer>
                  </article>
               ))}
            </section>
         )}

         {display === "list" && (
            <section className="">
               <ProjectsTable responseData={res?.data!} page={page} onPageChange={setPage} />
            </section>
         )}
      </main>
   );
}
