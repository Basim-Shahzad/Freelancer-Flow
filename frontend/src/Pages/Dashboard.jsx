import React, { useContext } from 'react'
import Header from '../Components/Header'
import TopStats from '../components/features/dashboardComponents/TopStats'
import ProfitStats from '../components/features/dashboardComponents/ProfitStats'
import RevenueChart from '../components/features/dashboardComponents/RevenueChart'
import SessionsChart from '../components/features/dashboardComponents/SessionsChart'
import { ThemeContext } from '../App'

export default function Dashboard() {

   return (
      <div className="py-6 px-1 pr-5 md:p-8 lg:p-10">

         <div className="grid grid-cols-2 grid-row-2 items-center justify-between mb-3 xl:mb-6">

            <div className='col-span-2 xl:col-span-1' >
               <h2 className="text-2xl md:text-2xl font-semibold text-slate-900 dark:text-slate-100">Welcome back, John</h2>
               <p className="text-xs md:text-sm text-slate-500 dark:text-slate-300">Measure your freelancing clients and projects.</p>
            </div>

            <div className='row-start-2 col-span-2 flex justify-end gap-2 mt-2 xl:col-span-1 xl:row-start-1 xl:col-end-3' >
               <button className="px-2 py-2 w-1/2 xl:w-1/4 rounded-md bg-white/60 dark:bg-[#071827] text-xs md:text-sm text-slate-900 dark:text-slate-100">Export data</button>
               <button className="px-2 py-2 w-1/2 xl:w-1/4 rounded-md bg-gradient-to-r from-[#7c3aed] to-[#2dd4bf] text-xs md:text-sm text-white">Create project</button>
            </div>

         </div>

         <div className='grid grid-cols-3 grid-row-2 p-0.5' >
            <div className='col-span-2 p-2 flex flex-col gap-2' >
               <TopStats />
               <RevenueChart />
            </div>
            <div className='h-full p-2 flex flex-col gap-2' >
               <ProfitStats />
               <SessionsChart />
            </div>
         </div>

      </div>
   )
}