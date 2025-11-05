import React from 'react'


const stats = [
    { title: 'Pageviews', value: '50.8K', change: '+24.8%', positive: true },
    { title: 'Monthly users', value: '23.6K', change: '-12.8%', positive: false },
    { title: 'New sign ups', value: '756', change: '+19.3%', positive: true },
    { title: 'Subscriptions', value: '2.3K', change: '+13.5%', positive: true },
]


export default function TopStats() {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((s, idx) => (
                <div key={s.title} className="p-4 rounded-xl bg-white dark:bg-[#0b2136] shadow-sm">
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