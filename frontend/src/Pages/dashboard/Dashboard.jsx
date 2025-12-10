import React, { useState, useContext } from 'react'
import DashSideBar from '../../layout/DashSideBar.jsx'
import MobileHeader from '../../layout/MobileHeader.jsx'
import DashboardHeader from './DashboardHeader.jsx'
import DashboardRevenueSection from './DashboardRevenueSection.jsx'
import DashboardStats from './DashboardStats.jsx'
import DashboardMid from './DashboardMid.jsx'

const Dashboard = () => {

    return (
        <div className="flex flex-col lg:flex-row bg-white text-black dark:bg-[#000000] dark:text-white transition-colors duration-300">
            <header>
                <MobileHeader />
            </header>

            {/* <aside>
                <DashSideBar />
            </aside> */}

            <div className="invisible pl-[296px] hidden lg:sticky lg:top-0 lg:bottom-0 lg:left-0 lg:block">
            </div>

            <main className='min-w-0 flex-1 pt-8 pb-12' >
                <div className="flex flex-col gap-8" >
                    <DashboardHeader />

                    <div className="flex flex-col gap-6 px-4 lg:flex-row lg:gap-8 lg:px-8">
                        <DashboardRevenueSection />
                        <DashboardStats />
                    </div>

                    <div className="flex flex-col gap-6 px-4 lg:px-8">
                        <DashboardMid />
                    </div>

                </div>
            </main>
        </div>
    )
}

export default Dashboard
