import React from "react";
import { useNavigate } from "react-router-dom";

type Project = {
   project: {
      id: string;
      clientId: string;
      name: string;
      status: "active" | "completed" | "archived";
      createdAt: string;
   };
};

const statusConfig = {
   active: {
      label: "Active",
      dot: "bg-emerald-400",
      badge: "bg-emerald-400/10 text-emerald-400 ring-emerald-400/20",
   },
   completed: {
      label: "Completed",
      dot: "bg-blue-400",
      badge: "bg-blue-400/10 text-blue-400 ring-blue-400/20",
   },
   archived: {
      label: "Archived",
      dot: "bg-zinc-500",
      badge: "bg-zinc-500/10 text-zinc-400 ring-zinc-500/20",
   },
};

const formatDate = (dateStr: string) => {
   const date = new Date(dateStr);
   return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const FolderIcon = () => (
   <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      stroke="currentColor"
      strokeWidth="1.75"
      fill="none"
      strokeLinejoin="round"
      aria-hidden="true">
      <path d="M2 9V6.5C2 5.12 3.12 4 4.5 4H9.08C9.65 4 10.19 4.25 10.56 4.68L11.69 6H19.5C20.88 6 22 7.12 22 8.5V17.5C22 18.88 20.88 20 19.5 20H4.5C3.12 20 2 18.88 2 17.5V9Z" />
   </svg>
);

const CalendarIcon = () => (
   <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" strokeWidth="2" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
   </svg>
);

const ArrowIcon = () => (
   <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" aria-hidden="true">
      <path d="M7 17 17 7m0 0H7m10 0v10" />
   </svg>
);

const DashboardProjectCard: React.FC<Project> = ({ project }) => {
   const status = statusConfig[project.status] ?? statusConfig.active;

   const navigate = useNavigate();

   return (
      <div
         className="group relative flex w-72 flex-col gap-4 rounded-xl p-5 ring-1 ring-white/10 ring-inset
                    bg-white/[0.03] hover:bg-purple-500/[0.06] transition-all duration-200 cursor-pointer
                    hover:ring-white/20 hover:shadow-lg"
         style={{ backdropFilter: "blur(4px)" }}
         onClick={() => navigate(`/projects/${project.id}`)}>
         {/* Top row: icon + status badge */}
         <div className="flex items-start justify-between">
            <div
               className="flex items-center justify-center size-10 rounded-lg ring-1 ring-white/10
                          bg-white/5 text-[#94979c] group-hover:text-[#cecfd2] transition-colors duration-200">
               <FolderIcon />
            </div>

            <span
               className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${status.badge}`}>
               <span className={`size-1.5 rounded-full ${status.dot}`} />
               {status.label}
            </span>
         </div>

         {/* Name */}
         <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold text-[#cecfd2] leading-snug group-hover:text-white transition-colors duration-200 line-clamp-1">
               {project.name}
            </h3>
         </div>

         {/* Footer */}
         <div className="flex items-center justify-between border-t border-white/[0.06] pt-3 mt-0.5">
            <div className="flex items-center gap-1.5 text-[#5c5f63]">
               <CalendarIcon />
               <span className="text-xs">{formatDate(project.createdAt)}</span>
            </div>

            <button
               className="flex items-center gap-1 text-xs text-[#5c5f63] hover:text-[#cecfd2]
                          transition-colors duration-150 rounded outline-none focus-visible:ring-1 focus-visible:ring-white/30">
               View
               <ArrowIcon />
            </button>
         </div>
      </div>
   );
};

export default DashboardProjectCard;
