import React from "react";
import type { TimeEntryInList } from "@/features/timeTracking/type.js";
import ProjectTimeEntry from "./ProjectTimeEntry.js";

interface ProjectTimeEntryListProps {
   timeEntries: TimeEntryInList[] | undefined;
   isTimeEntriesLoading: boolean;
   isTimeEntryError: boolean;
}

const ProjectTimeEntryList: React.FC<ProjectTimeEntryListProps> = ({
   timeEntries,
   isTimeEntryError,
   isTimeEntriesLoading,
}) => {

   if (!timeEntries || isTimeEntriesLoading) {
      return "Loading";
   }

   return (
      <div>
         <h1 className="text-2xl font-semibold mb-4" >Time Logs</h1>
         {timeEntries.map((timeEntry) => (
            <ProjectTimeEntry key={timeEntry.id} timeEntry={timeEntry} />
         ))}
      </div>
   );
};

export default ProjectTimeEntryList;
