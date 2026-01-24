import type { Project } from "@/types/models.js";
import { CiCalendar, CiClock2 } from "react-icons/ci";
import { BsCurrencyDollar } from "react-icons/bs";
import { useNavigate } from "react-router-dom";
import { useFormatters } from "@/hooks/useFormatters.js";

type Props = {
   project: Project;
};

const ProjectCard = ({ project }: Props) => {
   const { name, client, hourly_rate, id, due_date, status, time_tracking, description, total_time } = project;
   const navigate = useNavigate();
   const { formatDueDate } = useFormatters();

   const clientData = typeof client === 'object' ? client : null;
   const clientName = clientData?.name || 'Unknown Client';

   const statusConfig = {
      archived: { text: "text-slate-500", dot: "bg-slate-400", bg: "bg-slate-500/5" },
      completed: { text: "text-emerald-500", dot: "bg-emerald-500", bg: "bg-emerald-500/5" },
      active: { text: "text-orange-500", dot: "bg-orange-500", bg: "bg-orange-500/5" }
   };

   const currentStatus = statusConfig[status as keyof typeof statusConfig] || statusConfig.active;

   return (
      <div
         className="group relative flex flex-col bg-white dark:bg-[#0f1117] border border-gray-100 dark:border-white/5 rounded-xl transition-all duration-300 hover:border-indigo-500/30 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)] cursor-pointer"
         onClick={() => navigate(`/projects/${id}`)}>
         
         <div className="p-4 space-y-3">
            {/* Header: Title and Status */}
            <div className="flex justify-between items-start gap-2">
               <h3 className="text-md font-bold text-gray-900 dark:text-white truncate group-hover:text-indigo-500 transition-colors">
                  {name}
               </h3>
               <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full ${currentStatus.bg} ${currentStatus.text} shrink-0`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${currentStatus.dot}`} />
                  <span className="text-[10px] font-bold uppercase tracking-tight">{status}</span>
               </div>
            </div>

            {/* Description: Short & Balanced */}
            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 h-8 leading-normal">
               {description || "No project description available."}
            </p>

            {/* Metrics Row: Symmetrical regardless of data existence */}
            <div className="flex items-center justify-between py-2.5 px-3 bg-gray-50 dark:bg-white/[0.03] rounded-lg border border-gray-100/50 dark:border-white/5">
               <div className="flex items-center gap-1">
                  <BsCurrencyDollar className="text-indigo-500 text-xs" />
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                     {hourly_rate ? `${hourly_rate}/hr` : "Fixed"}
                  </span>
               </div>
               <div className="w-[1px] h-3 bg-gray-200 dark:bg-white/10" />
               <div className="flex items-center gap-1">
                  <CiClock2 className="text-indigo-500 text-sm" />
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                     {total_time ? `${total_time}h` : "0h"}
                  </span>
               </div>
               <div className="w-[1px] h-3 bg-gray-200 dark:bg-white/10" />
               <div className="flex items-center gap-1">
                  <CiCalendar className="text-indigo-500 text-sm" />
                  <span className="text-[11px] font-medium text-gray-600 dark:text-gray-400">
                     {formatDueDate(due_date)}
                  </span>
               </div>
            </div>

            {/* Footer: Client Info */}
            <div className="flex items-center justify-between pt-1">
               <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-900 flex items-center justify-center text-white text-[10px] font-black shadow-sm">
                     {clientName.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 truncate max-w-[100px]">
                     {clientName}
                  </span>
               </div>
               
               <span className="text-[10px] font-bold text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  VIEW DETAILS →
               </span>
            </div>
         </div>
      </div>
   );
};

export default ProjectCard;