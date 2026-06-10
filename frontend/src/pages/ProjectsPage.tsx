import React, { useState, useContext } from 'react'
import MobileHeader from '../layout/MobileHeader.jsx'
import ProjectsHeader from '../features/projects/components/ProjectsHeader.jsx'
import ProjectGrid from '@/features/projects/components/ProjectGrid.js'

const Projects = () => {

   return (
      <div className="flex flex-col lg:flex-row bg-white text-black dark:bg-[#000000] dark:text-white transition-colors duration-300">

         <header>
            <MobileHeader />
         </header>

         <div className="invisible pl-[296px] hidden lg:sticky lg:top-0 lg:bottom-0 lg:left-0 lg:block">
         </div>

         <main className='min-w-0 flex-1 pt-8 pb-12' >
            <div className="flex flex-col gap-8" >
               <ProjectsHeader />

               <div className="flex flex-col gap-6 px-4 lg:px-8">
                  <ProjectGrid />
               </div>

            </div>
         </main>
      </div>
   )
}

export default Projects
