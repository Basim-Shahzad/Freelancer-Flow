import React from 'react'

export default function SessionsChart() {
    const points = [40, 80, 60, 120, 70, 90, 55]
    const w = 300
    const h = 120
    const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${(i / (points.length - 1)) * w} ${h - (p / Math.max(...points)) * h}`).join(' ')


    return (
        <div className="bg-white dark:bg-[#0b2136] rounded-xl p-5 shadow-sm h-1/2">
            <div className="flex items-center justify-between">
                <div>
                    <div className="text-sm text-slate-500 dark:text-slate-300">Total sessions</div>
                    <div className="text-xl font-bold text-slate-900 dark:text-slate-50">400 <span className="text-sm text-emerald-400">+18.9%</span></div>
                </div>
                <div className="text-xs text-slate-400">Live • 10k visitors</div>
            </div>


            <div className="mt-4 w-full">
                <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-24" preserveAspectRatio="none">
                    <path d={d} fill="none" stroke="#7c3aed" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </div>
        </div>
    )
}