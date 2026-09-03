"use client";

import { SlidersHorizontal, ListFilter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { DisplayStoreState } from "@/stores/useDisplayStore";

interface HeaderProps<T extends string> {
   chips: string[];
   displayStore: DisplayStoreState<T>;
   actions?: unknown;
}

export default function FiltersHeader<T extends string>({ chips, displayStore }: HeaderProps<T>) {
   const { display: displayLayout, options, setDisplay: setDisplayLayout } = displayStore;

   return (
      <header className="flex h-11 items-center justify-between border-b border-border bg-surface/95 px-5 backdrop-blur-sm">
         <div className="flex items-center gap-2">
            {chips.map((chip, i) => (
               <Badge key={i} variant="outline" className="select-none">
                  {chip}
               </Badge>
            ))}
         </div>

         <div className="flex items-center gap-1">
            <Tooltip>
               <TooltipTrigger
                  render={
                     <Button variant="ghost" size="icon-sm" className="text-text-muted hover:text-text" />
                  }
               >
                  <ListFilter size={16} />
               </TooltipTrigger>
               <TooltipContent>Filter</TooltipContent>
            </Tooltip>

            <Popover>
               <Tooltip>
                  <PopoverTrigger
                     render={
                        <TooltipTrigger
                           render={
                              <Button variant="ghost" size="icon-sm" className="text-text-muted hover:text-text" />
                           }
                        />
                     }
                  >
                     <SlidersHorizontal size={16} />
                  </PopoverTrigger>
                  <TooltipContent>Display options</TooltipContent>
               </Tooltip>

               <PopoverContent align="end" className="w-56">
                  <p className="mb-1 px-1 text-xs font-medium text-text-muted select-none">Layout</p>
                  <div className="flex flex-col gap-0.5">
                     {options.map((opt) => (
                        <button
                           key={opt}
                           onClick={() => setDisplayLayout(opt)}
                           className={cn(
                              "w-full cursor-pointer rounded-md px-2 py-1.5 text-left text-sm capitalize transition-colors select-none",
                              displayLayout === opt
                                 ? "bg-primary/10 font-medium text-primary"
                                 : "text-text hover:bg-muted"
                           )}
                        >
                           {opt}
                        </button>
                     ))}
                  </div>
               </PopoverContent>
            </Popover>
         </div>
      </header>
   );
}
