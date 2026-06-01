import React from "react";
import { Ellipsis, Plus } from "lucide-react";

type Props = {
   title: string;
   count: number;
   children: React.ReactNode;
};

const ProjectContainer: React.FC<Props> = ({ title, count, children }) => {
   return (
      <div className="bg-black/50 w-90 h-full rounded-2xl">
         <div className="flex items-center justify-between select-none px-4 pt-4 ">
            <div className="flex items-center gap-2 text-[14px] font-semibold">
               <div className="text-white/95 tracking-tight">{title}</div>
               <div className="text-white/50">{count}</div>
            </div>
            <div className="flex items-center gap-1" >
               <Ellipsis className="w-8 hover:bg-white/5 p-1 rounded-full text-white/50 hover:text-white" />
               <Plus className="w-8 hover:bg-white/5 p-1 rounded-full text-white/50 hover:text-white" />
            </div>
         </div>
         <div className="w-full px-4 py-4" >
            {children}
         </div>
      </div>
   );
};

export default ProjectContainer;
