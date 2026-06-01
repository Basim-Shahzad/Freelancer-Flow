"use client";

import React from "react";
import { FolderGit2, Clock3, CircleCheck } from "lucide-react";
import { ProjectInList, ProjectStatus } from "../project.types";
import { Popover, Chip } from "@heroui/react";
import { PopoverTrigger, PopoverContent, ListBox, ListBoxItem, Header, Tooltip } from "@heroui/react";

type ProjectCardProps = {
   project: ProjectInList;
};

const formatDate = (date: string) => {
   return new Date(date).toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
   });
};

interface StatusPopoverProps {
   children: React.ReactNode;
}

interface StatusConfig {
   label: string;
   color: string;
}

// @ts-ignore
const STATUS_COLOR_MAP: Record<ProjectStatus, "success" | "accent" | "default"> = {
   ARCHIVED: "default",
   CANCELLED: "default",
   COMPLETED: "success",
   DRAFT: "default",
   IN_PROGRESS: "accent",
   IN_REVIEW: "accent",
};

// @ts-ignore
const STATUS_MAP: Record<ProjectStatus, StatusConfig> = {
   ARCHIVED: { label: "Archived", color: "default" },
   CANCELLED: { label: "Cancelled", color: "default" },
   COMPLETED: { label: "Completed", color: "success" },
   DRAFT: { label: "Draft", color: "default" },
   IN_PROGRESS: { label: "In Progress", color: "accent" },
   IN_REVIEW: { label: "In Review", color: "accent" },
};

function StatusPopover({ children }: StatusPopoverProps) {
   return (
      <Popover>
         <PopoverTrigger>{children}</PopoverTrigger>
         <PopoverContent
            placement="right top"
            offset={10}
            className="p-1 min-w-[160px] bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl"
         >
            <ListBox aria-label="Select status" variant="default" className="p-0">
               <Header className="text-[12px]">Status</Header>
               {(Object.keys(STATUS_MAP) as ProjectStatus[]).map((key) => {
                  const { label, color } = STATUS_MAP[key];
                  return (
                     <ListBoxItem
                        key={key}
                        id={key}
                        textValue={label}
                        className="gap-3 px-2 py-0 rounded-lg data-[hover=true]:bg-zinc-900 transition-colors cursor-pointer"
                     >
                        <div className="flex items-center gap-3 w-full">
                           <span
                              className={`w-2 h-2 rounded-full shrink-0 ${color} shadow-[0_0_8px_rgba(255,255,255,0.15)]`}
                           />
                           <span className="text-zinc-200 text-[12px] font-medium">{label}</span>
                        </div>
                     </ListBoxItem>
                  );
               })}
            </ListBox>
         </PopoverContent>
      </Popover>
   );
}

function DueDateToolTip({ children, dueDate: string }: { children: React.ReactNode; dueDate: string }) {
   return (
      <Tooltip>
         <Tooltip.Trigger>{children}</Tooltip.Trigger>
         <Tooltip.Content>Due Date: {formatDate(string)}</Tooltip.Content>
      </Tooltip>
   );
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project }) => {
   return (
      <div className="group select-none rounded-2xl border border-white/5 bg-[#171717] px-3 py-3 transition-all duration-200 hover:border-white/10 hover:bg-[#1b1b1c]">
         <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
               <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/10">
                  <FolderGit2 className="h-4 w-4 text-purple-400" />
               </div>

               <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold text-white">{project.name}</h2>

                  <p className=" text-xs text-white/50">{project.description ?? "No description"}</p>
               </div>
            </div>

            <div className="flex items-center">
               <StatusPopover>
                  <Chip className="text-xs px-[8px] py-0" color={STATUS_COLOR_MAP[project.status]}>
                     <CircleCheck width={12} />
                     <Chip.Label className="text-[10px] ">{project.status}</Chip.Label>
                  </Chip>
               </StatusPopover>
               <div>
                  <DueDateToolTip dueDate={project.dueDate}>
                     <Clock3 className="w-8 hover:bg-white/5 p-1 rounded-full text-white/50 hover:text-white" />
                  </DueDateToolTip>
               </div>
            </div>
         </div>
         <div className="mt-2 flex items-center justify-between">
            <div>
               <p className="text-[10px] text-white/40">{project.budgetType}</p>

               <p className="mt-1 text-xs font-semibold text-white">
                  {project.budget ? `$${project.budget}` : "Not set"}
               </p>
            </div>
         </div>
      </div>
   );
};

export default ProjectCard;
