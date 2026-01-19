import React from "react";
import { IoIosAdd, IoMdSearch } from "react-icons/io";
import { MdFileDownload } from "react-icons/md";
import ClientsAddModal from "./ClientsAddModal.js";
import { useDisclosure } from "@heroui/react";
import ClientsDataTable from "./ClientsDataTable.js";

const ClientsHeader = () => {
   const { isOpen , onOpen, onOpenChange } = useDisclosure();

   return (
      <div className="flex flex-col gap-5 px-4 lg:px-8">
         <div className="relative flex flex-col gap-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
               <div className="flex flex-col gap-0.5 lg:gap-1">
                  <h1 className="text-2xl font-semibold  lg:text-display-xs">Clients</h1>
               </div>
               <div className="flex gap-4">
                  <div className="flex cursor-pointer items-center w-max h-max py-2 px-3 ring ring-white/20 rounded-lg hover:bg-white/10 transition-colors duration-150 gap-1 text-sm">
                     <MdFileDownload className="text-xl text-white/60" />
                     <button className="cursor-pointer">Export</button>
                  </div>
                  <div
                     className="flex items-center cursor-pointer bg-[#7F56D9] w-max h-max py-2 px-3 rounded-lg hover:bg-[#9E77ED]/80 transition-colors duration-150 gap-1 text-sm"
                     onClick={onOpen}>
                     <IoIosAdd className="text-xl text-white/90" />
                     <button className="cursor-pointer">Create Client</button>
                  </div>
               </div>
            </div>
         </div>
         <ClientsAddModal isOpen={isOpen} onOpenChange={onOpenChange} />
      </div>
   );
};

export default ClientsHeader;
