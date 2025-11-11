import React from 'react'


export default function ProfitStats() {
    const data = [12, 18, 25, 20, 30, 28]
    const max = Math.max(...data)
    return (
        <div className="bg-white dark:bg-[#0b2136] rounded-xl p-5 shadow-sm h-1/2">
            <div className="flex items-center justify-between">
                <div>
                    <div className="text-sm text-slate-500 dark:text-slate-300">Time Spent</div>
                    <div className="text-xl font-bold text-slate-900 dark:text-slate-50">$144.6K <span className="text-sm text-emerald-400">+24.5%</span></div>
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-300">Last 12 months</div>
            </div>


            <div className="mt-4 flex gap-2 items-end h-28">
                {data.map((v, i) => (
                    <div key={i} className="flex-1 flex items-end justify-center">
                        <div style={{ height: `${(v / max) * 100}%` }} className="w-3 rounded-t-md bg-gradient-to-b from-[#7c3aed] to-[#a78bfa]" />
                    </div>
                ))}
            </div>
        </div>
    )
}