import React, { useState, useContext } from 'react'
import { Link } from 'react-router-dom'
import { IoIosArrowForward } from "react-icons/io";
import { IoIosArrowBack } from "react-icons/io";
import { ThemeContext } from '../../App';

export default function Sidebar() {
   const [open, setOpen] = useState(false)
   const { toggle, theme } = useContext(ThemeContext)
   const menu = ['Dashboard', 'Projects', 'Clients', 'Features']

   return (
      <aside className="z-20">
         {/* Mobile top bar */}
         <div className="md:hidden pl-1.5 py-6 bg-white flex justify-center flex-col gap-2 dark:bg-[#081028] border-b border-slate-200 dark:border-transparent">

            <div
               className="flex items-center"
               onClick={() => setOpen((s) => !s)}
            >

               <div className="w-8 h-8 rounded-md flex items-center justify-center bg-gradient-to-br from-[#7c3aed] to-[#2dd4bf] text-white font-bold">FF</div>
               {open ? <IoIosArrowBack className='text-white text-xl' /> : <IoIosArrowForward className='text-white text-lg' />}
            </div>

            <button onClick={toggle} aria-label="toggle theme" className="px-2 py-2 w-8 h-8 rounded-md bg-slate-100 dark:bg-[#082033]">
               {theme === 'dark' ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="#9FB0C8" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
               ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" stroke="#334155" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
               )}
            </button>

         </div>

         {/* Sidebar column */}
         <div className={`fixed inset-y-0 left-0 transform ${open ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:static transition-transform duration-200 ease-in-out w-72 bg-white dark:bg-[#081028] border-r border-slate-100/10 h-screen`}>
            <div className="h-full flex flex-col justify-between p-6">

               <div>
                  <div
                     onClick={() => setOpen((s) => !s)}
                     className="hiddene md:flex items-center gap-3 mb-6">
                     <div className="w-9 h-9 rounded-md flex items-center justify-center bg-gradient-to-br from-[#7c3aed] to-[#2dd4bf] text-white font-bold">FF</div>
                     <div>
                        <h1 className="text-lg font-semibold text-slate-50 "
                        >Freelancer Flow</h1>
                        <p className="text-xs text-slate-300">Analytics</p>
                     </div>
                  </div>


                  <div className="md:hidden mb-4 text-white">
                     <input className="w-full rounded-md py-2 px-3 bg-slate-100 dark:bg-[#04121F] placeholder:text-slate-400 outline-none text-sm" placeholder="Search for..." />
                  </div>


                  <nav className="space-y-2">
                     <input className="hidden md:block w-full rounded-md py-2 px-3 bg-[#04121F] placeholder:text-[#5b6f80] outline-none text-sm text-white" placeholder="Search for..." />


                     {menu.map((m, i) => (
                        <Link
                           key={m}
                           to={`/${m.toLowerCase()}`}
                           className={`py-2 px-3 rounded-md my-1 cursor-pointer flex items-center justify-between ${i === 0 ? 'bg-[#062033]' : 'hover:bg-[#041721]'} text-sm`}
                           onClick={() => setOpen((s) => !s)}
                        >
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