import { useRef, useLayoutEffect, useState } from "react";
import type { Project } from "@/types/models.js";
import { CiUser, CiCalendar } from "react-icons/ci";
import { useNavigate } from "react-router-dom";
import { useFormatters } from "@/hooks/useFormatters.js";

type Props = {
   project: Project;
};

const ProjectCard = ({ project }: Props) => {
   const { name, price, client, hourly_rate, id, due_date, status, time_tracking, description } = project;
   const navigate = useNavigate();
   const { formatDueDate } = useFormatters();

   function statusColor(status: string) {
      if (status === "archived") return "text-gray-500 bg-gray-900/40";
      if (status === "completed") return "text-green-500 bg-green-900/40";
      if (status === "active") return "text-yellow-500 bg-yellow-900/40";
   }

   return (
      // <div
      //    className="project-card bg-gray-900/20 border border-white/15 rounded-xl shadow-sm px-4 py-3 min-w-50 max-w-75 max-h-90 cursor-pointer hover:bg-gray-900/50 transition-colors duration-200"
      //    onClick={() => {
      //       navigate(`/projects/${id}`);
      //    }}>
      //    <div className="flex items-center justify-between">
      //       <h1 className="text-2xl">{name}</h1>
      //       {/* <IoMdMore className="text-white/50 text-2xl cursor-pointer" /> */}
      //    </div>
      //    <div className="flex gap-2 mt-2.5">
      //       <div className="flex gap-3">
      //          <div>
      //             {time_tracking ? (
      //                <div>
      //                   <h5 className="text-white/50 text-xs">Hourly Rate</h5>
      //                   <div>${hourly_rate}/h</div>
      //                </div>
      //             ) : (
      //                <div>
      //                   <h5 className="text-white/50 text-xs">Price</h5>
      //                   <div className="text-sm">${price}</div>
      //                </div>
      //             )}
      //          </div>
      //          <div className="w-0.5 h-10 bg-white/10"></div>
      //       </div>

      //       <div className="flex gap-3">
      //          <div>
      //             <h5 className="text-white/50 text-xs">Due Date</h5>
      //             <div className="text-sm">{due_date}</div>
      //          </div>
      //          <div className="w-0.5 h-10 bg-white/10"></div>
      //       </div>

      //       <div className="flex gap-3">
      //          <div>
      //             <h5 className="text-white/50 text-xs">Status</h5>
      //             <div className={`text-sm ${statusColor(status ? status : "")}`}>{status}</div>
      //          </div>
      //          <div className="w-0.5 h-10 bg-white/10"></div>
      //       </div>
      //    </div>

      //    <p className="text-sm text-white/70 mt-2">{description}</p>

      //    <div className="flex flex-col gap-1.5">
      //       <h2 className="text-white/90">Client Details</h2>

      //       <div className="flex items-center">
      //          <CiUser className="text-white/50 text-xl" />
      //          <p className="text-white/70 text-sm"> {client?.name}</p>
      //       </div>

      //       {client?.phone && (
      //          <div className="flex items-center">
      //             <CiPhone className="text-white/50 text-xl" />
      //             <p className="text-white/70 text-sm"> {client?.phone}</p>
      //          </div>
      //       )}

      //       {client?.email && (
      //          <div className="flex items-center">
      //             <MdEmail className="text-white/50 text-xl" />
      //             <p className="text-white/70 text-sm"> {client?.email}</p>
      //          </div>
      //       )}
      //    </div>
      // </div>
      <div
         className="rounded-xl bg-gray-950 border border-white/10 hover:bg-gray-900 px-4 py-3 cursor-pointer transition-colors duration-200 flex flex-col gap-1.5"
         onClick={() => {
            navigate(`/projects/${id}`);
         }}>
         <div className="flex items-center justify-between">
            <h1 className="text-md">{name}</h1>
            <span className={`text-xs ${statusColor(status ? status : "")} px-2 py-1.5 rounded-full text-xs`}>
               {status}
            </span>
         </div>
         <p className="text-white/60 text-sm">{description}</p>
         <div>
            <span className="price text-xs px-1 py-0.5 rounded-xl bg-[#212425]">
               {time_tracking ? `$${hourly_rate}` : `$${price}`}
            </span>{" "}
            <span className="timespent text-xs px-1 py-0.5 rounded-xl bg-[#212425]">1h spent</span>
         </div>
         <div className="flex items-center justify-between mt-2">
            <div className="flex items-center">
               <CiUser />
               <span className="text-sm text-white/85">{client.name}</span>
            </div>
            <div className="flex items-center">
               <CiCalendar />
               <span className="text-sm text-white/85">{formatDueDate(due_date)}</span>
            </div>
         </div>
      </div>
   );
};

export default ProjectCard;
