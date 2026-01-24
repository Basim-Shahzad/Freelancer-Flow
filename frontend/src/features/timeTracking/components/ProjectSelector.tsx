import React, { useEffect } from "react";
import type { Project } from "@/types/models.js";
import { useTimer } from "@/features/timeTracking/hooks.js";
import { Autocomplete, AutocompleteItem } from "@heroui/react";
import { FaPlay } from "react-icons/fa";
import { useProjectStore } from "@/features/projects/store.js";

interface Props {
   projects: Project[];
}

export const ProjectSelector: React.FC<Props> = ({ projects }) => {
   const { startTimer } = useTimer();
   const { selectedProjectId, setSelectedProjectId } = useProjectStore();

   useEffect(() => {
      return () => setSelectedProjectId(null); // Clear on unmount
   }, [setSelectedProjectId]);

   const handleStart = () => {
      if (selectedProjectId) startTimer(selectedProjectId);
   };

   return (
      <div className="rounded-lg shadow-lg px-3 py-3">
         <h3 className="font-semibold text-2xl mb-4">Start Timer</h3>
         <div className="flex flex-col gap-2.5">
            <Autocomplete
               aria-label="Project Select"
               selectedKey={selectedProjectId ? String(selectedProjectId) : undefined}
               onSelectionChange={(key) => setSelectedProjectId(key ? Number(key) : null)}
               placeholder="Select a project"
               renderValue={(items) => items.map((item) => item.textValue).join(", ")}>
               {projects.map((proj) => (
                  <AutocompleteItem key={String(proj.id)} textValue={`${proj.name} - ${proj.client?.name || ""}`}>
                     <span className="font-bold">{proj.name}</span> -{" "}
                     <span className="font-light text-zinc-300">{proj.client?.name || ""}</span>
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
