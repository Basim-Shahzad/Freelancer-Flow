import React from "react";
import { MdClose } from "react-icons/md";

const NotFound = () => {
   return (
      <div className="text-5xl flex flex-col  w-screen h-screen justify-center items-center text-red-500 gap-1">
         <div className="flex">
            <MdClose className="text-5xl" /> Not Found
         </div>

         <div>
            <a href="/dashboard">dashboard</a>
         </div>
      </div>
   );
};

export default NotFound;
