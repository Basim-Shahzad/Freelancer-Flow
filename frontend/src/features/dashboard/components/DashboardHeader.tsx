import React from "react";
import { Button } from "@heroui/react";
import { useDashboardStore, type timeRangeType } from "../store.js";

const DashboardHeader = () => {
   const { setTimeRange, timeRange } = useDashboardStore();

   const timeRanges: {
      label: string;
      short: string;
      value: timeRangeType;
   }[] = [
      { label: "All Time", short: "All Time", value: "all" },
      { label: "7 days", short: "7D", value: "weekly" },
      { label: "30 days", short: "30D", value: "monthly" },
      { label: "1 year", short: "1Y", value: "yearly" },
   ];

   return (
      <div className="flex flex-col gap-5 px-4 lg:px-8">
         <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
            <h1 className="text-2xl font-semibold lg:text-display-xs">Dashboard</h1>
         </div>

         <div className="flex gap-3 lg:justify-between">
            <div
               className="relative z-0 inline-flex w-max -space-x-px rounded-lg shadow-xs"
               role="radiogroup"
               aria-orientation="horizontal">
               {timeRanges.map(({ label, short, value }) => (
                  <Button
                     color="default"
                     variant="bordered"
                     key={short}
                     className={`ring-0 border rounded-[5px] ${timeRange == value ? "bg-white/25" : ""}`}
                     onPress={() => setTimeRange(value)}>
                     <span className="max-lg:hidden">{label}</span>
                     <span className="lg:hidden">{short}</span>
                  </Button>
               ))}
            </div>
         </div>
         
      </div>
   );
};

export default DashboardHeader;
