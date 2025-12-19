import React from "react";
import { Play, Pause, Square } from "lucide-react";
import type { Project } from "@/types/models.js";
import { formatTime } from "@/utils/time.utils.js";
import { useTimer } from "@/Contexts/TimerContext.js";

interface Props {
   project: Project;
}

export const ActiveTimer: React.FC<Props> = ({ project }) => {
   const { state, pauseTimer, resumeTimer, stopTimer, updateDescription } = useTimer();

   return (
      <div className="rounded-lg shadow-lg py-4 px-3 border dark:border-white/20 border-black/20">
         <div className="flex items-center justify-between mb-4">
            <div className="flex items-center justify-center gap-3">
               <div className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: "#10b981" }} />
               <div>
                  <h3 className="font-semibold text-2xl">{project.name}</h3>
                  <p className="text-sm text-gray-500">{project.client.name}</p>
               </div>
            </div>
         </div>

         <div className="text-3xl lg:text-5xl flex justify-center py-6 font-mono font-bold text-black dark:text-white">
            {formatTime(state.elapsed_ms)}
         </div>

         <input
            type="text"
            placeholder="What are you working on?"
            value={state.description}
            onChange={(e) => updateDescription(e.target.value)}
            title="Used in invoices"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
         />

         <div className="flex gap-2">
            {state.status === "running" ? (
               <button
                  onClick={pauseTimer}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition">
                  <Pause size={20} />
                  Pause
               </button>
            ) : (
               <button
                  onClick={resumeTimer}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition">
                  <Play size={20} />
                  Resume
               </button>
            )}
            <button
               onClick={stopTimer}
               className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition">
               <Square size={20} />
               Stop
            </button>
         </div>
      </div>
   );
};
