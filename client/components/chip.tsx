import React from "react";
import { cn } from "@/lib/utils";

type ClickableChipProps = {
   startContent?: React.ReactNode;
   label?: string;
   onClick?: () => void;
   className?: string;
};

export function ClickableChip({ startContent, label, onClick, className }: ClickableChipProps) {
   return (
      <button
         type="button"
         onClick={onClick}
         className={cn(
            "inline-flex w-max items-center gap-1.5 rounded-full border border-transparent px-2.5 py-1 text-xs font-medium text-text-muted transition-colors select-none hover:bg-surface hover:text-text",
            className
         )}
      >
         {startContent && <span className="flex items-center [&_svg]:size-3.5">{startContent}</span>}
         {label && <span>{label}</span>}
      </button>
   );
}
