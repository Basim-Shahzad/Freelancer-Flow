import React, { useState, useRef, useEffect, useEffectEvent } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useApi } from '../../hooks/useApi.js';
import { useDashboard } from '@/hooks/useDashboard.js';

const data = [
   { name: 'Jan', value: 12400 },
   { name: 'Feb', value: 13800 },
   { name: 'Mar', value: 15200 },
   { name: 'Apr', value: 14600 },
   { name: 'May', value: 16800 },
   { name: 'Jun', value: 18200 },
   { name: 'Jul', value: 17400 },
   { name: 'Aug', value: 19600 },
   { name: 'Sep', value: 18880 },
   { name: 'Oct', value: 20100 },
   { name: 'Nov', value: 21500 },
   { name: 'Dec', value: 22800 },
];

const DashboardRevenueSection = () => {
   const { api } = useApi()
   const {revenue, error, isError, refreshDashboard, isLoading} = useDashboard()

   return (
      <div className="flex flex-1 flex-col gap-6 lg:flex-row lg:flex-wrap lg:gap-x-8 lg:gap-y-4">
         <div className="flex flex-col gap-2">
            <p className="text-[14px] font-medium text-[#94979c]">Revenue</p>
            <div className="flex items-start gap-2">
               <div className="flex items-start gap-0.5">
                  <span className="pt-2 text-xl font-medium">$</span>
                  <span className="text-[36px] font-semibold ">
                     {
                        isError ? error?.message : ''
                     }
                     {
                        isLoading ? "Loading..." : revenue
                     }
                  </span>
               </div>
               <div className="flex items-center gap-1">
                  <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor"
                     strokeWidth="2" fill="none" strokeLinejoin="round"
                     aria-hidden="true" className="stroke-[3px] size-4 text-[#47cd89]">
                     <path
                        d="m22 7-7.869 7.869c-.396.396-.594.594-.822.668a1 1 0 0 1-.618 0c-.228-.074-.426-.272-.822-.668L9.13 12.13c-.396-.396-.594-.594-.822-.668a1 1 0 0 0-.618 0c-.228.074-.426.272-.822.668L2 17M22 7h-7m7 0v7">
                     </path>
                  </svg>
                  <span className="text-[14px] font-medium text-[#47cd89]">7.4%</span>
               </div>
            </div>
         </div>
         <div
            className="flex h-50 w-full flex-col gap-2 lg:h-60 lg:min-w-[480px] lg:flex-1 xl:min-w-[560px]">
            <div className="recharts-responsive-container h-full">
               <div className="recharts-responsive-container h-full">
                  <ResponsiveContainer width="100%" height="100%">
                     <LineChart data={data}>
                        <Line type="monotone" dataKey="value" stroke="#8884d8" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                     </LineChart>
                  </ResponsiveContainer>
               </div>
            </div>
         </div>
      </div>
   )
}

export default DashboardRevenueSection