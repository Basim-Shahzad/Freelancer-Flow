"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useTimeEntries } from "../../useTimeEntries";
import { Project } from "../../project.types";
import { Skeleton } from "@/components/ui/skeleton";

type ProjectActivityProps = {
   project: Project;
};

const ProjectActivity: React.FC<ProjectActivityProps> = ({ project }) => {
   const { data: res, isLoading } = useQuery({
      queryKey: ["timeEntries", project?.id],
      queryFn: () => useTimeEntries.getAll(project?.id),
   });

   return (
      <section className="flex flex-col gap-2 py-6">
         <h1 className="text-[13px] text-text-muted select-none">Activity</h1>

         {isLoading ? (
            <div className="flex flex-col gap-2">
               <Skeleton className="h-5 w-full" />
               <Skeleton className="h-5 w-3/4" />
            </div>
         ) : res?.data?.timeEntries?.length ? (
            <ol className="flex flex-col gap-1.5">
               {res.data.timeEntries.map((timeEntry) => (
                  <li key={timeEntry.id} className="text-sm text-text">
                     {timeEntry.description}
                  </li>
               ))}
            </ol>
         ) : (
            <p className="text-sm text-text-muted/70 italic">No activity yet.</p>
         )}
      </section>
   );
};

export default ProjectActivity;
