import React from "react";
import { Autocomplete, AutocompleteItem } from "@heroui/react";
import { useProjects } from "@/features/projects/hooks.js";
import type { nonPaginatedProjectListResponse } from "@/features/projects/types.js";
import { useCreateInvoiceStore } from "../store.js";

interface ProjectSelectorProps {
   projectsData: nonPaginatedProjectListResponse | undefined
   projectsLoading: boolean
   projectsError: Error | null
}

const ProjectSelector: React.FC<ProjectSelectorProps> = () => {
   const selectedClientId = useCreateInvoiceStore((state) => state.selectedClientId)
   const { data, isLoading, error } = useProjects(false);
   const projects = data?.projects.filter((project) => project.clientId == selectedClientId) ?? [];

   if (error) {
      return (
         <Autocomplete
            isDisabled
            className=""
            label="Select a Project"
            placeholder="Error loading projects"
            errorMessage="Could not load data"
            isInvalid
         >
            {[]}
         </Autocomplete>
      );
   }

   return (
      <div className="w-full">
         <Autocomplete
            className=""
            variant="bordered"
            size="sm"
            label="Project"
            placeholder="Search for a project..."

            isDisabled={!selectedClientId}

            isLoading={isLoading}
            defaultItems={projects}
         >
            {(project) => (
               <AutocompleteItem 
                  key={project.id} 
                  textValue={project.name}
               >
                  <div className="flex flex-col">
                     <span className="text-sm">{project.name}</span>
                  </div>
               </AutocompleteItem>
            )}
         </Autocomplete>
      </div>
   );
};

export default ProjectSelector;