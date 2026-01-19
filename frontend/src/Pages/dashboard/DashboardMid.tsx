import React, { useState, useEffect } from "react";
import ModalComponent from "../../UiComponents/ModalComponent.jsx";
import { useDisclosure } from "@heroui/react";

import { useFormatters } from "../../hooks/useFormatters.js";
import logo from "../../assets/FF.png";
import { useClients } from "@/features/clients/hooks.js";

const DashboardMid = () => {
   const { data: response, isLoading: clientsLoading } = useClients();

   const clients = response?.items ?? [];

   const { formatDate } = useFormatters();

   return (
      <div>
         <div className="flex flex-col gap-5 border-b border-white/10 pb-5">
            <div className="relative flex flex-col items-start gap-4 md:flex-row">
               <div className="flex flex-1 flex-col justify-center gap-0.5 self-stretch">
                  <h2 className="text-lg font-semibold ">Start creating content</h2>
               </div>
               <div className="absolute top-0 right-0 md:static">
                  <button
                     className="cursor-pointer rounded-md text-fg-quaternary outline-focus-ring transition duration-100 ease-linear"
                     data-rac=""
                     type="button"
                     aria-haspopup="true"
                     aria-expanded="false"
                     id="react-aria-_R_2f9bsnpfiv7b_"
                     data-react-aria-pressable="true"
                     aria-label="Open menu">
                     <svg
                        viewBox="0 0 24 24"
                        width="24"
                        height="24"
                        stroke="currentColor"
                        strokeWidth="2"
                        fill="none"
                        strokeLinejoin="round"
                        aria-hidden="true"
                        className="size-5 transition-inherit-all text-[#85888E]">
                        <path d="M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm0-7a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm0 14a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"></path>
                     </svg>
                  </button>
               </div>
            </div>
         </div>

         <div className="flex flex-col gap-8 lg:flex-row mt-6">
            <div className="flex flex-col gap-8">
               <div className="flex flex-wrap gap-5 lg:gap-6">
                  <button className="flex min-w-[320px] flex-1 cursor-pointer gap-3 rounde p-4 shadow-xs ring-1 ring-white/10 outline-focus-ring ring-inset focus-visible:outline-2 focus-visible:outline-offset-2 lg:p-5">
                     <div
                        className="relative shrink-0 items-center justify-center *:data-icon:siz shadow-xs-skeumorphic ring-1 ring-white/10 size-12 rounded-[10px]  ring-primary hidden lg:flex"
                        data-featured-icon="true">
                        <svg
                           viewBox="0 0 24 24"
                           width="24"
                           height="24"
                           stroke="currentColor"
                           strokeWidth="2"
                           fill="none"
                           strokeLinejoin="round"
                           aria-hidden="true"
                           data-icon="true"
                           className="z-1">
                           <path d="M12 15.5H7.5c-1.396 0-2.093 0-2.661.172a4 4 0 0 0-2.667 2.667C2 18.907 2 19.604 2 21m17 0v-6m-3 3h6M14.5 7.5a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z"></path>
                        </svg>
                     </div>
                     <div
                        className="relative flex shrink-0 items-center justify-center *:data-icon:siz shadow-xs-skeumorphic ring-1 ring-white/10 size-10 rounded-lg text-fg-secondary ring-primary lg:hidden"
                        data-featured-icon="true">
                        <svg
                           viewBox="0 0 24 24"
                           width="24"
                           height="24"
                           stroke="currentColor"
                           strokeWidth="2"
                           fill="none"
                           strokeLinejoin="round"
                           aria-hidden="true"
                           data-icon="true"
                           className="z-1">
                           <path d="M12 15.5H7.5c-1.396 0-2.093 0-2.661.172a4 4 0 0 0-2.667 2.667C2 18.907 2 19.604 2 21m17 0v-6m-3 3h6M14.5 7.5a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z"></path>
                        </svg>
                     </div>
                     <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left">
                        <p className="text-md font-semibold text-[#cecfd2]">Add a Client</p>
                        <p className="max-w-full truncate text-sm text-[#94979c]">Add or import from CSV</p>
                     </div>
                  </button>
                  <button className="flex min-w-[320px] flex-1 cursor-pointer gap-3 rounde p-4 shadow-xs ring-1 ring-white/10 outline-focus-ring ring-inset focus-visible:outline-2 focus-visible:outline-offset-2 lg:p-5">
                     <div
                        className="relative shrink-0 items-center justify-center *:data-icon:siz shadow-xs-skeumorphic ring-1 ring-white/10 size-12 rounded-[10px] text-fg-secondary ring-primary hidden lg:flex"
                        data-featured-icon="true">
                        <svg
                           viewBox="0 0 24 24"
                           width="24"
                           height="24"
                           stroke="currentColor"
                           strokeWidth="2"
                           fill="none"
                           strokeLinejoin="round"
                           aria-hidden="true"
                           data-icon="true"
                           className="z-1">
                           <path d="m21 18-1 1.094A2.71 2.71 0 0 1 18 20c-.75 0-1.47-.326-2-.906a2.716 2.716 0 0 0-2-.904c-.75 0-1.469.325-2 .904M3 20h1.675c.489 0 .733 0 .964-.055.204-.05.399-.13.578-.24.201-.123.374-.296.72-.642L19.5 6.5a2.121 2.121 0 0 0-3-3L3.937 16.063c-.346.346-.519.519-.642.72a2 2 0 0 0-.24.578c-.055.23-.055.475-.055.965V20Z"></path>
                        </svg>
                     </div>
                     <div
                        className="relative flex shrink-0 items-center justify-center *:data-icon:siz shadow-xs-skeumorphic ring-1 ring-white/10 size-10 rounded-lg text-fg-secondary ring-primary lg:hidden"
                        data-featured-icon="true">
                        <svg
                           viewBox="0 0 24 24"
                           width="24"
                           height="24"
                           stroke="currentColor"
                           strokeWidth="2"
                           fill="none"
                           strokeLinejoin="round"
                           aria-hidden="true"
                           data-icon="true"
                           className="z-1">
                           <path d="m21 18-1 1.094A2.71 2.71 0 0 1 18 20c-.75 0-1.47-.326-2-.906a2.716 2.716 0 0 0-2-.904c-.75 0-1.469.325-2 .904M3 20h1.675c.489 0 .733 0 .964-.055.204-.05.399-.13.578-.24.201-.123.374-.296.72-.642L19.5 6.5a2.121 2.121 0 0 0-3-3L3.937 16.063c-.346.346-.519.519-.642.72a2 2 0 0 0-.24.578c-.055.23-.055.475-.055.965V20Z"></path>
                        </svg>
                     </div>
                     <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left">
                        <p className="text-md font-semibold text-[#cecfd2]">Create a new Project</p>
                        <p className="max-w-full truncate text-sm text-[#94979c]">
                           Dive into the work and start working
                        </p>
                     </div>
                  </button>
               </div>
               <div className="flex flex-col gap-6">
                  <div className="flex flex-col gap-5 border-b border-white/10 pb-5">
                     <div className="relative flex flex-col items-start gap-4 md:flex-row">
                        <div className="flex flex-1 flex-col justify-center gap-0.5 self-stretch">
                           <h2 className="text-lg font-semibold ">Recent posts</h2>
                        </div>
                        <div className="absolute top-0 right-0 md:static">
                           <button
                              className="cursor-pointer rounded-md text-fg-quaternary outline-focus-ring transition duration-100 ease-linear"
                              data-rac=""
                              type="button"
                              aria-haspopup="true"
                              aria-expanded="false"
                              id="react-aria-_R_4pn9bsnpfiv7b_"
                              data-react-aria-pressable="true"
                              aria-label="Open menu">
                              <svg
                                 viewBox="0 0 24 24"
                                 width="24"
                                 height="24"
                                 stroke="currentColor"
                                 strokeWidth="2"
                                 fill="none"
                                 strokeLinejoin="round"
                                 aria-hidden="true"
                                 className="size-5 transition-inherit-all">
                                 <path d="M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm0-7a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm0 14a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"></path>
                              </svg>
                           </button>
                        </div>
                     </div>
                  </div>
                  <div className="flex flex-wrap gap-6">
                     <div className="flex flex-col gap-4 min-w-[320px] flex-1">
                        <a href="#" className="overflow-hidden rounded-2xl">
                           <img
                              src="https://www.untitledui.com/application/spirals.webp"
                              alt="UX review presentations"
                              className="aspect-[1.5] w-full object-cover"
                           />
                        </a>
                        <div className="flex flex-col gap-6">
                           <div className="flex flex-col items-start gap-2">
                              <p className="text-sm font-semibold">Olivia Rhye • 20 Jan 2025</p>
                              <div className="flex w-full flex-col gap-1">
                                 <a
                                    href="#"
                                    className="flex justify-between gap-x-4 rounded-md text-lg font-semibold  outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2">
                                    UX review presentations
                                    <svg
                                       viewBox="0 0 24 24"
                                       width="24"
                                       height="24"
                                       stroke="currentColor"
                                       strokeWidth="2"
                                       fill="none"
                                       strokeLinejoin="round"
                                       aria-hidden="true"
                                       className="mt-0.5 size-6 shrink-0 text-fg-quaternary">
                                       <path d="M7 17 17 7m0 0H7m10 0v10"></path>
                                    </svg>
                                 </a>
                                 <p className="line-clamp-2 text-md text-tertiary">
                                    How do you create compelling presentations that wow your colleagues and impress your
                                    managers?
                                 </p>
                              </div>
                           </div>
                           <div className="flex gap-2">
                              <a
                                 href="#"
                                 className="rounded-xl outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2">
                                 <span className="size-max flex items-center whitespace-nowrap rounded-full ring-1 ring-inset py-0.5 px-2.5 text-sm font-medium bg-utility-brand-50 text-utility-brand-700 ring-utility-brand-200">
                                    Design
                                 </span>
                              </a>
                              <a
                                 href="#"
                                 className="rounded-xl outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2">
                                 <span className="size-max flex items-center whitespace-nowrap rounded-full ring-1 ring-inset py-0.5 px-2.5 text-sm font-medium bg-utility-indigo-50 text-utility-indigo-700 ring-utility-indigo-200">
                                    Research
                                 </span>
                              </a>
                              <a
                                 href="#"
                                 className="rounded-xl outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2">
                                 <span className="size-max flex items-center whitespace-nowrap rounded-full ring-1 ring-inset py-0.5 px-2.5 text-sm font-medium bg-utility-pink-50 text-utility-pink-700 ring-utility-pink-200">
                                    Presentation
                                 </span>
                              </a>
                           </div>
                        </div>
                     </div>
                     <div className="flex flex-col gap-4 min-w-[320px] flex-1">
                        <a href="#" className="overflow-hidden rounded-2xl">
                           <img
                              src="https://www.untitledui.com/application/conversation.webp"
                              alt="Migrating to Linear 101"
                              className="aspect-[1.5] w-full object-cover"
                           />
                        </a>
                        <div className="flex flex-col gap-6">
                           <div className="flex flex-col items-start gap-2">
                              <p className="text-sm font-semibold">Phoenix Baker • 19 Jan 2025</p>
                              <div className="flex w-full flex-col gap-1">
                                 <a
                                    href="#"
                                    className="flex justify-between gap-x-4 rounded-md text-lg font-semibold outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2">
                                    Migrating to Linear 101
                                    <svg
                                       viewBox="0 0 24 24"
                                       width="24"
                                       height="24"
                                       stroke="currentColor"
                                       strokeWidth="2"
                                       fill="none"
                                       strokeLinejoin="round"
                                       aria-hidden="true"
                                       className="mt-0.5 size-6 shrink-0 text-fg-quaternary">
                                       <path d="M7 17 17 7m0 0H7m10 0v10"></path>
                                    </svg>
                                 </a>
                                 <p className="line-clamp-2 text-md text-tertiary">
                                    Linear helps streamline software projects, sprints, tasks, and bug tracking. Here
                                    &#x27;s how to get started.
                                 </p>
                              </div>
                           </div>
                           <div className="flex gap-2">
                              <a
                                 href="#"
                                 className="rounded-xl outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2">
                                 <span className="size-max flex items-center whitespace-nowrap rounded-full ring-1 ring-inset py-0.5 px-2.5 text-sm font-medium bg-utility-blue-light-50 text-utility-blue-light-700 ring-utility-blue-light-200">
                                    Product
                                 </span>
                              </a>
                              <a
                                 href="#"
                                 className="rounded-xl outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2">
                                 <span className="size-max flex items-center whitespace-nowrap rounded-full ring-1 ring-inset py-0.5 px-2.5 text-sm font-medium bg-utility-pink-50 text-utility-pink-700 ring-utility-pink-200">
                                    Tools
                                 </span>
                              </a>
                              <a
                                 href="#"
                                 className="rounded-xl outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2">
                                 <span className="size-max flex items-center whitespace-nowrap rounded-full ring-1 ring-inset py-0.5 px-2.5 text-sm font-medium bg-utility-pink-50 text-utility-pink-700 ring-utility-pink-200">
                                    SaaS
                                 </span>
                              </a>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
            </div>

            <div className="flex w-full shrink-0 flex-col gap-6 lg:w-60">
               <p className="hidden text-sm font-medium lg:block">Top Clients</p>
               <div className="flex flex-col gap-5 border-b pb-5 lg:hidden">
                  <div className="relative flex flex-col items-start gap-4 md:flex-row">
                     <div className="flex flex-1 flex-col justify-center gap-0.5 self-stretch">
                        <h2 className="text-lg font-semibold ">Top Clients</h2>
                     </div>
                     <div className="absolute top-0 right-0 md:static">
                        <button
                           className="cursor-pointer rounded-md text-fg-quaternary outline-focus-ring transition duration-100 ease-linear"
                           data-rac=""
                           type="button"
                           aria-haspopup="true"
                           aria-expanded="false"
                           id="react-aria-_R_1an9bsnpfiv7b_"
                           data-react-aria-pressable="true"
                           aria-label="Open menu">
                           <svg
                              viewBox="0 0 24 24"
                              width="24"
                              height="24"
                              stroke="currentColor"
                              strokeWidth="2"
                              fill="none"
                              strokeLinejoin="round"
                              aria-hidden="true"
                              className="size-5 transition-inherit-all">
                              <path d="M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm0-7a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm0 14a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"></path>
                           </svg>
                        </button>
                     </div>
                  </div>
               </div>
               <ul className="flex flex-col gap-6 lg:gap-5">
                  {clients.map((client) => (
                     <li key={client.id}>
                        <article className="relative flex gap-3">
                           <div className="flex shrink-0 flex-col">
                              <div
                                 data-avatar="true"
                                 className="relative inline-flex shrink-0 items-center justify-center rounded-full bg-avatar-bg outline-avatar-contrast-border size-8 outline-[0.75px] -outline-offset-[0.75px]">
                                 <img
                                    data-avatar-img="true"
                                    className="size-full rounded-full object-cover"
                                    src={client.logo ? client.logo : logo}
                                    alt="Ava Wright"
                                 />
                                 <span className="absolute right-0 bottom-0 rounded-full ring-[1.5px] bg-green-500 size-2"></span>
                              </div>
                           </div>
                           <div className="flex flex-1 flex-col gap-3">
                              <header>
                                 <div className="flex items-center gap-2">
                                    <a
                                       href="#"
                                       className="rounded text-sm font-medium outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2">
                                       {client.name}
                                    </a>
                                 </div>
                                 <p className="text-sm text-tertiary">{formatDate(client.created_at)}</p>
                              </header>
                           </div>
                        </article>
                     </li>
                  ))}
               </ul>
            </div>
         </div>
      </div>
   );
};

export default DashboardMid;
