import React from "react";
import { TimeEntryRow } from "./TimeEntryRow.js";
import { Link } from "react-router-dom";
import { useTimeEntries } from "../hooks.js";

export const TimeEntriesList: React.FC = () => {
   const { data: entries, error, isLoading: entriesLoading } = useTimeEntries(1, 8);

   return (
      <div className="bg-white dark:bg-black rounded-lg shadow-xl px-3 py-3">
         <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-2xl">Recent Time Entries</h3>
            <Link to={"all-entries"} className="font-bold text-sm hover:underline cursor-pointer">
               See All
            </Link>
         </div>
         {entries.total === 0 ? (
            <p className="text-center text-gray-400 py-8">No time entries yet</p>
         ) : (
            <div className="flex flex-col gap-1">
               {entries.items.map((entry) => (
                  <TimeEntryRow key={entry.id} entry={entry} project={entry.project} />
               ))}
            </div>
         )}
      </div>
   );
};
