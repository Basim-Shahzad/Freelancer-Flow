import React, { useState } from "react";
import type { Project } from "@/types/models.js";
import { useTimer } from "@/Contexts/TimerContext.js";
import { Select, SelectItem } from "@heroui/react";
import { FaPlay } from "react-icons/fa";

interface Props {
   projects: Project[];
}

export const ProjectSelector: React.FC<Props> = ({ projects }) => {
   const { startTimer } = useTimer();
   const [selected, setSelected] = useState<Set<string>>(new Set());

   const handleStart = () => {
      const id = Number([...selected][0]);
      if (id) startTimer(id);
   };

   return (
      <div className="rounded-lg shadow-lg px-3 py-3">
         <h3 className="font-semibold text-2xl mb-4">Start Timer</h3>
         <div className="flex flex-col gap-2.5">
            <Select
               aria-label="Project Select"
               selectedKeys={selected}
               onSelectionChange={(keys) => setSelected(keys as Set<string>)}
               placeholder="Select a project"
               renderValue={(items) => items.map((item) => item.textValue).join(", ")}>
               {projects.map((proj) => (
                  <SelectItem key={String(proj.id)} textValue={`${proj.name} - ${proj.client.name}`}>
                     <span className="font-bold" >{proj.name}</span> - <span className="font-light text-zinc-300" >{proj.client.name}</span>
                  </SelectItem>
               ))}
            </Select>
            <button
               onClick={handleStart}
               disabled={!selected}
               className={`w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition hover:cursor-pointer`}>
               <FaPlay size={20} />
               Start Timer
            </button>
         </div>
      </div>
   );
};
