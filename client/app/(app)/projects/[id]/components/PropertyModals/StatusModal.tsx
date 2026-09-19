"use client";

import React from "react";
import { Project, ProjectStatus, projectStatuses } from "../../../project.types";
import { CircleCheck, Archive, Ban, ScrollText, CircleDotDashed, LoaderCircle, UserStar } from "lucide-react";
import { useProjects } from "../../../useProjects";
import { queryClient } from "@/app/providers";
import { useMutation } from "@tanstack/react-query";
import { correctCapitalization } from "@/lib/stringsFormatter";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export const LogoStatusMap: { [key in ProjectStatus]: React.ReactNode } = {
   ARCHIVED: <Archive className="w-3 h-3" />,
   CANCELLED: <Ban className="w-3 h-3" />,
   COMPLETED: <CircleCheck className="text-success w-3 h-3" />,
   INVOICED: <ScrollText className="text-primary w-3 h-3" />,
   DRAFT: <CircleDotDashed className="w-3 h-3" />,
   IN_PROGRESS: <LoaderCircle className="text-warning w-3 h-3" />,
   IN_REVIEW: <UserStar className="text-warning w-3 h-3" />,
};

export const StatusModal = ({
   project,
   open,
   setOpen,
   children,
}: {
   project: Project;
   open: boolean;
   setOpen: (open: boolean) => void;
   children: React.ReactNode;
}) => {
   const { mutate: updateStatus, isPending } = useMutation({
      mutationFn: (status: ProjectStatus) => useProjects.update(project?.id, { status }),
      onSuccess: () => {
         queryClient.invalidateQueries({ queryKey: ["project", project?.id] });
         setOpen(false);
      },
   });

   const filteredStatuses = projectStatuses.filter((status) => status !== project?.status);

   return (
      <Popover open={open} onOpenChange={setOpen}>
         <PopoverTrigger>{children}</PopoverTrigger>
         <PopoverContent align="start" className="w-48 p-1">
            <div className="flex flex-col gap-0.5">
               {filteredStatuses.map((status) => (
                  <button
                     key={status}
                     disabled={isPending}
                     onClick={() => updateStatus(status)}
                     className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] font-medium text-text transition-colors select-none hover:bg-muted disabled:opacity-50"
                     )}
                  >
                     {LogoStatusMap[status]}
                     {correctCapitalization(status)}
                  </button>
               ))}
            </div>
         </PopoverContent>
      </Popover>
   );
};
