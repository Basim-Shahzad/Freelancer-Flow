"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeaderProps {
   title: string;
   actions?: React.ReactNode;
   onAdd?: () => void;
}

export default function Header({ title, actions, onAdd }: HeaderProps) {
   return (
      <header className="flex h-11 items-center justify-between rounded-t-xl border-b border-border bg-surface/95 px-5 backdrop-blur-sm">
         <div className="flex items-center gap-3">
            <h1 className="text-[14px] font-medium text-text select-none">{title}</h1>
         </div>

         <div className="flex items-center gap-0.5">
            {actions}
            <Button variant="ghost" size="icon-sm" onClick={onAdd} className="text-text-muted hover:text-text">
               <Plus size={16} />
            </Button>
         </div>
      </header>
   );
}
