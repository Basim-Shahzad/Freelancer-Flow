import React from "react";
import { MdAvTimer } from "react-icons/md";
import { useFormatters } from "../../hooks/useFormatters.js";

const ProjectDetailHeader = ({ project }) => {
   const { formatDueDate } = useFormatters();
   console.log(project);

   return (
      <div className="flex flex-col gap-5 px-4 lg:px-8 lg:gap-1">
         <div className="flex gap-0.5 lg:gap-1 items-center justify-between">
            <h1 className="text-2xl font-semibold  lg:text-display-xs">{project?.name}</h1>
            {/* <div className="flex gap-2.5" >
               <button className="cursor-pointer bg-[#7F56D9] py-2 px-3 rounded-lg hover:bg-[#9E77ED]/80 transition-colors duration-150 gap-1 text-sm">Track Time</button>
               <button className="cursor-pointer bg-[#7F56D9] py-2 px-3 rounded-lg hover:bg-[#9E77ED]/80 transition-colors duration-150 gap-1 text-sm">Create Invoice</button>
            </div> */}
            <div className="flex gap-3">
               <button
                  type="button"
                  aria-label="Calendar"
                  className="group relative inline-flex items-center gap-1 rounded-lg px-3.5 py-2.5 text-sm font-semibold text-white/80 ring-1 ring-white/20 ring-inset cursor-pointer">
                  <svg
                     viewBox="0 0 24 24"
                     width="24"
                     height="24"
                     stroke="currentColor"
                     strokeWidth="2"
                     fill="none"
                     strokeLinejoin="round"
                     className="size-5 text-[#85888E]">
                     <path d="M21 10H3m13-8v4M8 2v4m-.2 16h8.4c1.68 0 2.52 0 3.162-.327a3 3 0 0 0 1.311-1.311C21 19.72 21 18.88 21 17.2V8.8c0-1.68 0-2.52-.327-3.162a3 3 0 0 0-1.311-1.311C18.72 4 17.88 4 16.2 4H7.8c-1.68 0-2.52 0-3.162.327a3 3 0 0 0-1.311 1.311C3 6.28 3 7.12 3 8.8v8.4c0 1.68 0 2.52.327 3.162a3 3 0 0 0 1.311 1.311C5.28 22 6.12 22 7.8 22Z" />
                  </svg>

                  <span className="px-0.5">
                     <span className="text-placeholder">Create an Invoice</span>
                  </span>
               </button>

               <button
                  type="button"
                  className="group relative inline-flex items-center gap-1 rounded-lg px-3.5 py-2.5 text-sm font-semibold text-white/80 shadow-xs-skeumorphic ring-1 ring-white/20 ring-inset cursor-pointer">
                  <MdAvTimer className="text-xl text-[#85888E] " />

                  <span className="px-0.5">Track Time</span>
               </button>
            </div>
         </div>
      </div>
   );
};

export default ProjectDetailHeader;
