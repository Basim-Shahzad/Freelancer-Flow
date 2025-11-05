import React from 'react'


// simple helper to build a path from points
function buildPath(points, w, h) {
    if (!points || points.length === 0) return ''
    let d = ''
    points.forEach((p, i) => {
        const x = (i / (points.length - 1)) * w
        const y = h - (p / Math.max(...points)) * h
        d += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`
    })
    return d
}


export default function RevenueChart() {
    // sample numeric series to draw two lines
    const revenue = [30, 45, 38, 72, 52, 125, 98, 145, 160, 180, 210, 240]
    const expenses = [20, 30, 27, 48, 36, 78, 70, 90, 110, 120, 140, 164]
    const w = 800
    const h = 300
    const revPath = buildPath(revenue, w, h)
    const expPath = buildPath(expenses, w, h)


    return (
        <div className="bg-white dark:bg-[#0b2136] rounded-xl p-6 shadow-sm">
            <div className="flex items-start justify-between">
                <div>
                    <div className="text-sm text-slate-500 dark:text-slate-300">Total revenue</div>
                    <div className="text-2xl font-bold text-slate-900 dark:text-slate-50">$240.8K <span className="text-sm text-emerald-400">24.6% ↑</span></div>
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-300">Jan 2024 - Dec 2024</div>
            </div>


            <div className="mt-6 w-full overflow-x-auto">
                {/* SVG chart scales with container width thanks to viewBox */}
                <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-64">
                    <defs>
                        <linearGradient id="gRev" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.35" />
                            <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.03" />
                        </linearGradient>
                        <linearGradient id="gExp" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.25" />
                            <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0.03" />
                        </linearGradient>
                    </defs>


                    {/* grid lines */}
                    {[0, 1, 2, 3, 4].map(i => (
                        <line key={i} x1={0} x2={w} y1={(i / 4) * h} y2={(i / 4) * h} stroke="#0f2433" strokeWidth={1} />
                    ))}


                    {/* fill areas (approx) */}
                    <path d={`${revPath} L ${w} ${h} L 0 ${h} Z`} fill="url(#gRev)" />
                    <path d={`${expPath} L ${w} ${h} L 0 ${h} Z`} fill="url(#gExp)" />


                    {/* lines */}
                    <path d={revPath} fill="none" stroke="#7c3aed" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
                    <path d={expPath} fill="none" stroke="#2dd4bf" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />


                    {/* x labels (months) */}
                    {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => (
                        <text key={m} x={(i / 11) * w} y={h - 6} fontSize={10} fill="#93c5fd">{m}</text>
                    ))}
                </svg>
            </div>
        </div>
    )
}