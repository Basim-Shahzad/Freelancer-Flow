import React from "react";
import ClientSelector from "./ClientSelector.js";
import ProjectSelector from "./ProjectSelector.js";
import InvoiceTimeline from "./InvoiceTimeline.js";
import { useClients } from "@/features/clients/hooks.js";
import { useProjects } from "@/features/projects/hooks.js";
import { Skeleton } from "@heroui/react";

const InvoiceMetadataCard = () => {
   const { data: clientsData, isLoading: clientsLoading, error: clientsError } = useClients(false);
   const { data: projectsData, isLoading: projectsLoading, error: projectsError } = useProjects(false);

   return (
      <div className="w-full h-full">
         <div className="flex justify-between mb-4">
            <div className="flex gap-2 text-4xl items-center">
               Invoice
               <span className="flex items-center" >
                  #
               </span>
            </div>
            <h1 className="text-4xl text-yellow-500 font-bold">DRAFT</h1>
         </div>

         <div className="grid grid-cols-3">
            <div className="flex items-center justify-center px-1 py-1 bordere border-white/10">
               <ClientSelector clientsData={clientsData} clientsError={clientsError} clientsLoading={clientsLoading} />
            </div>

            <div className="flex items-center justify-center px-1 py-1 bordere border-white/10">
               <ProjectSelector
                  projectsData={projectsData}
                  projectsError={projectsError}
                  projectsLoading={projectsLoading}
               />
            </div>

            <div className="flex items-center justify-center px-1 py-1 bordere border-white/10">
               <InvoiceTimeline />
            </div>
         </div>
      </div>
   );
};

export default InvoiceMetadataCard;
