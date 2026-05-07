import React, { useEffect } from "react";
import type { ProjectInList } from "@/features/projects/types.js";
import { Autocomplete, AutocompleteItem } from "@heroui/react";
import { FaPlay } from "react-icons/fa";
import { useTimerStore } from "../store.js";

interface ProjectSelectorProps {
   projects: ProjectInList[] | undefined;
}

export const ProjectSelector: React.FC<ProjectSelectorProps> = ({ projects }) => {
   const setSelectedProjectId = useTimerStore((state) => state.setSelectedProjectId);
   const selectedProjectId = useTimerStore((state) => state.selectedProjectId);
   const startTimer = useTimerStore((state) => state.startTimer);

   const handleStart = () => {
      if (selectedProjectId) startTimer(selectedProjectId);
   };

   if (projects)
      return (
         // temporary if projects
         <div className="rounded-lg shadow-lg px-3 py-3">
            <h3 className="font-semibold text-2xl mb-4">Start Timer</h3>
            <div className="flex flex-col gap-2.5">
               <Autocomplete
                  aria-label="Project Select"
                  selectedKey={selectedProjectId}
                  onSelectionChange={(key) => {
                     if (key) setSelectedProjectId(String(key));
                  }}
                  placeholder="Select a project">
                  {projects.map((proj) => (
                     <AutocompleteItem key={String(proj.id)} textValue={proj.name}>
                        <span className="font-bold">{proj.name}</span>
                     </AutocompleteItem>
                  ))}
               </Autocomplete>
               <button
                  onClick={handleStart}
                  disabled={!selectedProjectId}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition hover:cursor-pointer`}>
                  <FaPlay size={20} />
                  Start Timer
               </button>
            </div>
         </div>
      );
};
