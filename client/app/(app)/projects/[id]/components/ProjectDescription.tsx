"use client";

import React, { useMemo, useState } from "react";
import { Project } from "../../project.types";
import { useProjects } from "../../useProjects";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/app/providers";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";

type ProjectDescriptionProps = {
   project: Project;
};

function debounce(fn: (...args: any) => void, delay: number) {
   let timeoutId: NodeJS.Timeout;

   const debouncedFn = function (...args: any[]) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
   };

   debouncedFn.cancel = () => {
      clearTimeout(timeoutId);
   };

   return debouncedFn;
}

const ProjectDescription: React.FC<ProjectDescriptionProps> = ({ project }) => {
   const [description, setDescription] = useState<string>(project?.description ?? "");

   const { mutate: updateProject, isPending } = useMutation({
      mutationFn: (newDesc: string) => useProjects.update(project.id, { description: newDesc }),
      onSuccess: () => {
         queryClient.invalidateQueries({ queryKey: ["project", project.id] });
      },
   });

   const debouncedUpdate = useMemo(() => debounce((value: string) => updateProject(value), 1000), [updateProject]);

   const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setDescription(value);
      debouncedUpdate(value);
   };

   return (
      <section className="flex flex-col gap-2 py-6">
         <h1 className="flex items-center gap-2 text-[13px] text-text-muted select-none">
            Description
            {isPending && <Spinner className="size-3" />}
         </h1>
         <Textarea
            rows={10}
            className="max-h-40 w-full resize-none border-none px-0 text-[14px] text-text shadow-none focus-visible:ring-0"
            placeholder="Add description..."
            onChange={handleChange}
            value={description}
         />
      </section>
   );
};

export default ProjectDescription;
