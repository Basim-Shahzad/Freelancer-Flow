"use client";

import React from "react";
import { FolderGit2, Clock3 } from "lucide-react";
import { ProjectInList, ProjectStatus } from "../project.types";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { queryClient } from "@/app/providers";
import { useProjects } from "../useProjects";
import { cn } from "@/lib/utils";

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

interface StatusConfig {
   label: string;
   dotClassName: string;
   badgeVariant: "outline" | "secondary";
}

const STATUS_MAP: Record<ProjectStatus, StatusConfig> = {
   ARCHIVED: { label: "Archived", dotClassName: "bg-text-muted", badgeVariant: "outline" },
   CANCELLED: { label: "Cancelled", dotClassName: "bg-error", badgeVariant: "outline" },
   COMPLETED: { label: "Completed", dotClassName: "bg-success", badgeVariant: "secondary" },
   DRAFT: { label: "Draft", dotClassName: "bg-text-muted", badgeVariant: "outline" },
   IN_PROGRESS: { label: "In Progress", dotClassName: "bg-warning", badgeVariant: "secondary" },
   IN_REVIEW: { label: "In Review", dotClassName: "bg-warning", badgeVariant: "secondary" },
   INVOICED: { label: "Invoiced", dotClassName: "bg-primary", badgeVariant: "secondary" },
};

function StatusPopover({ project, children }: { project: ProjectInList; children: React.ReactNode }) {
   const { mutate: updateStatus, isPending } = useMutation({
      mutationFn: (status: ProjectStatus) => useProjects.update(project.id, { status }),
      onSuccess: () => {
         queryClient.invalidateQueries({ queryKey: ["projects"] });
      },
   });

   return (
      <Popover>
         <PopoverTrigger onClick={(e) => e.stopPropagation()}>{children}</PopoverTrigger>
         <PopoverContent align="end" className="w-44 p-1" onClick={(e) => e.stopPropagation()}>
            <p className="px-2 py-1 text-xs font-medium text-text-muted select-none">Status</p>
            <div className="flex flex-col gap-0.5">
               {(Object.keys(STATUS_MAP) as ProjectStatus[]).map((key) => {
                  const { label, dotClassName } = STATUS_MAP[key];
                  return (
                     <button
                        key={key}
                        disabled={isPending}
                        onClick={() => updateStatus(key)}
                        className={cn(
                           "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium transition-colors select-none hover:bg-muted disabled:opacity-50",
                           key === project.status && "bg-muted"
                        )}
                     >
                        <span className={cn("size-1.5 shrink-0 rounded-full", dotClassName)} />
                        {label}
                     </button>
                  );
               })}
            </div>
         </PopoverContent>
      </Popover>
   );
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project }) => {
   const router = useRouter();
   const status = STATUS_MAP[project.status];

   return (
      <div
         onClick={() => router.push(`/projects/${project.id}`)}
         className="group cursor-pointer rounded-2xl border border-border bg-background px-3 py-3 transition-all duration-200 hover:border-primary/30 hover:bg-muted/40 select-none"
      >
         <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
               <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <FolderGit2 className="h-4 w-4 text-primary" />
               </div>

               <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold text-text">{project.name}</h2>
                  <p className="truncate text-xs text-text-muted">{project.description ?? "No description"}</p>
               </div>
            </div>

            <div className="flex items-center gap-1">
               <StatusPopover project={project}>
                  <Badge variant={status.badgeVariant} className="cursor-pointer gap-1.5">
                     <span className={cn("size-1.5 rounded-full", status.dotClassName)} />
                     {status.label}
                  </Badge>
               </StatusPopover>

               <Tooltip>
                  <TooltipTrigger
                     render={
                        <button
                           onClick={(e) => e.stopPropagation()}
                           className="rounded-full p-1 text-text-muted hover:bg-muted hover:text-text"
                        />
                     }
                  >
                     <Clock3 className="w-3.5" />
                  </TooltipTrigger>
                  <TooltipContent>Due {formatDate(project.dueDate)}</TooltipContent>
               </Tooltip>
            </div>
         </div>
         <div className="mt-2 flex items-center justify-between">
            <div>
               <p className="text-[10px] text-text-muted/70">{project.budgetType}</p>
               <p className="mt-1 text-xs font-semibold text-text">
                  {project.budget ? `$${project.budget}` : "Not set"}
               </p>
            </div>
         </div>
      </div>
   );
};

export default ProjectCard;
