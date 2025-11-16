import React from 'react'

const DashboardStats = () => {
   return (
      <dl class="flex w-full max-w-60 flex-col gap-5">
         <div class="flex flex-col gap-2">
            <dt class="text-[14px] font-medium text-[#94979c]">Total Clients</dt>
            <dd class="flex items-start gap-2">
               <span class="text-[30px] font-semibold text-[#f7f7f7]">69</span>
               <div class="flex items-center gap-1">
                  <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor"
                     stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"
                     aria-hidden="true" class="stroke-[3px] size-4 text-[#47cd89]">
                     <path
                        d="m22 7-7.869 7.869c-.396.396-.594.594-.822.668a1 1 0 0 1-.618 0c-.228-.074-.426-.272-.822-.668L9.13 12.13c-.396-.396-.594-.594-.822-.668a1 1 0 0 0-.618 0c-.228.074-.426.272-.822.668L2 17M22 7h-7m7 0v7">
                     </path>
                  </svg>
                  <span class="text-sm font-medium text-[#47cd89]">9.2%</span>
               </div>
            </dd>
         </div>
         <div class="flex flex-col gap-2">
            <dt class="text-[14px] font-medium text-[#94979c]">Paid Clients</dt>
            <dd class="flex items-start gap-2">
               <span class="text-[30px] font-semibold text-[#f7f7f7]">42</span>
               <div class="flex items-center gap-1">
                  <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor"
                     stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"
                     aria-hidden="true" class="stroke-[3px] size-4 text-[#47cd89]">
                     <path
                        d="m22 7-7.869 7.869c-.396.396-.594.594-.822.668a1 1 0 0 1-.618 0c-.228-.074-.426-.272-.822-.668L9.13 12.13c-.396-.396-.594-.594-.822-.668a1 1 0 0 0-.618 0c-.228.074-.426.272-.822.668L2 17M22 7h-7m7 0v7">
                     </path>
                  </svg>
                  <span class="text-sm font-medium text-[#47cd89]">6.6%</span>
               </div>
            </dd>
         </div>
         <div class="flex flex-col gap-2">
            <dt class="text-[14px] font-medium text-[#94979c]">Total Projects</dt>
            <dd class="flex items-start gap-2">
               <span class="text-[30px] font-semibold text-[#f7f7f7]">70</span>
               <div class="flex items-center gap-1">
                  <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor"
                     stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"
                     aria-hidden="true" class="stroke-[3px] size-4 text-[#47cd89]">
                     <path
                        d="m22 7-7.869 7.869c-.396.396-.594.594-.822.668a1 1 0 0 1-.618 0c-.228-.074-.426-.272-.822-.668L9.13 12.13c-.396-.396-.594-.594-.822-.668a1 1 0 0 0-.618 0c-.228.074-.426.272-.822.668L2 17M22 7h-7m7 0v7">
                     </path>
                  </svg>
                  <span class="text-sm font-medium text-[#47cd89]">8.1%</span>
               </div>
            </dd>
         </div>
      </dl>
   )
}

export default DashboardStats