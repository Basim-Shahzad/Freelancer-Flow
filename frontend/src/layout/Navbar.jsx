import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/features/auth/store.js";
import { useLogout } from "@/features/auth/hooks.js";
import { Button } from "@heroui/react";

const Navbar = () => {
   const navigate = useNavigate();
   const user = useAuthStore((state) => state.user);
   const { mutate: logout, isPending } = useLogout();

   return (
      <div className="text-white z-50 flex justify-between items-center px-12 py-8">
         <div className="text-2xl shadow-2xl h-full">Freelancer Flow</div>

         <div className="bg-black/50 h-12 w-110 px-2 flex items-center justify-center rounded-full text-white/90">
            <ul className="grid grid-cols-4 blur-none items-center h-full w-full justify-center rounded-full">
               <li
                  onClick={() => navigate("/dashboard")}
                  className="cursor-pointer h-full flex items-center justify-center hover:bg-white/5 rounded-full">
                  Dashboard
               </li>
               <li className="cursor-pointer h-full flex items-center justify-center hover:bg-white/5 rounded-full">
                  Features
               </li>
               <li className="cursor-pointer h-full flex items-center justify-center hover:bg-white/5 rounded-full">
                  Contact
               </li>
               <li className="cursor-pointer h-full flex items-center justify-center hover:bg-white/5 rounded-full">
                  About
               </li>
            </ul>
         </div>

         <div className="flex gap-2 h-full">
            {user ? (
               <div className="flex item-center justify-center gap-2 h-full">
                  <Button
                     onClick={() => logout()}
                     disabled={isPending}
                     color="danger"
                     isLoading={isPending}
                     className={` px-4 py-2 bg-white text-black rounded-full cursor-pointer select-none`}>
                     {isPending ? "Logging out..." : "Logout"}
                  </Button>
                  <div className="bg-white rounded-full w-10 flex justify-center items-center text-black text-xl select-none">
                     {user.logo ? user.logo : user.username.slice(0, 2).toUpperCase()}
                  </div>
               </div>
            ) : (
               ""
            )}
            <button
               onClick={() => navigate("/login")}
               className={` ${user ? "hidden" : ""}  px-4 py-2 bg-white text-black rounded-full cursor-pointer select-none`}>
               Sign Up
            </button>
            <button
               onClick={() => navigate("/login")}
               className={` ${user ? "hidden" : ""}  px-4 py-2 bg-white text-black rounded-full cursor-pointer select-none`}>
               Log in
            </button>
         </div>
      </div>
   );
};

export default Navbar;
