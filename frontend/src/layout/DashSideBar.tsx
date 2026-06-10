import React, { useContext, useState } from "react";
import { ThemeContext } from "../App.jsx";
import { CiDark, CiLight } from "react-icons/ci";
import { Link } from "react-router-dom";
import { useAuthStore } from "@/features/auth/store.js";
import ProfilePictureFromName from "@/UiComponents/ProfilePictureFromName.js";
import { HiSelector } from "react-icons/hi";

import { IoIosSettings } from "react-icons/io";
import { IoLogOut } from "react-icons/io5";
import { MdUpgrade } from "react-icons/md";

const DashSideBar = () => {
   const { theme, toggle } = useContext(ThemeContext);
   const user = useAuthStore((state) => state.user);
   const [isMenuExpand, setIsMenuExpand] = useState<boolean>(false);

   return (
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex">
         <aside className="flex h-full w-full max-w-[296px] flex-col justify-between pt-4 lg:w-(--width) lg:pt-6 md:border-r dark:border-white/10 border-black/10">
            <div className="flex flex-col gap-5 px-4 lg:px-5">
               <div className="flex w-full items-center justify-start h-8">
                  <div className="flex justify-between w-full items-center">
                     <div className="text-xl font-semibold">FreelancerFlow</div>
                     <button
                        onClick={toggle}
                        className="bg-gray-100 px-2 py-2 rounded-xl text-black font-black cursor-pointer">
                        {theme === "dark" ? <CiLight /> : <CiDark />}
                     </button>
                  </div>
               </div>
               <div className="relative flex w-full flex-row place-content-center place-items-center rounded-lg shadow-xs ring-1 ring-white/20 ring-inset">
                  <svg
                     viewBox="0 0 24 24"
                     width="24"
                     height="24"
                     stroke="currentColor"
                     strokeWidth="2"
                     fill="none"
                     strokeLinejoin="round"
                     aria-hidden="true"
                     className="pointer-events-none absolute size-5 text-[#85888E] left-3">
                     <path d="m21 21-3.5-3.5m2.5-6a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0Z" />
                  </svg>
                  <input
                     type="text"
                     placeholder="Search"
                     className="w-full bg-transparent text-md text-primary placeholder:text-black/60 dark:placeholder:text-white/60 px-3 py-2 pl-10 outline-none"
                  />
               </div>
            </div>

            <ul className="mt-4 flex flex-col px-2 lg:px-4">
               <li className="py-0.5">
                  <Link
                     to="/"
                     className="px-3 py-2 group relative flex w-full cursor-pointer items-center rounded-md transition duration-100 ease-linear select-none hover:bg-secondary_hover">
                     <svg
                        viewBox="0 0 24 24"
                        width="24"
                        height="24"
                        stroke="currentColor"
                        strokeWidth="2"
                        fill="none"
                        strokeLinejoin="round"
                        aria-hidden="true"
                        className="mr-2 size-5 shrink-0 text-[#85888E]">
                        <path d="M8 17h8M11.018 2.764 4.235 8.039c-.453.353-.68.53-.843.75a2 2 0 0 0-.318.65C3 9.704 3 9.991 3 10.565V17.8c0 1.12 0 1.68.218 2.108a2 2 0 0 0 .874.874C4.52 21 5.08 21 6.2 21h11.6c1.12 0 1.68 0 2.108-.218a2 2 0 0 0 .874-.874C21 19.48 21 18.92 21 17.8v-7.235c0-.574 0-.861-.074-1.126a2.002 2.002 0 0 0-.318-.65c-.163-.22-.39-.397-.843-.75l-6.783-5.275c-.351-.273-.527-.41-.72-.462a1 1 0 0 0-.523 0c-.194.052-.37.189-.721.462Z" />
                     </svg>
                     <span className="flex-1 text-md truncate">Home</span>
                  </Link>
               </li>
               <li className="py-0.5">
                  <Link
                     to="/dashboard"
                     className="px-3 py-2 group relative flex w-full cursor-pointer items-center rounded-md transition duration-100 ease-linear select-none bg-active hover:bg-secondary_hover">
                     <svg
                        viewBox="0 0 24 24"
                        width="24"
                        height="24"
                        stroke="currentColor"
                        strokeWidth="2"
                        fill="none"
                        strokeLinejoin="round"
                        aria-hidden="true"
                        className="mr-2 size-5 shrink-0 text-[#85888E]">
                        <path d="M8 15v2m4-6v6m4-10v10m-8.2 4h8.4c1.68 0 2.52 0 3.162-.327a3 3 0 0 0 1.311-1.311C21 18.72 21 17.88 21 16.2V7.8c0-1.68 0-2.52-.327-3.162a3 3 0 0 0-1.311-1.311C18.72 3 17.88 3 16.2 3H7.8c-1.68 0-2.52 0-3.162.327a3 3 0 0 0-1.311 1.311C3 5.28 3 6.12 3 7.8v8.4c0 1.68 0 2.52.327 3.162a3 3 0 0 0 1.311 1.311C5.28 21 6.12 21 7.8 21Z" />
                     </svg>
                     <span className="flex-1 text-md truncate">Dashboard</span>
                  </Link>
               </li>
               <li className="py-0.5">
                  <Link
                     to="/invoices"
                     className="px-3 py-2 group relative flex w-full cursor-pointer items-center rounded-md transition duration-100 ease-linear select-none hover:bg-secondary_hover">
                     <svg
                        viewBox="0 0 24 24"
                        width="24"
                        height="24"
                        stroke="currentColor"
                        strokeWidth="2"
                        fill="none"
                        strokeLinejoin="round"
                        aria-hidden="true"
                        className="mr-2 size-5 shrink-0 text-[#85888E]">
                        <path d="M12 2a10 10 0 0 1 10 10M12 2v10m0-10C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10M12 2c5.523 0 10 4.477 10 10m0 0H12m10 0a10 10 0 0 1-4.122 8.09L12 12" />
                     </svg>
                     <span className="flex-1 text-md truncate">Invoices</span>
                  </Link>
               </li>
               <li className="py-0.5">
                  <Link
                     to="/projects"
                     className="px-3 py-2 group relative flex w-full cursor-pointer items-center rounded-md transition duration-100 ease-linear select-none hover:bg-secondary_hover">
                     <svg
                        viewBox="0 0 24 24"
                        width="24"
                        height="24"
                        stroke="currentColor"
                        strokeWidth="2"
                        fill="none"
                        strokeLinejoin="round"
                        aria-hidden="true"
                        className="mr-2 size-5 shrink-0 text-[#85888E]">
                        <path d="M17.8 10c1.12 0 1.68 0 2.108-.218a2 2 0 0 0 .874-.874C21 8.48 21 7.92 21 6.8v-.6c0-1.12 0-1.68-.218-2.108a2 2 0 0 0-.874-.874C19.48 3 18.92 3 17.8 3H6.2c-1.12 0-1.68 0-2.108.218a2 2 0 0 0-.874.874C3 4.52 3 5.08 3 6.2v.6c0 1.12 0 1.68.218 2.108a2 2 0 0 0 .874.874C4.52 10 5.08 10 6.2 10h11.6Zm0 11c1.12 0 1.68 0 2.108-.218a2 2 0 0 0 .874-.874C21 19.48 21 18.92 21 17.8v-.6c0-1.12 0-1.68-.218-2.108a2 2 0 0 0-.874-.874C19.48 14 18.92 14 17.8 14H6.2c-1.12 0-1.68 0-2.108.218a2 2 0 0 0-.874.874C3 15.52 3 16.08 3 17.2v.6c0 1.12 0 1.68.218 2.108a2 2 0 0 0 .874.874C4.52 21 5.08 21 6.2 21h11.6Z" />
                     </svg>
                     <span className="flex-1 text-md truncate">Projects</span>
                  </Link>
               </li>
               <li className="py-0.5">
                  <Link
                     to="/clients"
                     className="px-3 py-2 group relative flex w-full cursor-pointer items-center rounded-md transition duration-100 ease-linear select-none hover:bg-secondary_hover">
                     <svg
                        viewBox="0 0 24 24"
                        width="24"
                        height="24"
                        stroke="currentColor"
                        strokeWidth="2"
                        fill="none"
                        strokeLinejoin="round"
                        aria-hidden="true"
                        className="mr-2 size-5 shrink-0 text-[#85888E]">
                        <path d="m6 15 2 2 4.5-4.5M8 8V5.2c0-1.12 0-1.68.218-2.108a2 2 0 0 1 .874-.874C9.52 2 10.08 2 11.2 2h7.6c1.12 0 1.68 0 2.108.218a2 2 0 0 1 .874.874C22 3.52 22 4.08 22 5.2v7.6c0 1.12 0 1.68-.218 2.108a2 2 0 0 1-.874.874C20.48 16 19.92 16 18.8 16H16M5.2 22h7.6c1.12 0 1.68 0 2.108-.218a2 2 0 0 0 .874-.874C16 20.48 16 19.92 16 18.8v-7.6c0-1.12 0-1.68-.218-2.108a2 2 0 0 0-.874-.874C14.48 8 13.92 8 12.8 8H5.2c-1.12 0-1.68 0-2.108.218a2 2 0 0 0-.874.874C2 9.52 2 10.08 2 11.2v7.6c0 1.12 0 1.68.218 2.108a2 2 0 0 0 .874.874C3.52 22 4.08 22 5.2 22Z" />
                     </svg>
                     <span className="flex-1 text-md truncate">Clients</span>
                     <span className="size-max flex items-center whitespace-nowrap rounded-full ring-1 ring-inset py-0.5 px-2 text-xs font-medium bg-utility-gray-50 text-utility-gray-700 ring-[#85888E] ml-3">
                        4
                     </span>
                  </Link>
               </li>
               <li className="py-0.5">
                  <Link
                     to="/time-tracking"
                     className="px-3 py-2 group relative flex w-full cursor-pointer items-center rounded-md transition duration-100 ease-linear select-none hover:bg-secondary_hover">
                     <svg
                        viewBox="0 0 24 24"
                        width="24"
                        height="24"
                        stroke="currentColor"
                        strokeWidth="2"
                        fill="none"
                        strokeLinejoin="round"
                        aria-hidden="true"
                        className="mr-2 size-5 shrink-0 text-[#85888E]">
                        <path d="M12 2a10 10 0 0 1 10 10M12 2v10m0-10C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10M12 2c5.523 0 10 4.477 10 10m0 0H12m10 0a10 10 0 0 1-4.122 8.09L12 12" />
                     </svg>
                     <span className="flex-1 text-md truncate">Time Tracker</span>
                  </Link>
               </li>
            </ul>

            <div className="mt-auto flex flex-col gap-4 px-2 py-4 lg:px-4 lg:py-6">
               <div className="">
                  <div className="flex flex-col rounded-md ring- border border-white/5 overflow-hidden">
                     {isMenuExpand && (
                        <div className="flex flex-col gap-1 p-2">
                           <div className="text-sm text-white/65 px-2 py-1.5">{user?.email}</div>
                           <div className="text-sm flex gap-1.5 items-center cursor-pointer text-white/70 hover:bg-white/10 rounded px-2 py-1.5 text-left">
                              <IoIosSettings className="text-xl" />
                              <span>Profile Settings</span>
                           </div>
                           <div className="text-sm flex gap-1.5 items-center cursor-pointer text-white/70 hover:bg-white/10 rounded px-2 py-1.5 text-left">
                              <MdUpgrade className="text-xl" />
                              <span>Upgrade Plan</span>
                           </div>
                           <hr className="text-white/10 my-1" />
                           <div className="text-sm flex gap-1.5 hover:text-red-500 transition-colors duration-100 items-center cursor-pointer text-white/70 hover:bg-red-500/10 rounded px-2 py-1.5 text-left">
                              <IoLogOut className="text-xl" />
                              <span>Log out</span>
                           </div>
                        </div>
                     )}

                     <div
                        className="flex items-center p-2 hover:bg-white/5 cursor-pointer border-t-0"
                        onClick={() => setIsMenuExpand((state) => !state)}>
                        <figure className="group flex min-w-0 flex-1 items-center gap-2">
                           <div className="relative inline-flex shrink-0 items-center justify-center rounded-full">
                              {user?.logo ? (
                                 <img className="size-full rounded-full object-cover" src={user.logo} />
                              ) : user?.username ? (
                                 <ProfilePictureFromName name={user.username} scale={1} />
                              ) : (
                                 <div className="size-10 rounded-full bg-gray-600" />
                              )}
                              <span className="absolute right-0 bottom-0 rounded-full ring-[1.5px] ring-green-400 bg-green-400 size-2.5" />
                           </div>
                           <figcaption className="min-w-0 flex-1">
                              <p className="text-md text-white/75">{user?.username}</p>
                              <p className="text-xs text-[#85888E]">Free Plan</p>
                           </figcaption>
                        </figure>
                        <HiSelector className="text-xl text-white/50" />
                     </div>
                  </div>
               </div>
            </div>
         </aside>
      </div>
   );
};

export default DashSideBar;
