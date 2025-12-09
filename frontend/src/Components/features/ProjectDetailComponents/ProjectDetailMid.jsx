import React, { useState } from "react";
import { Select, SelectItem } from "@heroui/react";
import { useProject } from "../../../hooks/useProjects";

const ProjectDetailMid = ({ project, onStatusChange }) => {
   const { due_date, time_tracking, price, hourly_rate, client, status, description } = project;
   const statuses = [
      { key: "active", label: "Active" },
      { key: "completed", label: "Completed" },
      { key: "archived", label: "Archived" },
   ];
   const [selectedStatus, setSelectedStatus] = useState(new Set([status]));

   const handleStatusChange = (keys) => {
      const newStatus = Array.from(keys)[0];
      setSelectedStatus(keys);

      // Call parent callback to update backend
      if (onStatusChange) {
         onStatusChange(newStatus);
      }
   };

   const getStatusColor = (statusKey) => {
      const colors = {
         active: "warning", // Yellow
         completed: "success", // Green
         archived: "default", // Gray
      };
      return colors[statusKey] || "default";
   };

   return (
      <div>
         <div>
            
         </div>
         <dl className="flex gap-2 w-max flex-col">
            <div className="flex flex-col items-center gap-2 bg-white/5 px-6 py-4 rounded-xl">
               <dt className="text-[16px] font-medium text-[#94979c]">Client</dt>
               <dd className="flex items-center flex-col">
                  <span className="text-[30px] font-semibold text-[#f7f7f7]">{client?.name}</span>
                  <span className="text-[15px] font-semibold text-[#f7f7f7]/50">{client?.email}</span>
               </dd>
            </div>
            <div className="flex flex-col items-center gap-2 bg-white/5 px-8 py-5 rounded-xl">
               <dt className="text-[16px] font-medium text-[#94979c]">{time_tracking ? "Hourly Rate" : "Price"}</dt>
               <dd className="flex items-start gap-2">
                  <span className="text-[30px] font-semibold text-[#f7f7f7]">
                     ${time_tracking ? hourly_rate : price}
                  </span>
               </dd>
            </div>
            <div className="flex flex-col items-center gap-2 bg-white/5 px-2 py-5 rounded-xl">
               <dt className="text-[16px] font-medium text-[#94979c]">Status</dt>
               <dd className="flex items-start gap-2 w-full">
                  <div className="w-full font-semibold text-[#f7f7f7]">
                     <Select
                        selectedKeys={selectedStatus}
                        onSelectionChange={handleStatusChange}
                        aria-label="Project Status"
                        color={getStatusColor(Array.from(selectedStatus)[0])}
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
