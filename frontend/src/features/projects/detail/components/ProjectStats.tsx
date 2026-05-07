import React from "react";
import type { Project } from "../../types.js";

interface ProjectStatsProps {
   status: Project["status"];
   isHourlyBasis: boolean
   hourlyRate?: string | null;
   fixedRate?: number | null;
   description?: string
}

const ProjectStats: React.FC<ProjectStatsProps> = ({ status, isHourlyBasis, fixedRate, hourlyRate, description }) => {
   const statusConfig = {
      archived: { text: "text-slate-500", dot: "bg-slate-400", bg: "bg-slate-500/20" },
      completed: { text: "text-emerald-500", dot: "bg-emerald-500", bg: "bg-emerald-500/20" },
      active: { text: "text-orange-500", dot: "bg-orange-500", bg: "bg-orange-500/20" },
   };

   const currentStatus = statusConfig[status as keyof typeof statusConfig] || statusConfig.active;

   return (
      <div className="border border-white/20 rounded-2xl px-4 py-4 flex flex-col gap-2" >
         <div className="flex items-center justify-between w-full" >
            <h2 className="text-xl" >Project Status</h2>
            <span
               className={`flex w-max items-center gap-1.5 px-2 py-0.5 rounded-full ${currentStatus.bg} ${currentStatus.text} shrink-0`}>
               <span className={`w-1.5 h-1.5 rounded-full ${currentStatus.dot}`} />
               <span className="font-bold uppercase tracking-tight">{status}</span>
            </span>
         </div>
         <div className="font-bold text-xl" >
            ${isHourlyBasis ? `${hourlyRate}/h` : fixedRate}
         </div>
         {
            description ? (
               <div>
                  <span className="text-xs text-white/65" >Project Description</span>
                  <p>{description}</p>
               </div>
            ) : ''
         }
      </div>
   );
};

export default ProjectStats;
