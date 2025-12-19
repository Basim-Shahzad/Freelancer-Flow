import React from "react";
import { MdFileDownload } from "react-icons/md";
import { IoIosAdd } from "react-icons/io";
import { useDisclosure } from "@heroui/react";
import ProjectsAddModal from "./ProjectsAddModal.jsx";

const ProjectsHeader = () => {
   const { isOpen, onOpen, onOpenChange } = useDisclosure();

   return (
      <div className="flex sm:flex-row sm:justify-between px-4 lg:px-8">
         <h1 className="text-2xl font-semibold  lg:text-display-xs">Projects</h1>
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
         <ProjectsAddModal isOpen={isOpen} onOpenChange={onOpenChange} />
      </div>
   );
};

export default ProjectsHeader;
