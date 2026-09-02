import React from "react";
import { cn } from "@/lib/utils";

type ClickableChipProps = {
   startContent?: React.ReactNode;
   label?: string;
   onClick?: () => void;
   className?: string;
};

export function ClickableChip({
   startContent,
   label,
   onClick,
   className,
}: ClickableChipProps) {
   return (
      <div
         onClick={onClick}
         className={cn(
            "flex items-center gap-1 w-max rounded-full px-2 py-0.5 text-[11px] text-white/75 select-none cursor-pointer transition-colors duration-150 hover:bg-black",
            className
         )}
      >
         {startContent && <span>{startContent}</span>}
         {label && <span>{label}</span>}
      </div>
   );
}