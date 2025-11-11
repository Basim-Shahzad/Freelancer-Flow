import React from 'react'

const stats = [
    { title: 'Revenue', value: '5.8K', change: '+24.8%', positive: true },
    { title: 'Clients', value: '23.6K', change: '-12.8%', positive: false },
    { title: 'Projects', value: '756', change: '+19.3%', positive: true },
]

export default function TopStats() {
    return (
        <div className="grid grid-cols-3">
            {stats.map((s, idx) => (
                <div key={s.title} className="p-4 rounded-xl bg-white dark:bg-[#0b2136] shadow-sm mx-0.5">
                    <div className="flex items-center justify-between">
                        <div className="text-xs text-slate-500 dark:text-slate-300">{s.title}</div>
                        <div className="text-xs text-slate-500">...</div>
                    </div>
                    <div className="mt-3 flex items-baseline gap-3">
                        <div className="text-2xl font-semibold text-slate-900 dark:text-slate-50">{s.value}</div>
                        <div className={`text-sm ${s.positive ? 'text-emerald-400' : 'text-rose-400'}`}>{s.change}</div>
                    </div>
                </div>
            ))}
        </div>
    )
}