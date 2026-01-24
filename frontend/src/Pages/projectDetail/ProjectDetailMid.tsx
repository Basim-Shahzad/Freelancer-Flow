import React, { useState, useEffect } from "react";
import { Select, SelectItem } from "@heroui/react";
import { useUpdateProject } from "@/features/projects/hooks.js";
import type { Project } from "@/features/projects/types.js";

interface ProjectDetailMidProps {
   project: Project;
}

const ProjectDetailMid: React.FC<ProjectDetailMidProps> = ({ project }) => {
   const { id, status: initialStatus, client, hourly_rate, time_tracking } = project;
   const { mutate: updateProjectStatus, isPending } = useUpdateProject();

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
      setStatus(newStatus); // update UI immediately

      updateProjectStatus({
         id,
         data: { status: newStatus },
      });
   };

   const getStatusColor = (statusKey: Project["status"]) => {
      const colors = {
         active: "warning",
         completed: "success",
         archived: "default",
      } as const;
      return colors[statusKey] ?? "default";
   };

   return (
      <div>
         <div></div>
         <dl className="flex gap-2 w-max flex-col">
            <div className="flex flex-col items-center gap-2 bg-white/5 px-6 py-4 rounded-xl">
               <dt className="text-[16px] font-medium text-[#94979c]">Client</dt>
               <dd className="flex items-center flex-col">
                  <span className="text-[30px] font-semibold text-[#f7f7f7]">{client?.name}</span>
                  <span className="text-[15px] font-semibold text-[#f7f7f7]/50">{client?.email}</span>
               </dd>
            </div>
            <div className="flex flex-col items-center gap-2 bg-white/5 px-8 py-5 rounded-xl">
               <dt className="text-[16px] font-medium text-[#94979c]">{time_tracking ? "Hourly Rate" : ""}</dt>
               <dd className="flex items-start gap-2">
                  <span className="text-[30px] font-semibold text-[#f7f7f7]">${time_tracking ? hourly_rate : ""}</span>
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
                  <span className="text-[30px] font-semibold text-[#f7f7f7]">10h</span>
               </dd>
            </div>
         </dl>
      </div>
   );
};

export default ProjectDetailMid;
