"use client";

import { Plus } from "lucide-react";

interface HeaderProps {
   title: string;
   actions?: React.ReactNode;
}

export default function Header({ title, actions }: HeaderProps) {
   return (
      <header className="flex items-center justify-between h-11 px-5 border-b rounded-t-3xl border-white/6 bg-[#0d0d0d]/95 backdrop-blur-sm">
         <div className="flex items-center gap-3">
            <h1 className="text-[14px] font-medium text-white/90 select-none">{title}</h1>
         </div>

         <div className="flex items-center gap-0.5">
            {actions}
            <button className="p-1 rounded-[5px] text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors duration-100">
               <Plus size={16} />
            </button>
         </div>
      </header>
   );
}
