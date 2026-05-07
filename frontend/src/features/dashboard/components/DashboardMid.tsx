import React from "react";
import { useFormatters } from "../../../hooks/useFormatters.js";
import { useClients } from "@/features/clients/hooks.js";
import { useProjects } from "@/features/projects/hooks.js";
import DashboardProjectCard from "./DashboardProjectCard.js";
import ProfilePictureFromName from "@/UiComponents/ProfilePictureFromName.js";

const SectionHeader = ({ title }) => (
   <div className="flex flex-col gap-5 border-b border-white/10 pb-5">
      <div className="relative flex flex-col items-start gap-4 md:flex-row">
         <div className="flex flex-1 flex-col justify-center gap-0.5 self-stretch">
            <h2 className="text-lg font-semibold">{title}</h2>
         </div>
      </div>
   </div>
);

const iconCls = "z-1";
const featuredIconLg =
   "relative shrink-0 items-center justify-center shadow-xs-skeumorphic ring-1 ring-white/10 size-12 rounded-[10px] ring-primary hidden lg:flex";
const featuredIconSm =
   "relative flex shrink-0 items-center justify-center shadow-xs-skeumorphic ring-1 ring-white/10 size-10 rounded-lg text-fg-secondary ring-primary lg:hidden";
const cardBtn =
   "flex min-w-[320px] flex-1 cursor-pointer gap-3 rounded p-4 shadow-xs ring-1 ring-white/10 outline-focus-ring ring-inset focus-visible:outline-2 focus-visible:outline-offset-2 lg:p-5";

// Empty state for projects
const EmptyProjects = () => (
   <div className="flex w-full items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] py-12 px-6">
      <div className="flex flex-col items-center gap-2 text-center">
         <div className="flex items-center justify-center size-10 rounded-lg ring-1 ring-white/10 bg-white/5 text-[#5c5f63]">
            <svg
               viewBox="0 0 24 24"
               width="18"
               height="18"
               stroke="currentColor"
               strokeWidth="1.75"
               fill="none"
               strokeLinejoin="round"
               aria-hidden="true">
               <path d="M2 9V6.5C2 5.12 3.12 4 4.5 4H9.08C9.65 4 10.19 4.25 10.56 4.68L11.69 6H19.5C20.88 6 22 7.12 22 8.5V17.5C22 18.88 20.88 20 19.5 20H4.5C3.12 20 2 18.88 2 17.5V9Z" />
            </svg>
         </div>
         <p className="text-sm font-medium text-[#cecfd2]">No active projects</p>
         <p className="text-xs text-[#5c5f63]">Create a project to get started</p>
      </div>
   </div>
);

// Empty state for clients
const EmptyClients = () => (
   <div className="flex w-full items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] py-8 px-4">
      <div className="flex flex-col items-center gap-2 text-center">
         <div className="flex items-center justify-center size-9 rounded-lg ring-1 ring-white/10 bg-white/5 text-[#5c5f63]">
            <svg
               viewBox="0 0 24 24"
               width="16"
               height="16"
               stroke="currentColor"
               strokeWidth="1.75"
               fill="none"
               strokeLinejoin="round"
               aria-hidden="true">
               <path d="M12 15.5H7.5c-1.396 0-2.093 0-2.661.172a4 4 0 0 0-2.667 2.667C2 18.907 2 19.604 2 21m17 0v-6m-3 3h6M14.5 7.5a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
            </svg>
         </div>
         <p className="text-sm font-medium text-[#cecfd2]">No clients yet</p>
         <p className="text-xs text-[#5c5f63]">Add your first client</p>
      </div>
   </div>
);

const DashboardMid = () => {
   const { data: clientsData } = useClients(false);
   const { data: projectsData } = useProjects(false);
   const clients = clientsData?.clients ?? [];
   const projects = projectsData?.projects ?? [];
   const { formatDate } = useFormatters();

   const activeProjects = projects.filter((proj) => proj.status === "active").slice(0, 3);
   const latestClients = clients.slice(0, 5);

   return (
      <div>
         <SectionHeader title="Start creating content" />

         <div className="flex flex-col gap-8 lg:flex-row mt-6">
            <div className="flex flex-col gap-8">
               {/* Action cards */}
               <div className="flex flex-wrap gap-5 lg:gap-6">
                  <button className={cardBtn}>
                     <div className={featuredIconLg}>
                        <svg
                           viewBox="0 0 24 24"
                           width="24"
                           height="24"
                           stroke="currentColor"
                           strokeWidth="2"
                           fill="none"
                           strokeLinejoin="round"
                           aria-hidden="true"
                           className={iconCls}>
                           <path d="M12 15.5H7.5c-1.396 0-2.093 0-2.661.172a4 4 0 0 0-2.667 2.667C2 18.907 2 19.604 2 21m17 0v-6m-3 3h6M14.5 7.5a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
                        </svg>
                     </div>
                     <div className={featuredIconSm}>
                        <svg
                           viewBox="0 0 24 24"
                           width="24"
                           height="24"
                           stroke="currentColor"
                           strokeWidth="2"
                           fill="none"
                           strokeLinejoin="round"
                           aria-hidden="true"
                           className={iconCls}>
                           <path d="M12 15.5H7.5c-1.396 0-2.093 0-2.661.172a4 4 0 0 0-2.667 2.667C2 18.907 2 19.604 2 21m17 0v-6m-3 3h6M14.5 7.5a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
                        </svg>
                     </div>
                     <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left">
                        <p className="text-md font-semibold text-[#cecfd2]">Add a Client</p>
                        <p className="max-w-full truncate text-sm text-[#94979c]">Add or import from CSV</p>
                     </div>
                  </button>

                  <button className={cardBtn}>
                     <div className={featuredIconLg}>
                        <svg
                           viewBox="0 0 24 24"
                           width="24"
                           height="24"
                           stroke="currentColor"
                           strokeWidth="2"
                           fill="none"
                           strokeLinejoin="round"
                           aria-hidden="true"
                           className={iconCls}>
                           <path d="m21 18-1 1.094A2.71 2.71 0 0 1 18 20c-.75 0-1.47-.326-2-.906a2.716 2.716 0 0 0-2-.904c-.75 0-1.469.325-2 .904M3 20h1.675c.489 0 .733 0 .964-.055.204-.05.399-.13.578-.24.201-.123.374-.296.72-.642L19.5 6.5a2.121 2.121 0 0 0-3-3L3.937 16.063c-.346.346-.519.519-.642.72a2 2 0 0 0-.24.578c-.055.23-.055.475-.055.965V20Z" />
                        </svg>
                     </div>
                     <div className={featuredIconSm}>
                        <svg
                           viewBox="0 0 24 24"
                           width="24"
                           height="24"
                           stroke="currentColor"
                           strokeWidth="2"
                           fill="none"
                           strokeLinejoin="round"
                           aria-hidden="true"
                           className={iconCls}>
                           <path d="m21 18-1 1.094A2.71 2.71 0 0 1 18 20c-.75 0-1.47-.326-2-.906a2.716 2.716 0 0 0-2-.904c-.75 0-1.469.325-2 .904M3 20h1.675c.489 0 .733 0 .964-.055.204-.05.399-.13.578-.24.201-.123.374-.296.72-.642L19.5 6.5a2.121 2.121 0 0 0-3-3L3.937 16.063c-.346.346-.519.519-.642.72a2 2 0 0 0-.24.578c-.055.23-.055.475-.055.965V20Z" />
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
                  <SectionHeader title="Active Projects" />
                  {activeProjects.length === 0 ? (
                     <EmptyProjects />
                  ) : (
                     <div className="flex flex-wrap gap-4">
                        {activeProjects.map((proj) => (
                           <DashboardProjectCard project={proj} key={proj.id} />
                        ))}
                     </div>
                  )}
               </div>
            </div>

            {/* Top Clients sidebar */}
            <div className="flex w-full shrink-0 flex-col gap-6 lg:w-60">
               <p className="hidden text-sm font-medium lg:block">Latest Clients</p>
               <div className="flex flex-col gap-5 border-b pb-5 lg:hidden">
                  <SectionHeader title="Top Clients" />
               </div>
               {latestClients.length === 0 ? (
                  <EmptyClients />
               ) : (
                  <ul className="flex flex-col gap-6 lg:gap-5">
                     {latestClients.map((client) => (
                        <li key={client.id}>
                           <article className="relative flex gap-3">
                              <div className="flex shrink-0 flex-col">
                                 <ProfilePictureFromName name={client.name} scale={1} key={client.id} />
                              </div>
                              <div className="flex flex-1 flex-col gap-3">
                                 <header>
                                    <div className="flex items-center gap-2">
                                       <span
                                          className="rounded text-sm font-medium outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2">
                                          {client.name}
                                       </span>
                                    </div>
                                    <p className="text-sm text-tertiary">{formatDate(client.createdAt)}</p>
                                 </header>
                              </div>
                           </article>
                        </li>
                     ))}
                  </ul>
               )}
            </div>
         </div>
      </div>
   );
};

export default DashboardMid;
