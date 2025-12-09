import React, { useState, useRef, useEffect, useEffectEvent } from "react";
import { useApi } from "../../../Contexts/Api";

const DashboardStats = () => {
   const { api } = useApi();

   const [clientsTotal, setClientsTotal] = useState(0);
   const [projectsTotal, setProjectsTotal] = useState(0);
   const [error, setError] = useState("");
   const [loading, setLoading] = useState(false);

   useEffect(() => {
      fetchStats();
   }, []);

   const fetchStats = async () => {
      try {
         setLoading(true);
         const resClientsTotal = await api.get("/clients-total/");
         const resProjectsTotal = await api.get("/projects-total/");
         setClientsTotal(resClientsTotal.data.clientsTotal);
         setProjectsTotal(resProjectsTotal.data.projectsTotal);
      } catch (error) {
         setError(error);
      } finally {
         setLoading(false);
      }
   };

   return (
      <dl className="flex w-full max-w-60 flex-col gap-5">
         <div className="flex flex-col gap-2">
            <dt className="text-[14px] font-medium text-[#94979c]">
               Total Clients
            </dt>
            <dd className="flex items-start gap-2">
               <span className="text-[30px] font-semibold text-[#f7f7f7]">
                  {clientsTotal}
               </span>
               <div className="flex items-center gap-1">
                  <svg
                     viewBox="0 0 24 24"
                     width="24"
                     height="24"
                     stroke="currentColor"
                     strokeWidth="2"
                     fill="none"
                     strokeLinejoin="round"
                     strokeLinejoin="round"
                     aria-hidden="true"
                     className="stroke-[3px] size-4 text-[#47cd89]">
                     <path d="m22 7-7.869 7.869c-.396.396-.594.594-.822.668a1 1 0 0 1-.618 0c-.228-.074-.426-.272-.822-.668L9.13 12.13c-.396-.396-.594-.594-.822-.668a1 1 0 0 0-.618 0c-.228.074-.426.272-.822.668L2 17M22 7h-7m7 0v7"></path>
                  </svg>
                  <span className="text-sm font-medium text-[#47cd89]">9.2%</span>
               </div>
            </dd>
         </div>
         <div className="flex flex-col gap-2">
            <dt className="text-[14px] font-medium text-[#94979c]">Paid Clients</dt>
            <dd className="flex items-start gap-2">
               <span className="text-[30px] font-semibold text-[#f7f7f7]">42</span>
               <div className="flex items-center gap-1">
                  <svg
                     viewBox="0 0 24 24"
                     width="24"
                     height="24"
                     stroke="currentColor"
                     strokeWidth="2"
                     fill="none"
                     strokeLinejoin="round"
                     strokeLinejoin="round"
                     aria-hidden="true"
                     className="stroke-[3px] size-4 text-[#47cd89]">
                     <path d="m22 7-7.869 7.869c-.396.396-.594.594-.822.668a1 1 0 0 1-.618 0c-.228-.074-.426-.272-.822-.668L9.13 12.13c-.396-.396-.594-.594-.822-.668a1 1 0 0 0-.618 0c-.228.074-.426.272-.822.668L2 17M22 7h-7m7 0v7"></path>
                  </svg>
                  <span className="text-sm font-medium text-[#47cd89]">6.6%</span>
               </div>
            </dd>
         </div>
         <div className="flex flex-col gap-2">
            <dt className="text-[14px] font-medium text-[#94979c]">
               Total Projects
            </dt>
            <dd className="flex items-start gap-2">
               <span className="text-[30px] font-semibold text-[#f7f7f7]">
                  {projectsTotal}
               </span>
               <div className="flex items-center gap-1">
                  <svg
                     viewBox="0 0 24 24"
                     width="24"
                     height="24"
                     stroke="currentColor"
                     strokeWidth="2"
                     fill="none"
                     strokeLinejoin="round"
                     strokeLinejoin="round"
                     aria-hidden="true"
                     className="stroke-[3px] size-4 text-[#47cd89]">
                     <path d="m22 7-7.869 7.869c-.396.396-.594.594-.822.668a1 1 0 0 1-.618 0c-.228-.074-.426-.272-.822-.668L9.13 12.13c-.396-.396-.594-.594-.822-.668a1 1 0 0 0-.618 0c-.228.074-.426.272-.822.668L2 17M22 7h-7m7 0v7"></path>
                  </svg>
                  <span className="text-sm font-medium text-[#47cd89]">8.1%</span>
               </div>
            </dd>
         </div>
      </dl>
   );
};

export default DashboardStats;
