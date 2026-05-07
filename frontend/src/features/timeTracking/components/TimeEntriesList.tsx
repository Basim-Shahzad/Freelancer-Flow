import React from "react";
import { TimeEntryRow } from "./TimeEntryRow.js";
import { Link } from "react-router-dom";
import { useTimeEntries } from "../hooks.js";

export const TimeEntriesList: React.FC = () => {
   const { data: entries, error, isLoading: entriesLoading } = useTimeEntries(true);

   return (
      <div className="bg-white dark:bg-black rounded-lg shadow-xl px-3 py-3">
         <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-2xl">Recent Time Entries</h3>
            <Link to={"all-entries"} className="font-bold text-sm hover:underline cursor-pointer">
               See All
            </Link>
         </div>
         {entries?.count === 0 ? (
            <p className="text-center text-gray-400 py-8">No time entries yet</p>
         ) : (
            <div className="flex flex-col gap-1">
               {entries?.results.timeEntries.map((entry) => (
                  // FIX: was passing entry.projectId as `project` prop but TimeEntryRow expected a Project object → crashed on project.name
                  // Now prop is typed as string in TimeEntryRow and receives the ID correctly
                  <TimeEntryRow key={entry.id} entry={entry} project={entry.projectId} />
               ))}
            </div>
         )}
      </div>
   );
};
