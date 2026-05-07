import { clientsApi } from "@/features/clients/api.js";
import type React from "react";
import { FiTrendingUp, FiTrendingDown } from "react-icons/fi";

type DashboardStatsProps = {
   projectsTotal: number;
   clientsTotal: number;
   paidClients: number;
};

type MetricProps = {
   label: string;
   total: number;
   percentage: number;
};

const Metric: React.FC<MetricProps> = ({ label, percentage, total }) => {
   return (
      <div className="flex flex-col gap-2">
         <dt className="text-[14px] font-medium text-[#94979c]">{label}</dt>
         <dd className="flex items-start gap-2">
            <span className="text-[30px] font-semibold text-[#f7f7f7]">{total}</span>
            <div className="flex items-center gap-1">
               {percentage > 0 ? (
                  <FiTrendingUp className="text-green-600" />
               ) : (
                  <FiTrendingDown className="text-red-600" />
               )}
               <span className={`text-sm font-medium ${percentage > 0 ? "text-green-500" : "text-red-500"} `}>
                  {percentage}%
               </span>
            </div>
         </dd>
      </div>
   );
};

const DashboardStats: React.FC<DashboardStatsProps> = ({ clientsTotal, paidClients, projectsTotal }) => {
   const metrics = [
      { label: "Total Clients", total: clientsTotal, percentage: 10 },
      { label: "Total Clients", total: paidClients, percentage: 10 },
      { label: "Total Projects", total: projectsTotal, percentage: -1 },
   ];
   return (
      <dl className="flex w-full max-w-60 flex-col gap-5">
         {metrics.map((m) => (
            <Metric key={m.label} label={m.label} total={m.total} percentage={m.percentage} />
         ))}
      </dl>
   );
};

export default DashboardStats;
