import React from "react";
import type { Project } from "@/types/models.js";
import ProjectCard from "./ProjectCard.js";
import { useProjects } from "@/hooks/useProjects.js";
import "@/Styles/projects.css";

const ProjectGrid = () => {
   const { projects, isLoading, error } = useProjects();

   if (isLoading) {
      return <div className="text-9xl text-red-600">Loading....</div>;
   }

   return (
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 py-2.5">
         {projects.map((p: Project) => (
            <ProjectCard key={p.id} project={p} />
         ))}
         {/* <ProjectCard project={projects[0]} /> */}
      </div>
   );
};

export default ProjectGrid;
