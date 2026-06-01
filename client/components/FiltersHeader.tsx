"use client";

import { SlidersHorizontal, ListFilter } from "lucide-react";
import { Chip, Tooltip, Popover } from "@heroui/react";
import type { DisplayStoreState } from "@/stores/useDisplayStore";

interface HeaderProps<T extends string> {
   chips: string[];
   displayStore: DisplayStoreState<T>;
   actions?: unknown;
}

export default function FiltersHeader<T extends string>({ chips, displayStore, actions }: HeaderProps<T>) {
   const { display: displayLayout, options, setDisplay: setDisplayLayout } = displayStore;

   return (
      <header className="flex items-center justify-between h-11 px-5 border-b rounded-t-3xl border-white/6 bg-[#0d0d0d]/95 backdrop-blur-sm">
         {chips.map((chip, i) => (
            <Chip className="select-none" key={i}>
               {chip}
            </Chip>
         ))}

         <div className="flex items-center gap-4">
            <div className="flex items-center gap-3"></div>
            <Tooltip>
               <Tooltip.Trigger>
                  <button className="p-1 rounded-md text-white/40 hover:text-white/70 bg-white/5 transition-colors duration-100">
                     <ListFilter size={16} />
                  </button>
               </Tooltip.Trigger>
               <Tooltip.Content placement="bottom end">
                  <Tooltip.Arrow />
                  Helpful information about this element
               </Tooltip.Content>
            </Tooltip>
            <Popover>
               <Tooltip>
                  <Popover.Trigger>
                     <Tooltip.Trigger>
                        <button className="p-1 rounded-md text-white/40 hover:text-white/70 bg-white/5 transition-colors duration-100">
                           <SlidersHorizontal size={16} />
                        </button>
                     </Tooltip.Trigger>
                  </Popover.Trigger>
                  <Tooltip.Content placement="bottom end">
                     <Tooltip.Arrow />
                     Show Display options
                  </Tooltip.Content>
               </Tooltip>
               <Popover.Content className="w-80 h-100" placement="bottom right">
                  <Popover.Dialog>
                     <Popover.Heading className="flex items-center w-full justify-center gap-2">
                        {options.map((opt) => (
                           <Chip
                              key={opt}
                              onClick={() => setDisplayLayout(opt)}
                              className={`${displayLayout === opt ? "bg-white/15 font-semibold" : ""} px-6 py-1 border border-white/10 capitalize select-none cursor-pointer`}
                           >
                              {opt}
                           </Chip>
                        ))}
                     </Popover.Heading>
                  </Popover.Dialog>
               </Popover.Content>
            </Popover>
         </div>
      </header>
   );
}
