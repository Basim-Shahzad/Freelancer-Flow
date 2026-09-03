"use client";

import React from "react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
   icon: React.ReactNode;
   title: string;
   description: string;
   primaryAction?: {
      label: string;
      onClick?: () => void;
   };
   secondaryAction?: {
      label: string;
      href?: string;
      onClick?: () => void;
   };
}

export default function EmptyState({ icon, title, description, primaryAction, secondaryAction }: EmptyStateProps) {
   return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-24 select-none">
         <div className="mb-5 text-text-muted/50 [&_svg]:size-13">{icon}</div>

         <h2 className="mb-2 text-[15px] font-semibold text-text">{title}</h2>

         <p className="mb-6 max-w-[340px] text-center text-[13px] leading-relaxed text-text-muted">{description}</p>

         <div className="flex items-center gap-2">
            {primaryAction && (
               <Button onClick={primaryAction.onClick} size="lg" className="rounded-full">
                  {primaryAction.label}
               </Button>
            )}

            {secondaryAction && (
               <Button onClick={secondaryAction.onClick} variant="ghost" size="lg" className="rounded-full">
                  {secondaryAction.label}
               </Button>
            )}
         </div>
      </div>
   );
}
