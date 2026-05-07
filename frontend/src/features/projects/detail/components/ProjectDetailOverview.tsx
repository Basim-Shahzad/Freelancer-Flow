import React, { useState, useEffect, useMemo } from "react";
import { Select, SelectItem } from "@heroui/react";
import { useUpdateProject } from "@/features/projects/hooks.js";
import type { Project } from "@/features/projects/types.js";
import { minutesToHoursString } from "@/utils/formatters.js";
import ProjectTimeEntryList from "./ProjectTimeEntryList.js";
import { useTimeEntries } from "@/features/timeTracking/hooks.js";
import ProjectClient from "./ProjectClient.js";
import ProjectStats from "./ProjectStats.js";
import ProjectTimeSpent from "./ProjectTimeSpent.js";
import ProjectTimeTracker from "./ProjectTimeTracker.js";

interface ProjectDetailOverviewProps {
   project: Project;
   isLoading: boolean;
}

const ProjectDetailOverview: React.FC<ProjectDetailOverviewProps> = ({ project, isLoading }) => {
   const {
      id,
      status: initialStatus,
      client,
      created_at,
      dueDate,
      isHourlyBasis,
      name,
      pricingType,
      totalTimeSpent,
      description,
      fixedRate,
      hourlyRate,
   } = project;

   const { mutate: updateProject, isPending } = useUpdateProject();
   const { data: timeEntriesData, isLoading: isTimeEntriesLoading, isError: isTimeEntryError } = useTimeEntries(false);

   const projectTimeEntries = useMemo(
      () => timeEntriesData?.timeEntries.filter((te) => te.projectId === id),
      [timeEntriesData],
   );

   // Local status to reflect immediately in the select
   const [status, setStatus] = useState<Project["status"]>(initialStatus);

   useEffect(() => {
      setStatus(initialStatus);
   }, [initialStatus]);

   const statuses = [
      { key: "active", label: "Active" },
      { key: "completed", label: "Completed" },
      { key: "archived", label: "Archived" },
   ] as const;

   const handleStatusChange = (keys: Set<React.Key>) => {
      const newStatus = Array.from(keys)[0] as Project["status"];
      setStatus(newStatus);

      updateProject({
         id,
         data: { status: newStatus },
      });
   };

   return (
      <main className="flex w-full">
         <section className="w-1/2">
            <article>
               <ProjectClient key={id} client={client} />
            </article>

            <article>
               <ProjectStats
                  key={id}
                  status={status}
                  isHourlyBasis={isHourlyBasis}
                  fixedRate={fixedRate}
                  hourlyRate={hourlyRate}
                  description={description}
               />
            </article>

            <article>
               <ProjectTimeSpent key={id} dueDate={dueDate} totalTimeSpent={totalTimeSpent} />
            </article>
         </section>

         {/* <dl className="flex gap-2 w-max flex-col">
            <div className="flex flex-col items-center gap-2 bg-white/5 px-6 py-4 rounded-xl">
               <dt className="text-[16px] font-medium text-[#94979c]">Client</dt>
               <dd className="flex items-center flex-col">
                  <span className="text-[30px] font-semibold text-[#f7f7f7]">{client?.name}</span>
                  <span className="text-[15px] font-semibold text-[#f7f7f7]/50">{client?.email}</span>
               </dd>
            </div>
            <div className="flex flex-col items-center gap-2 bg-white/5 px-8 py-5 rounded-xl">
               <dt className="text-[16px] font-medium text-[#94979c]">
                  {isHourlyBasis ? "Hourly Rate" : "Fixed Price"}
               </dt>
               <dd className="flex items-start gap-2">
                  <span className="text-[30px] font-semibold text-[#f7f7f7]">
                     ${isHourlyBasis ? `${hourlyRate}/h` : fixedRate}
                  </span>
               </dd>
            </div>
            <div className="flex flex-col items-center gap-2 bg-white/5 px-2 py-5 rounded-xl">
               <dt className="text-[16px] font-medium text-[#94979c]">Status</dt>
               <dd className="flex items-start gap-2 w-full">
                  <div className="w-full font-semibold text-[#f7f7f7]">
                     <Select
                        selectedKeys={new Set([status])}
                        onSelectionChange={handleStatusChange}
                        isDisabled={isPending}
                        isRequired={true}
                        aria-label="Project Status"
                        color={getStatusColor(status)}
                        variant="flat">
                        {statuses.map((stat) => (
                           <SelectItem key={stat.key} value={stat.key}>
                              {stat.label}
                           </SelectItem>
                        ))}
                     </Select>
                  </div>
               </dd>
            </div>
            <div className="flex flex-col items-center gap-2 bg-white/5 px-6 py-4 rounded-xl">
               <dt className="text-[16px] font-medium text-[#94979c]">Time Spent</dt>
               <dd className="flex items-start gap-2">
                  <span className="text-[30px] font-semibold text-[#f7f7f7]">
                     {totalTimeSpent ? `${minutesToHoursString(totalTimeSpent)}` : "0h"}
                  </span>
               </dd>
            </div>
         </dl> */}

         <div className="border-r border-white/20 mx-4"></div>

         <section className="w-1/2">
            <article>
               <ProjectTimeTracker />
            </article>
            <article>
               <ProjectTimeEntryList
                  timeEntries={projectTimeEntries}
                  isTimeEntryError={isTimeEntryError}
                  isTimeEntriesLoading={isTimeEntriesLoading}
               />
            </article>
         </section>
      </main>
   );
};

export default ProjectDetailOverview;
