import React, { useState } from 'react'
import { Link } from 'react-router-dom'


export default function Sidebar() {
    const [open, setOpen] = useState(false)
    const menu = ['Dashboard', 'All pages', 'Reports', 'Products', 'Task', 'Features', 'Users', 'Pricing', 'Integrations']


    return (
        <aside className="z-20">
            {/* Mobile top bar */}
            <div className="md:hidden flex flex-col items-center justify-between px-4 py-3 bg-white dark:bg-[#061428] border-b border-slate-200 dark:border-transparent">
                <button aria-label="toggle menu" onClick={() => setOpen((s) => !s)} className="p-2 rounded-md bg-slate-100 dark:bg-[#082033]">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 6h16M4 12h16M4 18h16" stroke="#9FB0C8" strokeWidth="1.5" strokeLinecap="round" /></svg>
                </button>
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md flex items-center justify-center bg-gradient-to-br from-[#7c3aed] to-[#2dd4bf] text-white font-bold">FF</div>
                    {/* <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Freelancer Flow</div> */}
                </div>
            </div>


            {/* Sidebar column */}
            <div className={`fixed inset-y-0 left-0 transform ${open ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:static transition-transform duration-200 ease-in-out w-72 bg-white dark:bg-[#0A1628] border-r border-slate-200 dark:border-transparent`}>
                <div className="h-full flex flex-col justify-between p-6">
                    <div>
                        <div className="hidden md:flex items-center gap-3 mb-6">
                            <div className="w-9 h-9 rounded-md flex items-center justify-center bg-gradient-to-br from-[#7c3aed] to-[#2dd4bf] text-white font-bold">FF</div>
                            <div>
                                <h1 className="text-lg font-semibold text-slate-50">Freelancer Flow</h1>
                                <p className="text-xs text-slate-300">Analytics</p>
                            </div>
                        </div>


                        <div className="md:hidden mb-4 text-white">
                            <input className="w-full rounded-md py-2 px-3 bg-slate-100 dark:bg-[#04121F] placeholder:text-slate-400 outline-none text-sm" placeholder="Search for..." />
                        </div>


                        <nav className="space-y-2">
                            <input className="hidden md:block w-full rounded-md py-2 px-3 bg-[#04121F] placeholder:text-[#5b6f80] outline-none text-sm" placeholder="Search for..." />


                            {menu.map((m, i) => (
                                <Link key={m} to={m == 'Dashboard' ? '/dashboard' : ''} className={`py-2 px-3 rounded-md my-1 cursor-pointer flex items-center justify-between ${i === 0 ? 'bg-[#062033]' : 'hover:bg-[#041721]'} text-sm`}>
                                    <div className={`${i === 0 ? 'text-white' : 'text-slate-300'}`}>{m}</div>
                                    {i === 2 && <div className="text-xs text-[#7c3aed]">●</div>}
                                </Link>
                            ))}
                        </nav>
                    </div>


                    <div className="mt-6">
                        <div className="flex items-center gap-3 mb-3">
                            <img src="https://i.pravatar.cc/40" alt="avatar" className="rounded-full" />
                            <div>
                                <div className="text-sm font-medium text-slate-50">John Carter</div>
                                <div className="text-xs text-slate-400">Account settings</div>
                            </div>
                        </div>
                        <button className="w-full py-2 rounded-md text-sm font-medium text-white" style={{ background: 'linear-gradient(90deg,#7c3aed,#2dd4bf)' }}>
                            Get template →
                        </button>
                    </div>
                </div>
            </div>
        </aside>
    )
}