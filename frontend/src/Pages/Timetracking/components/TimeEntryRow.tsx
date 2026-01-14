import { useState, useRef, useEffect } from "react";
import type { Project, TimeEntry } from "@/types/models.js";
import { formatDuration } from "@/utils/time.utils.js";
import { useUpdateTimeEntryDesc } from "@/hooks/useTimeTracking.js";

interface Props {
   entry: TimeEntry;
   project: Project;
}

export const TimeEntryRow: React.FC<Props> = ({ entry, project }) => {
   const date = new Date(entry.start_time);
   const [isEditing, setIsEditing] = useState(false);
   const [desc, setDesc] = useState(entry.description ?? "");
   const inputRef = useRef<HTMLInputElement>(null);

   const updateDesc = useUpdateTimeEntryDesc();

   const close = () => {
      setIsEditing(false);
      updateDesc.mutate({
         id: entry.id,
         description: desc,
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
   }, []);

   return (
      <div className="border text-gray-800 border-gray-200 dark:border-white/20 dark:text-white flex items-center justify-between py-2 px-2 rounded-xl">
         <div className="flex items-center gap-3 flex-1">
            <div className="flex-1">
               <p className="font-medium text-xl">{project.name}</p>
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
            <span className="font-mono text-white px-2e">{formatDuration(entry.duration_minutes)}</span>
         </div>
      </div>
   );
};