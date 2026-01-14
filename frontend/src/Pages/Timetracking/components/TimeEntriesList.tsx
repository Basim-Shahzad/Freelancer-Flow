import React from "react";

import type { Project, TimeEntry } from "@/types/models.js";
import { TimeEntryRow } from "./TimeEntryRow.js";
import { useTimer } from "@/Contexts/TimerContext.js";
import { Link } from "react-router-dom";

export const TimeEntriesList: React.FC = () => {
   const { entries } = useTimer();
   
   return (
      <div className="bg-white dark:bg-black rounded-lg shadow-xl px-3 py-3">
         <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-2xl">Recent Time Entries</h3>
            <Link to={'all-entries'} className="font-bold text-sm hover:underline cursor-pointer" >See All</Link>
         </div>
         {entries.length === 0 ? (
            <p className="text-center text-gray-400 py-8">No time entries yet</p>
         ) : (
            <div className="flex flex-col gap-1">
               {entries.slice(0, 5).map((entry) => (
                  <TimeEntryRow key={entry.id} entry={entry} project={entry.project} />
               ))}
            </div>
         )}
      </div>
   );
};
