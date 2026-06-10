import React from "react";

const DashboardHeader = () => {
   return (
      <div className="flex flex-col gap-5 px-4 lg:px-8">
         <div className="relative flex flex-col gap-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
               <div className="flex flex-col gap-0.5 lg:gap-1">
                  <h1 className="text-2xl font-semibold  lg:text-display-xs">Dashboard</h1>
               </div>
            </div>
         </div>
         <div className="flex gap-3 lg:justify-between">
            <div
               className="relative z-0 inline-flex w-max -space-x-px rounded-lg shadow-xs"
               data-rac=""
               role="radiogroup"
               aria-orientation="horizontal"
               data-orientation="horizontal">
               <button
                  className="group/button-group inline-flex h-max cursor-pointer items-center font-semibold whitespace-nowrap text-white/80 shadow-skeumorphic ring-1 ring-white/10 outline-brand transition duration-100 ease-linear ring-inset hover_hover focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled disabled:text-disabled selected:bg-active selected:disabled:bg-disabled_subtle gap-1.5 px-4 py-2.5 text-sm not-last:pr-[calc(calc(var(--spacing)*4)+1px)] first:rounded-l-lg last:rounded-r-lg data-icon-leading:pl-3.5 data-icon-only:px-3"
                  data-rac=""
                  type="button"
                  data-react-aria-pressable="true"
                  role="radio"
                  aria-checked="true"
                  data-selected="true">
                  <span className="max-lg:hidden">12 months</span>
                  <span className="lg:hidden">12m</span>
               </button>
               <button
                  className="group/button-group inline-flex h-max cursor-pointer items-center font-semibold whitespace-nowrap text-white/80 shadow-skeumorphic ring-1 ring-white/10 outline-brand transition duration-100 ease-linear ring-inset hover_hover focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled disabled:text-disabled selected:bg-active selected:disabled:bg-disabled_subtle gap-1.5 px-4 py-2.5 text-sm not-last:pr-[calc(calc(var(--spacing)*4)+1px)] first:rounded-l-lg last:rounded-r-lg data-icon-leading:pl-3.5 data-icon-only:px-3"
                  data-rac=""
                  type="button"
                  data-react-aria-pressable="true"
                  role="radio"
                  aria-checked="false">
                  <span className="max-lg:hidden">30 days</span>
                  <span className="lg:hidden">30d</span>
               </button>
               <button
                  className="group/button-group inline-flex h-max cursor-pointer items-center font-semibold whitespace-nowrap text-white/80 shadow-skeumorphic ring-1 ring-white/10 outline-brand transition duration-100 ease-linear ring-inset hover_hover focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled disabled:text-disabled selected:bg-active selected:disabled:bg-disabled_subtle gap-1.5 px-4 py-2.5 text-sm not-last:pr-[calc(calc(var(--spacing)*4)+1px)] first:rounded-l-lg last:rounded-r-lg data-icon-leading:pl-3.5 data-icon-only:px-3"
                  data-rac=""
                  type="button"
                  data-react-aria-pressable="true"
                  role="radio"
                  aria-checked="false">
                  <span className="max-lg:hidden">7 days</span>
                  <span className="lg:hidden">7d</span>
               </button>
               <button
                  className="group/button-group inline-flex h-max cursor-pointer items-center font-semibold whitespace-nowrap text-white/80 shadow-skeumorphic ring-1 ring-white/10 outline-brand transition duration-100 ease-linear ring-inset hover_hover focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled disabled:text-disabled selected:bg-active selected:disabled:bg-disabled_subtle gap-1.5 px-4 py-2.5 text-sm not-last:pr-[calc(calc(var(--spacing)*4)+1px)] first:rounded-l-lg last:rounded-r-lg data-icon-leading:pl-3.5 data-icon-only:px-3"
                  data-rac=""
                  type="button"
                  data-react-aria-pressable="true"
                  role="radio"
                  aria-checked="false">
                  <span className="max-lg:hidden">24 hours</span>
                  <span className="lg:hidden">24h</span>
               </button>
            </div>
            <div className="hidden gap-3 lg:flex">
               <div className="react-aria-DateRangePicker" data-rac="">
                  <div
                     data-react-aria-pressable="true"
                     id="react-aria-_R_6j9bsnpfiv7b_"
                     aria-label="Date range picker"
                     aria-describedby="react-aria-_R_6j9bsnpfiv7bH3_ react-aria-_R_6j9bsnpfiv7bH4_"
                     role="group"
                     className="react-aria-Group"
                     data-rac="">
                     <button
                        id="react-aria-_R_6j9bsnpfiv7bH5_"
                        className="group relative inline-flex h-max cursor-pointer items-center justify-center whitespace-nowrap outline-brand transition duration-100 ease-linear before:absolute focus-visible:outline-2 focus-visible:outline-offset-2 in-data-input-wrapper:shadow-xs in-data-input-wrapper:focus:!z-50 in-data-input-wrapper:in-data-leading:-mr-px in-data-input-wrapper:in-data-leading:rounded-r-none in-data-input-wrapper:in-data-leading:before:rounded-r-none in-data-input-wrapper:in-data-trailing:-ml-px in-data-input-wrapper:in-data-trailing:rounded-l-none in-data-input-wrapper:in-data-trailing:before:rounded-l-none disabled:cursor-not-allowed disabled:text-fg-disabled disabled:*:data-icon:text-fg-disabled_subtle *:data-icon:pointer-events-none *:data-icon:size-5 *:data-icon:shrink-0 *:data-icon:transition-inherit-all gap-1 rounded-lg px-3.5 py-2.5 text-sm font-semibold before:rounded-[7px] data-icon-only:p-2.5 in-data-input-wrapper:gap-1.5 in-data-input-wrapper:px-4 in-data-input-wrapper:text-md in-data-input-wrapper:data-icon-only:p-3 text-white/80 shadow-xs-skeumorphic ring-1 ring-white/20 ring-inset hover_hover data-loading_hover disabled:shadow-xs disabled:ring-disabled_subtle *:data-icon:text-fg-quaternary hover:*:data-icon:text-fg-quaternary_hover"
                        data-rac=""
                        type="button"
                        data-react-aria-pressable="true"
                        aria-describedby="react-aria-_R_6j9bsnpfiv7bH3_ react-aria-_R_6j9bsnpfiv7bH4_"
                        aria-label="Calendar"
                        aria-labelledby="react-aria-_R_6j9bsnpfiv7bH5_ react-aria-_R_6j9bsnpfiv7b_"
                        aria-haspopup="dialog"
                        aria-expanded="false">
                        <svg
                           viewBox="0 0 24 24"
                           width="24"
                           height="24"
                           stroke="currentColor"
                           strokeWidth="2"
                           fill="none"
                           strokeLinejoin="round"
                           aria-hidden="true"
                           data-icon="leading"
                           className="pointer-events-none size-5 shrink-0 transition-inherit-all text-[#85888E] ">
                           <path d="M21 10H3m13-8v4M8 2v4m-.2 16h8.4c1.68 0 2.52 0 3.162-.327a3 3 0 0 0 1.311-1.311C21 19.72 21 18.88 21 17.2V8.8c0-1.68 0-2.52-.327-3.162a3 3 0 0 0-1.311-1.311C18.72 4 17.88 4 16.2 4H7.8c-1.68 0-2.52 0-3.162.327a3 3 0 0 0-1.311 1.311C3 6.28 3 7.12 3 8.8v8.4c0 1.68 0 2.52.327 3.162a3 3 0 0 0 1.311 1.311C5.28 22 6.12 22 7.8 22Z"></path>
                        </svg>
                        <span data-text="true" className="transition-inherit-all px-0.5">
                           <span className="text-placeholder">Select dates</span>
                        </span>
                     </button>
                  </div>
               </div>
               <button
                  className="group relative inline-flex h-max cursor-pointer items-center justify-center whitespace-nowrap outline-brand transition duration-100 ease-linear before:absolute focus-visible:outline-2 focus-visible:outline-offset-2 in-data-input-wrapper:shadow-xs in-data-input-wrapper:focus:!z-50 in-data-input-wrapper:in-data-leading:-mr-px in-data-input-wrapper:in-data-leading:rounded-r-none in-data-input-wrapper:in-data-leading:before:rounded-r-none in-data-input-wrapper:in-data-trailing:-ml-px in-data-input-wrapper:in-data-trailing:rounded-l-none in-data-input-wrapper:in-data-trailing:before:rounded-l-none disabled:cursor-not-allowed disabled:text-fg-disabled disabled:*:data-icon:text-fg-disabled_subtle *:data-icon:pointer-events-none *:data-icon:size-5 *:data-icon:shrink-0 *:data-icon:transition-inherit-all gap-1 rounded-lg px-3.5 py-2.5 text-sm font-semibold before:rounded-[7px] data-icon-only:p-2.5 in-data-input-wrapper:gap-1.5 in-data-input-wrapper:px-4 in-data-input-wrapper:text-md in-data-input-wrapper:data-icon-only:p-3 text-white/80 shadow-xs-skeumorphic ring-1 ring-white/20 ring-inset hover_hover data-loading_hover disabled:shadow-xs disabled:ring-disabled_subtle *:data-icon:text-fg-quaternary hover:*:data-icon:text-fg-quaternary_hover"
                  data-rac=""
                  type="button"
                  data-react-aria-pressable="true"
                  id="react-aria-_R_aj9bsnpfiv7b_">
                  <svg
                     viewBox="0 0 24 24"
                     width="24"
                     height="24"
                     stroke="currentColor"
                     strokeWidth="2"
                     fill="none"
                     strokeLinejoin="round"
                     aria-hidden="true"
                     data-icon="leading"
                     className="pointer-events-none size-5 shrink-0 transition-inherit-all text-[#85888E]">
                     <path d="M6 12h12M3 6h18M9 18h6"></path>
                  </svg>
                  <span data-text="true" className="transition-inherit-all px-0.5">
                     Filters
                  </span>
               </button>
            </div>
            <div className="lg:hidden">
               <button
                  data-icon-only="true"
                  className="group relative inline-flex h-max cursor-pointer items-center justify-center whitespace-nowrap outline-brand transition duration-100 ease-linear before:absolute focus-visible:outline-2 focus-visible:outline-offset-2 in-data-input-wrapper:shadow-xs in-data-input-wrapper:focus:!z-50 in-data-input-wrapper:in-data-leading:-mr-px in-data-input-wrapper:in-data-leading:rounded-r-none in-data-input-wrapper:in-data-leading:before:rounded-r-none in-data-input-wrapper:in-data-trailing:-ml-px in-data-input-wrapper:in-data-trailing:rounded-l-none in-data-input-wrapper:in-data-trailing:before:rounded-l-none disabled:cursor-not-allowed disabled:text-fg-disabled disabled:*:data-icon:text-fg-disabled_subtle *:data-icon:pointer-events-none *:data-icon:size-5 *:data-icon:shrink-0 *:data-icon:transition-inherit-all gap-1 rounded-lg px-3.5 py-2.5 text-sm font-semibold before:rounded-[7px] data-icon-only:p-2.5 in-data-input-wrapper:gap-1.5 in-data-input-wrapper:px-4 in-data-input-wrapper:text-md in-data-input-wrapper:data-icon-only:p-3 shadow-xs-skeumorphic ring-1 ring-white/75 ring-inset hover_hover data-loading_hover disabled:shadow-xs disabled:ring-disabled_subtle *:data-icon:text-fg-quaternary hover:*:data-icon:text-fg-quaternary_hover"
                  data-rac=""
                  type="button"
                  data-react-aria-pressable="true"
                  id="react-aria-_R_3j9bsnpfiv7b_">
                  <svg
                     viewBox="0 0 24 24"
                     width="24"
                     height="24"
                     stroke="currentColor"
                     strokeWidth="2"
                     fill="none"
                     strokeLinejoin="round"
                     aria-hidden="true"
                     data-icon="leading"
                     className="pointer-events-none size-5 shrink-0 transition-inherit-all">
                     <path d="M6 12h12M3 6h18M9 18h6"></path>
                  </svg>
               </button>
            </div>
         </div>
      </div>
   );
};

export default DashboardHeader;
