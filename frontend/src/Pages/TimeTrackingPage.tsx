import React from "react";
import { ActiveTimer } from "@/features/timeTracking/components/ActiveTimer.js";
import { ProjectSelector } from "@/features/timeTracking/components/ProjectSelector.js";
import { TimeEntriesList } from "@/features/timeTracking/components/TimeEntriesList.js";
import { TimeTrackingHeader } from "@/features/timeTracking/components/TimeTrackingHeader.js";
import { useProjects } from "@/features/projects/hooks.js";
import MobileHeader from "@/layout/MobileHeader.jsx";
import { useTimerStore } from "@/features/timeTracking/store.js";
import type { ProjectInList } from "@/features/projects/types.js";

export const TimeTrackingPage: React.FC = () => {
   const { data: projectsData } = useProjects(true);

   const selectedProjectId = useTimerStore((s) => s.selectedProjectId);
   const status = useTimerStore((s) => s.status);

   const selectedProject = selectedProjectId
      ? projectsData?.results.projects.find((p: ProjectInList) => p.id == selectedProjectId)
      : null;

   // BUG WAS HERE: condition was `selectedProject ? <ActiveTimer> : <ProjectSelector>`
   // Selecting a project sets selectedProjectId immediately → selectedProject becomes truthy
   // → ActiveTimer mounted before user clicked Start. Timer auto-started visually on dropdown pick.
   // Fix: gate on status. Only show ActiveTimer if timer is actually running or paused.
   const timerIsActive = status === "running" || status === "paused";

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
                  {timerIsActive && selectedProject ? (
                     <ActiveTimer project={selectedProject} />
                  ) : (
                     <ProjectSelector projects={projectsData?.results.projects} />
                  )}
               </div>

               <div className="col-start-4 col-end-6 max-h-full">
                  <TimeEntriesList />
               </div>
            </section>
         </main>
      </div>
   );
};