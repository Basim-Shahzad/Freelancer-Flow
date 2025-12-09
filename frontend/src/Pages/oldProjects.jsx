import React from 'react'
import { CiSearch } from "react-icons/ci";

const ProjectData = [
   {
      name : ''
   }
]

const Projects = () => {
   return (
      <div className='bg-[#081028] h-screen flex flex-col px-2.5 items-center '>

         <div className="top-bar py-4 sm:py-12 grid grid-cols-1 xl:grid-cols-2 gap-3 items-center justify-center">

            <div className='flex gap-8 items-center'>
               <h1 className='text-xl sm:text-3xl font-mono text-white'>Projects</h1>

               <div className='bg-[#0B1739] w-80 items-center h-[42px] flex border-[0.8px] rounded-lg border-slate-100/15'>
                  <CiSearch className='text-white/50 text-2xl mx-3' />
                  <input
                     type="text"
                     className='bg-[#0B1739] w-full h-[40px] bg-wehite py-3 focus:outline-0 rounded-lg text-slate-50/75 placeholder:select-none'
                     placeholder='Search for...'
                  />
               </div>
            </div>

            <div className='xl:flex xl:w-full xl:justify-end'>
               <button className='bg-[rgb(203,60,255)] hover:bg-[rgb(175,60,255)] transition-colors duration-100 cursor-pointer text-[13px] text-white px-8 py-1 xl:mr-7 w-19/20 sm:py-2 rounded-md xl:w-1/3 xl:h-max' >Create project</button>
            </div>

         </div>

         <div className='bg-[#0B1739] rounded-2xl w-19/20 h-16/20 border-[0.8px] border-slate-100/15' >

            <div className='w-full border-b-slate-100/15 px-6 py-6 border-b-[0.8px] flex justify-between items-center'>
               <h1 className='text-white text-lg sm:text-2xl' >All Projects</h1>
               <select className="bg-white text-black h-max sm:hidden" >
                  <option value={null} selected disabled >Sort by</option>
                  <option value="">Name</option>
                  <option value="">Date Added</option>
                  <option value="">Projects</option>
               </select>
            </div>

            <div className='w-full border-b-slate-100/15 px-6 py-6 border-b-[0.8px]' >

            </div>

         </div>


      </div>

   )
}

export default Projects