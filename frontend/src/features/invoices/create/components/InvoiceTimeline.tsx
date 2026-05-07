import React from "react";
import { DatePicker } from "@heroui/react";

const InvoiceTimeline = () => {
   const date: Date = new Date();

   // Note: getMonth() returns 0-11, so added 1
   const formattedDate: string = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;

   return (
      <div className="w-full flex flex-col gap-2">
         <div>
            <h1 className=" text-white/75 text-sm" >Issue Date: {formattedDate}</h1>
         </div>
         <div className="flex items-center gap-1" >
            <h1 className="text-white/75 text-sm" >Due Date: </h1>
            <DatePicker isRequired size="sm" variant="bordered" className="w-max text-sm" />
         </div>
      </div>
   );
};

export default InvoiceTimeline;
