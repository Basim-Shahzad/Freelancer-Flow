import React from "react";

const ClientsHeader = () => {
   return (
      <div className="flex flex-col gap-5 px-4 lg:px-8">
         <div className="relative flex flex-col gap-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
               <div className="flex flex-col gap-0.5 lg:gap-1">
                  <h1 className="text-2xl font-semibold  lg:text-display-xs">Clients</h1>
               </div>
            </div>
         </div>
      </div>
   );
};

export default ClientsHeader;
