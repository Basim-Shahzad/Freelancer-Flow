import React from "react";
import { useTimer, useTimerInterval } from "@/features/timeTracking/hooks.js";
import type { Project } from "@/types/models.js";
import { ActiveTimer } from "@/features/timeTracking/components/ActiveTimer.js";
import { ProjectSelector } from "@/features/timeTracking/components/ProjectSelector.js";
import { TimeEntriesList } from "@/features/timeTracking/components/TimeEntriesList.js";
import { TimeTrackingHeader } from "@/features/timeTracking/components/TimeTrackingHeader.js";
import { useProjects } from "@/features/projects/hooks.js";
import MobileHeader from "@/layout/MobileHeader.jsx";

export const TimeTrackingPage: React.FC = () => {
   useTimerInterval(); // Initialize timer interval

   const { state } = useTimer();
   const { data: projects } = useProjects();

   const activeProject = state.active_project_id
      ? projects.items.find((p: Project) => p.id === state.active_project_id)
      : null;

   return (
      <div className="w-full flex flex-col lg:flex-row bg-white text-black dark:bg-[#000000] dark:text-white transition-colors duration-300">
         <header>
            <MobileHeader />
         </header>

         <div className="invisible pl-74 hidden lg:sticky lg:top-0 lg:bottom-0 lg:left-0 lg:block"></div>

         <main className="w-full h-max">
            <div className="flex items-center gap-3 mb-8">
               <TimeTrackingHeader />
            </div>

            <section className="grid grid-cols-5 px-2 lg:px-6">
               <div className="col-start-1 col-end-3">
                  {activeProject ? <ActiveTimer project={activeProject} /> : <ProjectSelector projects={projects.items} />}
               </div>

               <div className="col-start-4 col-end-6 max-h-full">
                  <TimeEntriesList />
               </div>
            </section>
         </main>
      </div>
   );
};