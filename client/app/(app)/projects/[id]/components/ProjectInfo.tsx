"use client";

import React, { useState } from "react";
import type { Project } from "../../project.types";
import { ClickableChip } from "@/components/chip";
import ProfilePictureFromName from "@/components/ProfilePictureFromName";
import { formatToMonthDay } from "../../helper";
import { correctCapitalization } from "@/lib/stringsFormatter";
import { Calendar, Ellipsis } from "lucide-react";
import { StatusModal, LogoStatusMap } from "./PropertyModals/StatusModal";

type ProjectInfoProps = {
   project: Project;
};

const ProjectInfo: React.FC<ProjectInfoProps> = ({ project }) => {
   const [isStatusModal, setIsStatusModal] = useState<boolean>(false);
   const isHourly: boolean = project?.budgetType === "HOURLY";

   return (
      <section className="px-16 py-8">
         <h1 className="my-4 text-3xl font-semibold text-text">{project?.name}</h1>
         <div className="flex flex-wrap items-center gap-0.5">
            <h2 className="mr-4 text-[13px] text-text-muted select-none">Properties</h2>

            <StatusModal project={project} open={isStatusModal} setOpen={setIsStatusModal}>
               <ClickableChip
                  startContent={LogoStatusMap[project?.status]}
                  label={correctCapitalization(project?.status ?? "")}
                  onClick={() => setIsStatusModal((s) => !s)}
               />
            </StatusModal>

            <ClickableChip label={isHourly ? `$${project?.budget}/h` : `$${project?.budget}`} />

            <ClickableChip
               startContent={<Calendar className="w-4 h-4" />}
               label={formatToMonthDay(project?.dueDate) ?? "-"}
            />

            <ClickableChip
               startContent={<ProfilePictureFromName name={project?.client?.name} scale={0.45} />}
               label={project?.client?.name}
            />

            <ClickableChip startContent={<Ellipsis className="w-4 h-4" />} />
         </div>
      </section>
   );
};

export default ProjectInfo;
