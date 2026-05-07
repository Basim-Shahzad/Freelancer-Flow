import type { TimeEntryInList } from "@/features/timeTracking/type.js";
import React from "react";
import { createdAtToDateTimeString, minutesToHoursString } from "@/utils/formatters.js";

interface ProjectTimeEntryProps {
   timeEntry: TimeEntryInList;
}

const ProjectTimeEntry: React.FC<ProjectTimeEntryProps> = ({ timeEntry }) => {
   return (
      <div className="border border-white/20 rounded-2xl flex items-center justify-between px-4 py-2">
         <div>
            <h2 className="text-xl" >
               {timeEntry.description}
            </h2>
            <p className="text-xs dark:text-white/60" >
               {createdAtToDateTimeString(timeEntry.createdAt)}
            </p>
         </div>
         <div className="text-xl" >
            {minutesToHoursString(timeEntry.durationMinutes)}
         </div>
      </div>
   );
};

export default ProjectTimeEntry;
