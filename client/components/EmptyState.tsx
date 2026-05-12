"use client";

import React from "react";

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
      <div className="flex flex-col items-center justify-center flex-1 px-6 py-24 select-none">
         <div className="text-white/20 mb-5">{icon}</div>

         <h2 className="text-[15px] font-semibold text-white/80 mb-2">{title}</h2>

         <p className="text-[13px] text-white/40 text-center max-w-[340px] leading-relaxed mb-6">{description}</p>

         <div className="flex items-center gap-2">
            {primaryAction && (
               <button
                  onClick={primaryAction.onClick}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 transition-colors duration-150 text-white text-[13px] font-medium px-3.5 py-1.5 rounded-[7px]">
                  {primaryAction.label}
               </button>
            )}

            {secondaryAction && (
               <button
                  onClick={secondaryAction.onClick}
                  className="text-[13px] text-white/45 hover:text-white/70 transition-colors duration-150 px-3.5 py-1.5 rounded-[7px] hover:bg-white/5 border border-white/[0.08]">
                  {secondaryAction.label}
               </button>
            )}
         </div>
      </div>
   );
}
