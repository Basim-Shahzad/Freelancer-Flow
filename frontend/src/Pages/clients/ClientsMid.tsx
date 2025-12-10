import React from "react";
import { IoIosAdd, IoMdSearch } from "react-icons/io";
import { MdFileDownload } from "react-icons/md";
import { useDisclosure } from "@heroui/react";
import ClientsAddModal from "./ClientsAddModal.js";
import ClientsDataTable from "./ClientsDataTable.js";

const ClientsMid = () => {
   const { isOpen , onOpen, onOpenChange } = useDisclosure();

   return (
      <>
         <div className="flex w-full justify-between items-center">
            <div className="flex items-center bg-gray-950/60 w-max ring ring-white/10 px-2 py-1 rounded-lg text-sm">
               <IoMdSearch className="text-2xl text-white/60" />
               <input type="text" className="px-3 py-2 outline-none" placeholder="Search for projects" />
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
                  <button className="cursor-pointer">Create Project</button>
               </div>
            </div>
         </div>

         <ClientsAddModal isOpen={isOpen} onOpenChange={onOpenChange} />
         <ClientsDataTable />
      </>
   );
};

export default ClientsMid;