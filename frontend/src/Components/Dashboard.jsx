import React, { useContext } from 'react'
import Header from './Header'
import TopStats from './Stats'
import ProfitStats from './ProfitStats'
import RevenueChart from './RevenueChart'
import SessionsChart from './SessionsChart'
import { ThemeContext } from '../App'


export default function Dashboard() {
    const { toggle, theme } = useContext(ThemeContext)


    return (
        <div className="p-6 md:p-8 lg:p-10">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Welcome back, John</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-300">Measure your advertising ROI and report website traffic.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="px-3 py-2 rounded-md bg-white/60 dark:bg-[#071827] text-sm text-slate-900 dark:text-slate-100">Export data</button>
                    <button className="px-3 py-2 rounded-md bg-gradient-to-r from-[#7c3aed] to-[#2dd4bf] text-sm text-white">Create report</button>
                    <button onClick={toggle} aria-label="toggle theme" className="px-2 py-2 rounded-md bg-slate-100 dark:bg-[#082033]">
                        {theme === 'dark' ? (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="#9FB0C8" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" stroke="#334155" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        )}
                    </button>
                </div>
            </div>


            <TopStats />


            <div className="grid gap-6 mt-6 lg:grid-cols-3 lg:grid-rows-[auto_auto]">
                <div className="lg:col-span-2">
                    <RevenueChart />
                </div>


                <div className="space-y-6">
                    <ProfitStats />
                    <SessionsChart />
                </div>
            </div>
        </div>
    )
}