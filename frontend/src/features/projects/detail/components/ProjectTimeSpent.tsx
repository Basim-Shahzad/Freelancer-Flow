import React from "react";
import type { Project } from "../../types.js";
import { minutesToHoursString, dateToWords } from "@/utils/formatters.js";

interface ProjectTimeSpentProps {
   totalTimeSpent: Project["totalTimeSpent"];
   dueDate: Project["dueDate"];
}

const ProjectTimeSpent: React.FC<ProjectTimeSpentProps> = ({ dueDate, totalTimeSpent }) => {
   return (
      <div className="border border-white/20 rounded-2xl px-4 py-4 flex flex-col">
         <div className="flex flex-col py-2">
            <span className="text-xl">Time Spent</span>
            <div className="flex justify-center">
               <h1 className="text-4xl font-semibold">{minutesToHoursString(totalTimeSpent)}</h1>
            </div>
         </div>
         <div className="border-t border-white/20"></div>
         <div className="flex flex-col py-2">
            <span className="text-xl">Due Date</span>
            <div className="flex justify-center">
               <h1 className="text-4xl font-semibold">{dateToWords(dueDate)}</h1>
            </div>
         </div>
      </div>
   );
};

export default ProjectTimeSpent;
