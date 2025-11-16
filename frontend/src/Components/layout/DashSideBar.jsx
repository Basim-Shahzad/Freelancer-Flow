import React, { useContext } from 'react'
import { ThemeContext } from '../../App'
import { CiDark } from 'react-icons/ci';
import { CiLight } from 'react-icons/ci';
import { Link } from 'react-router-dom';
import { useAuth } from '../../Contexts/AuthContext';
import ff from '../../assets/FF.png'

const DashSideBar = () => {
   const { theme, toggle } = useContext(ThemeContext);
   const { user } = useAuth();

   return (
      <>
         <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex">
            <aside
               className="flex h-full w-full max-w-[296px] flex-col justify-between overflow-auto bg-primary pt-4 lg:w-(--width) lg:pt-6 md:border-r border-white/10">
               <div className="flex flex-col gap-5 px-4 lg:px-5">
                  <div className="flex w-full items-center justify-start overflow-visible h-8">

                     <div className="aspect-[0.3] h-full"></div>

                     <div className='flex justify-between w-full items-center' >
                        <div className='flex items-center gap-1' >
                           <img src={ff} alt='ff' className='w-10 rounded-xl hidden' />
                           <div className='text-xl font-semibold' >FreelancerFlow</div>
                        </div>
                        <button onClick={toggle} className='bg-gray-100 px-2 py-2 rounded-xl text-black font-black cursor-pointer' >
                           {theme === "dark" ? <CiLight /> : <CiDark />}
                        </button>
                     </div>

                  </div>
                  <div data-input-wrapper="true"
                     className="group flex h-max w-full flex-col items-start justify-start gap-1.5" data-rac="">
                     <div role="presentation"
                        className="relative flex w-full flex-row place-content-center place-items-center rounded-lg bg-primary shadow-xs ring-1 ring-white/20 transition-shadow duration-100 ease-linear ring-inset group-disabled:cursor-not-allowed group-disabled:bg-disabled_subtle group-disabled:ring-disabled group-invalid:ring-error_subtle">
                        <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2"
                           fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
                           className="pointer-events-none absolute size-5 text-[#85888E] left-3">
                           <path d="m21 21-3.5-3.5m2.5-6a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0Z"></path>
                        </svg>
                        <input type="text" placeholder="Search"
                           className="m-0 w-full bg-transparent text-md text-primary ring-0 outline-hidden placeholder:text-black/60 dark:placeholder:text-white/60 autofill:rounded-lg autofill:text-primary px-3 py-2 pl-10"
                        />
                        <div
                           className="pointer-events-none absolute inset-y-0.5 right-0.5 z-10 flex items-center rounded-r-[inherit] bg-linear-to-r from-transparent to-bg-primary to-40% pl-8 pr-2.5">
                           <span
                              className="pointer-events-none rounded px-1 py-px text-xs font-medium text-quaternary ring-1 ring-secondary select-none ring-[#85888E] text-[#85888E]"
                              aria-hidden="true">Ctrl-K</span>
                        </div>
                     </div>

                  </div>
               </div>
               <ul className="mt-4 flex flex-col px-2 lg:px-4">
                  <li className="py-0.5">
                     <Link to={'/'} className="px-3 py-2 group relative flex w-full cursor-pointer items-center rounded-md bg-primary outline-focus-ring transition duration-100 ease-linear select-none hover:bg-primary_hover focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2">
                        <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2"
                           fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
                           className="mr-2 size-5 shrink-0 text-[#85888E] transition-inherit-all">
                           <path
                              d="M8 17h8M11.018 2.764 4.235 8.039c-.453.353-.68.53-.843.75a2 2 0 0 0-.318.65C3 9.704 3 9.991 3 10.565V17.8c0 1.12 0 1.68.218 2.108a2 2 0 0 0 .874.874C4.52 21 5.08 21 6.2 21h11.6c1.12 0 1.68 0 2.108-.218a2 2 0 0 0 .874-.874C21 19.48 21 18.92 21 17.8v-7.235c0-.574 0-.861-.074-1.126a2.002 2.002 0 0 0-.318-.65c-.163-.22-.39-.397-.843-.75l-6.783-5.275c-.351-.273-.527-.41-.72-.462a1 1 0 0 0-.523 0c-.194.052-.37.189-.721.462Z">
                           </path>
                        </svg>
                        <span
                           className="flex-1 text-md font-semibold text-secondary transition-inherit-all group-hover:text-secondary_hover truncate">Home</span>
                     </Link>
                  </li>
                  <li className="py-0.5">
                     <Link to={'/dashboard'} className="px-3 py-2 group relative flex w-full cursor-pointer items-center rounded-md outline-focus-ring transition duration-100 ease-linear select-none focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 bg-active hover:bg-secondary_hover">
                        <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2"
                           fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
                           className="mr-2 size-5 shrink-0 text-[#85888E] transition-inherit-all">
                           <path
                              d="M8 15v2m4-6v6m4-10v10m-8.2 4h8.4c1.68 0 2.52 0 3.162-.327a3 3 0 0 0 1.311-1.311C21 18.72 21 17.88 21 16.2V7.8c0-1.68 0-2.52-.327-3.162a3 3 0 0 0-1.311-1.311C18.72 3 17.88 3 16.2 3H7.8c-1.68 0-2.52 0-3.162.327a3 3 0 0 0-1.311 1.311C3 5.28 3 6.12 3 7.8v8.4c0 1.68 0 2.52.327 3.162a3 3 0 0 0 1.311 1.311C5.28 21 6.12 21 7.8 21Z">
                           </path>
                        </svg>
                        <span
                           className="flex-1 text-md font-semibold transition-inherit-all group-hover:text-secondary_hover truncate text-secondary_hover">Dashboard</span>
                     </Link>
                  </li>
                  <li className="py-0.5">
                     <Link to={'/projects'} className="px-3 py-2 group relative flex w-full cursor-pointer items-center rounded-md bg-primary outline-focus-ring transition duration-100 ease-linear select-none hover:bg-primary_hover focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2">
                        <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2"
                           fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
                           className="mr-2 size-5 shrink-0 text-[#85888E] transition-inherit-all">
                           <path
                              d="M17.8 10c1.12 0 1.68 0 2.108-.218a2 2 0 0 0 .874-.874C21 8.48 21 7.92 21 6.8v-.6c0-1.12 0-1.68-.218-2.108a2 2 0 0 0-.874-.874C19.48 3 18.92 3 17.8 3H6.2c-1.12 0-1.68 0-2.108.218a2 2 0 0 0-.874.874C3 4.52 3 5.08 3 6.2v.6c0 1.12 0 1.68.218 2.108a2 2 0 0 0 .874.874C4.52 10 5.08 10 6.2 10h11.6Zm0 11c1.12 0 1.68 0 2.108-.218a2 2 0 0 0 .874-.874C21 19.48 21 18.92 21 17.8v-.6c0-1.12 0-1.68-.218-2.108a2 2 0 0 0-.874-.874C19.48 14 18.92 14 17.8 14H6.2c-1.12 0-1.68 0-2.108.218a2 2 0 0 0-.874.874C3 15.52 3 16.08 3 17.2v.6c0 1.12 0 1.68.218 2.108a2 2 0 0 0 .874.874C4.52 21 5.08 21 6.2 21h11.6Z">
                           </path>
                        </svg>
                        <span
                           className="flex-1 text-md font-semibold text-secondary transition-inherit-all group-hover:text-secondary_hover truncate">Projects</span>
                     </Link>
                  </li>

                  <li className="py-0.5">
                     <a className="px-3 py-2 group relative flex w-full cursor-pointer items-center rounded-md bg-primary outline-focus-ring transition duration-100 ease-linear select-none hover:bg-primary_hover focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2">
                        <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2"
                           fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
                           className="mr-2 size-5 shrink-0 text-[#85888E] transition-inherit-all">
                           <path
                              d="m6 15 2 2 4.5-4.5M8 8V5.2c0-1.12 0-1.68.218-2.108a2 2 0 0 1 .874-.874C9.52 2 10.08 2 11.2 2h7.6c1.12 0 1.68 0 2.108.218a2 2 0 0 1 .874.874C22 3.52 22 4.08 22 5.2v7.6c0 1.12 0 1.68-.218 2.108a2 2 0 0 1-.874.874C20.48 16 19.92 16 18.8 16H16M5.2 22h7.6c1.12 0 1.68 0 2.108-.218a2 2 0 0 0 .874-.874C16 20.48 16 19.92 16 18.8v-7.6c0-1.12 0-1.68-.218-2.108a2 2 0 0 0-.874-.874C14.48 8 13.92 8 12.8 8H5.2c-1.12 0-1.68 0-2.108.218a2 2 0 0 0-.874.874C2 9.52 2 10.08 2 11.2v7.6c0 1.12 0 1.68.218 2.108a2 2 0 0 0 .874.874C3.52 22 4.08 22 5.2 22Z">
                           </path>
                        </svg>
                        <span
                           className="flex-1 text-md font-semibold text-secondary transition-inherit-all group-hover:text-secondary_hover truncate">Tasks</span>
                        <span
                           className="size-max flex items-center whitespace-nowrap rounded-full ring-1 ring-inset py-0.5 px-2 text-xs font-medium bg-utility-gray-50 text-utility-gray-700 ring-[#85888E] text-whitr/85 ml-3">8</span>
                     </a>
                  </li>
                  <li className="py-0.5">
                     <a className="px-3 py-2 group relative flex w-full cursor-pointer items-center rounded-md bg-primary outline-focus-ring transition duration-100 ease-linear select-none hover:bg-primary_hover focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2">
                        <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2"
                           fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
                           className="mr-2 size-5 shrink-0 text-[#85888E] transition-inherit-all">
                           <path
                              d="M12 2a10 10 0 0 1 10 10M12 2v10m0-10C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10M12 2c5.523 0 10 4.477 10 10m0 0H12m10 0a10 10 0 0 1-4.122 8.09L12 12">
                           </path>
                        </svg>
                        <span
                           className="flex-1 text-md font-semibold text-secondary transition-inherit-all group-hover:text-secondary_hover truncate">Reporting</span>
                     </a>
                  </li>
                  <li className="py-0.5">
                     <a className="px-3 py-2 group relative flex w-full cursor-pointer items-center rounded-md bg-primary outline-focus-ring transition duration-100 ease-linear select-none hover:bg-primary_hover focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2">
                        <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2"
                           fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
                           className="mr-2 size-5 shrink-0 text-[#85888E] transition-inherit-all">
                           <path
                              d="M22 21v-2a4.002 4.002 0 0 0-3-3.874M15.5 3.291a4.001 4.001 0 0 1 0 7.418M17 21c0-1.864 0-2.796-.305-3.53a4 4 0 0 0-2.164-2.165C13.796 15 12.864 15 11 15H8c-1.864 0-2.796 0-3.53.305a4 4 0 0 0-2.166 2.164C2 18.204 2 19.136 2 21M13.5 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z">
                           </path>
                        </svg>
                        <span
                           className="flex-1 text-md font-semibold text-secondary transition-inherit-all group-hover:text-secondary_hover truncate">Users</span>
                     </a>
                  </li>
               </ul>
               <div className="mt-auto flex flex-col gap-4 px-2 py-4 lg:px-4 lg:py-6">
                  {/* <div className="relative flex flex-col rounded-xl bg-secondary p-4">
                     <p className="text-sm font-semibold text-primary">New features available!</p>
                     <p className="mt-1 text-sm text-tertiary">Check out the new dashboard view. Pages now load
                        faster.</p>
                     <div className="absolute top-2 right-2">
                        <button
                           className="flex cursor-pointer items-center justify-center rounded-lg p-2 transition duration-100 ease-linear focus:outline-hidden size-9 text-fg-quaternary hover:bg-primary_hover hover:text-fg-quaternary_hover focus-visible:outline-2 focus-visible:outline-offset-2 outline-focus-ring"
                           data-rac="" type="button" tabindex="0" data-react-aria-pressable="true"
                           aria-label="Close" id="react-aria-_R_espbsnpfiv7b_">
                           <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor"
                              stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"
                              aria-hidden="true" className="shrink-0 transition-inherit-all size-5">
                              <path d="M17 7 7 17M7 7l10 10"></path>
                           </svg>
                        </button>
                     </div>
                     <div className="relative mt-4 w-full">
                        <img src="https://www.untitledui.com/application/smiling-girl-2.webp"
                           className="aspect-video w-full rounded-lg object-cover outline-1 -outline-offset-1 outline-avatar-contrast-border"
                           alt="New features available!" />
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
                           className="absolute top-1/2 left-1/2 size-5 -translate-x-1/2 -translate-y-1/2 text-fg-white">
                           <path
                              d="M2.19995 2.86327C2.19995 1.61155 3.57248 0.844595 4.63851 1.50061L12.9856 6.63731C14.0009 7.26209 14.0009 8.73784 12.9856 9.36262L4.63851 14.4993C3.57247 15.1553 2.19995 14.3884 2.19995 13.1367V2.86327Z"
                              fill="currentColor"></path>
                        </svg>
                     </div>
                     <div className="mt-4 flex gap-3">
                        <button
                           className="group relative inline-flex h-max cursor-pointer items-center whitespace-nowrap outline-brand transition duration-100 ease-linear before:absolute focus-visible:outline-2 focus-visible:outline-offset-2 in-data-input-wrapper:shadow-xs in-data-input-wrapper:focus:!z-50 in-data-input-wrapper:in-data-leading:-mr-px in-data-input-wrapper:in-data-leading:rounded-r-none in-data-input-wrapper:in-data-leading:before:rounded-r-none in-data-input-wrapper:in-data-trailing:-ml-px in-data-input-wrapper:in-data-trailing:rounded-l-none in-data-input-wrapper:in-data-trailing:before:rounded-l-none disabled:cursor-not-allowed disabled:text-fg-disabled disabled:*:data-icon:text-fg-disabled_subtle *:data-icon:pointer-events-none *:data-icon:size-5 *:data-icon:shrink-0 *:data-icon:transition-inherit-all px-3 py-2 text-sm font-semibold before:rounded-[7px] data-icon-only:p-2 in-data-input-wrapper:px-3.5 in-data-input-wrapper:py-2.5 in-data-input-wrapper:data-icon-only:p-2.5 justify-normal rounded p-0! text-tertiary hover:text-tertiary_hover *:data-text:underline *:data-text:decoration-transparent *:data-text:underline-offset-2 hover:*:data-text:decoration-current *:data-icon:text-fg-quaternary hover:*:data-icon:text-fg-quaternary_hover gap-1"
                           data-rac="" type="button" tabindex="0" data-react-aria-pressable="true"
                           id="react-aria-_R_1mspbsnpfiv7b_">
                           <span data-text="true" className="transition-inherit-all">Dismiss</span>
                        </button>
                        <button
                           className="group relative inline-flex h-max cursor-pointer items-center whitespace-nowrap outline-brand transition duration-100 ease-linear before:absolute focus-visible:outline-2 focus-visible:outline-offset-2 in-data-input-wrapper:shadow-xs in-data-input-wrapper:focus:!z-50 in-data-input-wrapper:in-data-leading:-mr-px in-data-input-wrapper:in-data-leading:rounded-r-none in-data-input-wrapper:in-data-leading:before:rounded-r-none in-data-input-wrapper:in-data-trailing:-ml-px in-data-input-wrapper:in-data-trailing:rounded-l-none in-data-input-wrapper:in-data-trailing:before:rounded-l-none disabled:cursor-not-allowed disabled:text-fg-disabled disabled:*:data-icon:text-fg-disabled_subtle *:data-icon:pointer-events-none *:data-icon:size-5 *:data-icon:shrink-0 *:data-icon:transition-inherit-all px-3 py-2 text-sm font-semibold before:rounded-[7px] data-icon-only:p-2 in-data-input-wrapper:px-3.5 in-data-input-wrapper:py-2.5 in-data-input-wrapper:data-icon-only:p-2.5 justify-normal rounded p-0! text-brand-secondary hover:text-brand-secondary_hover *:data-text:underline *:data-text:decoration-transparent *:data-text:underline-offset-2 hover:*:data-text:decoration-current *:data-icon:text-fg-brand-secondary_alt hover:*:data-icon:text-fg-brand-secondary_hover gap-1"
                           data-rac="" type="button" tabindex="0" data-react-aria-pressable="true"
                           id="react-aria-_R_2mspbsnpfiv7b_">
                           <span data-text="true" className="transition-inherit-all">What &#x27;s new?</span>
                        </button>
                     </div>
                  </div> */}
                  <div className="relative flex items-center gap-3 rounded-xl p-3 ring-1 ring-secondary ring-white/10">
                     <figure className="group flex min-w-0 flex-1 items-center gap-2">
                        <div
                           className="relative inline-flex shrink-0 items-center justify-center rounded-full bg-avatar-bg outline-avatar-contrast-border size-10 outline-1 -outline-offset-1">
                           <img className="size-full rounded-full object-cover"
                              src={user?.logo ?? ff}
                              />
                           <span
                              className="absolute right-0 bottom-0 rounded-full ring-[1.5px] ring-green-400 bg-green-400 size-2.5"></span>
                        </div>
                        <figcaption className="min-w-0 flex-1">
                           <p className="text-primary text-sm font-semibold">{user.username}</p>
                           <p className="truncate text-tertiary text-sm">
                              <span className='text-[#85888E]' >
                                 {user.email}
                              </span>
                           </p>
                        </figcaption>
                     </figure>
                     <div className="absolute top-1.5 right-1.5">
                        <button
                           className="flex cursor-pointer items-center justify-center rounded-md p-1.5 text-fg-quaternary outline-focus-ring transition duration-100 ease-linear hover:bg-primary_hover hover:text-fg-quaternary_hover focus-visible:outline-2 focus-visible:outline-offset-2 pressed:bg-primary_hover pressed:text-fg-quaternary_hover"
                           type="button"
                        >
                           <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor"
                              stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"
                              aria-hidden="true" className="size-4 shrink-0 text-[#85888E]">
                              <path d="m7 15 5 5 5-5M7 9l5-5 5 5"></path>
                           </svg>
                        </button>
                     </div>
                  </div>
               </div>
            </aside>
         </div>
      </>
   )
}

export default DashSideBar