import React from "react";
import { Clock } from "lucide-react";
import { useTimer } from "@/Contexts/TimerContext.js";
import { ActiveTimer } from "./components/ActiveTimer.js";
import { ProjectSelector } from "./components/ProjectSelector.js";
import { TimeEntriesList } from "./components/TimeEntriesList.js";
import type { Project } from "@/types/models.js";
import { useProjects } from "@/hooks/useProjects.js";
import TimeTrackingHeader from "./TimeTrackingHeader.js";
import MobileHeader from "@/layout/MobileHeader.jsx";

export const TimeTrackingPage: React.FC = () => {
   const { state } = useTimer();

   const { projects } = useProjects();

   const activeProject = state.active_project_id
      ? projects.find((p: Project) => p.id === state.active_project_id)
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
               <div className="col-start-1 col-end-3" >
                  {activeProject ? <ActiveTimer project={activeProject} /> : <ProjectSelector projects={projects} />}
               </div>

               <div className="col-start-4 col-end-6 max-h-full" >
                  <TimeEntriesList />
               </div>
            </section>
         </main>
      </div>
   );
};
