import React, { useEffect } from "react";
import MobileHeader from "../../layout/MobileHeader.jsx";
import ProjectDetailHeader from "./ProjectDetailHeader.jsx";
import { useParams, useNavigate } from "react-router-dom";
import ProjectDetailMid from "./ProjectDetailMid.jsx";
import { useProject } from "@/features/projects/hooks.js";

const ProjectDetail = () => {
   const { id } = useParams();
   if (!id) return null;

   const { data :project, error, isLoading : projectDetailLoading } = useProject(Number(id));

   if (projectDetailLoading) {
      return (
         <div className="flex flex-col lg:flex-row bg-white text-black dark:bg-[#000000] dark:text-white transition-colors duration-300">
            <header>
               <MobileHeader />
            </header>
            <div className="invisible pl-[296px] hidden lg:sticky lg:top-0 lg:bottom-0 lg:left-0 lg:block"></div>
            <main className="min-w-0 flex-1 pt-8 pb-12">
               <div className="flex items-center justify-center h-64">
                  <div className="text-white/70">Loading project...</div>
               </div>
            </main>
         </div>
      );
   }

   if (error) {
      return (
         <div className="flex flex-col lg:flex-row bg-white text-black dark:bg-[#000000] dark:text-white transition-colors duration-300">
            <header>
               <MobileHeader />
            </header>
            <div className="invisible pl-[296px] hidden lg:sticky lg:top-0 lg:bottom-0 lg:left-0 lg:block"></div>
            <main className="min-w-0 flex-1 pt-8 pb-12">
               <div className="flex items-center justify-center h-64">
                  <div className="text-red-400">Error loading project: {error.message}</div>
               </div>
            </main>
         </div>
      );
   }

   return (
      <div className="flex flex-col lg:flex-row bg-white text-black dark:bg-[#000000] dark:text-white transition-colors duration-300"> 
         <header>
            <MobileHeader />
         </header>

         <div className="invisible pl-[296px] hidden lg:sticky lg:top-0 lg:bottom-0 lg:left-0 lg:block"></div>

         <main className="min-w-0 flex-1 pt-8 pb-12">
            <div className="flex flex-col gap-8">
               <ProjectDetailHeader project={project!} />

               <div className="flex flex-col gap-6 px-4 lg:px-8">
                  <ProjectDetailMid project={project!} />  
               </div>
            </div>
         </main>
      </div>
   );
};

export default ProjectDetail;
