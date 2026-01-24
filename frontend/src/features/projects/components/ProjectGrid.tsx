import React from "react";
import type { Project } from "@/types/models.js";
import ProjectCard from "./ProjectCard.js";
import "@/Styles/projects.css";
import { useProjects } from "../hooks.js";
import { Spinner, Button } from "@heroui/react";
import { IoChevronBack, IoChevronForward } from "react-icons/io5";

const ProjectGrid = () => {
   const [pagination, setPagination] = React.useState({
      pageIndex: 0,
      pageSize: 12,
   });

   const { data: response, isLoading, isError } = useProjects(pagination.pageIndex + 1, pagination.pageSize);
   
   const projects = response?.items ?? [];
   const totalCount = response?.total ?? 0;
   const totalPages = Math.ceil(totalCount / pagination.pageSize);

   const canPrevious = pagination.pageIndex > 0;
   const canNext = pagination.pageIndex < totalPages - 1;

   const handlePrevious = () => {
      if (canPrevious) {
         setPagination(prev => ({ ...prev, pageIndex: prev.pageIndex - 1 }));
      }
   };

   const handleNext = () => {
      if (canNext) {
         setPagination(prev => ({ ...prev, pageIndex: prev.pageIndex + 1 }));
      }
   };

   if (isLoading) {
      return (
         <div className="flex justify-center items-center py-20">
            <Spinner color="secondary" size="lg" />
         </div>
      );
   }

   if (isError) {
      return (
         <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 dark:bg-red-500/20 mb-4">
               <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
               </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Failed to load projects</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Please try again later</p>
         </div>
      );
   }

   if (projects.length === 0) {
      return (
         <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
               <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
               </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No projects yet</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Create your first project to get started</p>
         </div>
      );
   }

   return (
      <div className="space-y-6">
         {/* Projects Grid */}
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {projects.map((p: Project) => (
               <ProjectCard key={p.id} project={p} />
            ))}
         </div>

         {/* Pagination */}
         {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-4 bg-white dark:bg-gray-950 border border-gray-200 dark:border-white/10 rounded-xl">
               <div className="flex items-center gap-2">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                     Page <span className="font-semibold text-gray-900 dark:text-white">{pagination.pageIndex + 1}</span> of{" "}
                     <span className="font-semibold text-gray-900 dark:text-white">{totalPages}</span>
                  </p>
                  <span className="text-xs text-gray-500 dark:text-gray-500">
                     ({totalCount} total)
                  </span>
               </div>

               <div className="flex items-center gap-2">
                  <button
                     onClick={handlePrevious}
                     disabled={!canPrevious}
                     className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-300 dark:border-white/20 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white dark:disabled:hover:bg-gray-900 transition-all duration-200">
                     <IoChevronBack className="text-base" />
                     <span className="hidden sm:inline">Previous</span>
                  </button>
                  
                  <button
                     onClick={handleNext}
                     disabled={!canNext}
                     className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-300 dark:border-white/20 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white dark:disabled:hover:bg-gray-900 transition-all duration-200">
                     <span className="hidden sm:inline">Next</span>
                     <IoChevronForward className="text-base" />
                  </button>
               </div>
            </div>
         )}
      </div>
   );
};

export default ProjectGrid;