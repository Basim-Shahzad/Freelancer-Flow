"use client";

import { SlidersHorizontal, Columns2, ListFilter } from "lucide-react";

interface HeaderProps {
   title: string;
   actions?: React.ReactNode;
}

export default function Header({ title, actions }: HeaderProps) {
   return (
      <header className="flex items-center justify-between h-11 px-5 border-b border-white/[0.06] sticky top-0 z-10 bg-[#0d0d0d]/95 backdrop-blur-sm">
         <div className="flex items-center gap-3">
            <h1 className="text-[14px] font-medium text-white/90 select-none">{title}</h1>
         </div>

         <div className="flex items-center gap-0.5">
            {actions}
            <button className="p-1.5 rounded-[5px] text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors duration-100">
               <ListFilter size={14} />
            </button>
            <button className="p-1.5 rounded-[5px] text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors duration-100">
               <SlidersHorizontal size={14} />
            </button>
            <button className="p-1.5 rounded-[5px] text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors duration-100">
               <Columns2 size={14} />
            </button>
         </div>
      </header>
   );
}
