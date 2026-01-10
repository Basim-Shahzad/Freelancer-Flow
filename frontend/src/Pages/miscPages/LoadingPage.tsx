import React from "react";
import { Loader2, AlertCircle, FileQuestion } from "lucide-react";

// Loading Page Component
export const LoadingPage: React.FC = () => {
   return (
      <>
         <div className="invisible pl-[296px] hidden lg:sticky lg:top-0 lg:bottom-0 lg:left-0 lg:block"></div>
         <div className="fixed inset-0 bg-white dark:bg-gray-950 flex items-center justify-center">
            <div className="flex flex-col items-center gap-6 px-4">
               <div className="relative">
                  <Loader2 className="w-16 h-16 text-blue-600 dark:text-blue-400 animate-spin" />
                  <div className="absolute inset-0 w-16 h-16 border-4 border-blue-200 dark:border-blue-900 rounded-full animate-pulse"></div>
               </div>
               <div className="text-center space-y-2">
                  <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Loading</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 max-w-sm">
                     Please wait while we prepare everything for you
                  </p>
               </div>
               <div className="flex gap-2 mt-2">
                  <div className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full animate-bounce"></div>
               </div>
            </div>
         </div>
      </>
   );
};
