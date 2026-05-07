import { useState, useRef, useEffect } from "react";
import type { TimeEntryInList } from "@/features/timeTracking/type.js";
import { formatDuration } from "@/utils/time.utils.js";
import { useUpdateTimeEntry } from "@/features/timeTracking/hooks.js";

interface Props {
   // FIX: was typed as full `Project` object but TimeEntriesList passes entry.projectId (string)
   entry: TimeEntryInList;
   project: string;
}

export const TimeEntryRow: React.FC<Props> = ({ entry, project }) => {
   // FIX: was entry.start_time (snake_case, old schema) — TimeEntryInList has createdAt
   const date = new Date(entry.createdAt);
   const [isEditing, setIsEditing] = useState(false);
   const [desc, setDesc] = useState(entry.description ?? "");
   const inputRef = useRef<HTMLInputElement>(null);

   const updateMutation = useUpdateTimeEntry();

   const close = () => {
      setIsEditing(false);
      updateMutation.mutate({
         id: entry.id,
         data: { description: desc },
      });
   };

   useEffect(() => {
      const handler = (e: MouseEvent) => {
         if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
            close();
         }
      };
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
   }, [desc]);

   return (
      <div className="border text-gray-800 border-gray-200 dark:border-white/20 dark:text-white flex items-center justify-between py-2 px-2 rounded-xl">
         <div className="flex items-center gap-3 flex-1">
            <div className="flex-1">
               {/* FIX: project is now a string ID — display it directly (or swap for name if you pass full object later) */}
               <p className="font-medium text-xl">{project}</p>
               {isEditing ? (
                  <input
                     ref={inputRef}
                     value={desc}
                     onChange={(e) => setDesc(e.target.value)}
                     onKeyDown={(e) => e.key === "Enter" && close()}
                     className={`outline-none bg-white/10 w-50 rounded-sm px-1.5 py-1.5`}
                     autoFocus
                  />
               ) : (
                  <p onDoubleClick={() => setIsEditing(true)} className="text-md">{desc || "No description"}</p>
               )}

               <p className="text-xs">
                  {date.toLocaleDateString()} at{" "}
                  {date.toLocaleTimeString([], {
                     hour: "2-digit",
                     minute: "2-digit",
                  })}
               </p>
            </div>
         </div>
         <div className="flex items-center gap-3">
            {/* FIX: was entry.duration_minutes (snake_case) — now entry.durationMinutes. Also fixed `px-2e` typo → `px-2` */}
            <span className="font-mono text-white px-2">{formatDuration(entry.durationMinutes)}</span>
         </div>
      </div>
   );
};