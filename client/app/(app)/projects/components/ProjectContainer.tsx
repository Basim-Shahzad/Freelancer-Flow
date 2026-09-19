import React from "react";
import { Ellipsis, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
   title: string;
   count: number;
   children: React.ReactNode;
};

const ProjectContainer: React.FC<Props> = ({ title, count, children }) => {
   return (
      <div className="h-full w-90 shrink-0 rounded-2xl border border-border bg-background">
         <div className="flex items-center justify-between px-4 pt-4 select-none">
            <div className="flex items-center gap-2 text-[14px] font-semibold">
               <div className="tracking-tight text-text">{title}</div>
               <div className="text-text-muted">{count}</div>
            </div>
            <div className="flex items-center gap-1">
               <Button variant="ghost" size="icon-sm" className="text-text-muted hover:text-text">
                  <Ellipsis />
               </Button>
               <Button variant="ghost" size="icon-sm" className="text-text-muted hover:text-text">
                  <Plus />
               </Button>
            </div>
         </div>
         <div className="w-full px-4 py-4">{children}</div>
      </div>
   );
};

export default ProjectContainer;
