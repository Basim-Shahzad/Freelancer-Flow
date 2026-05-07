import React, { useState } from "react";
import { Button } from "@heroui/react";
import { FaPlay, FaPause } from "react-icons/fa";

interface ProjectTimeTrackerProps {}

const ProjectTimeTracker: React.FC<ProjectTimeTrackerProps> = () => {
   return (
      <div className="bg-white/10">
         <h1 className="text-2xl font-semibold">Time Tracker</h1>
         <div className="">
            <Button color="secondary" className="w-20 h-20 rounded-full">
               <FaPlay className="text-2xl text-white" />
            </Button>
         </div>
         <div></div>
      </div>
   );
};

export default ProjectTimeTracker;
