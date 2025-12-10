import React from 'react'
import { Outlet } from 'react-router-dom'
import App, { ThemeContext } from '../App.jsx'
import DashSideBar from '../layout/DashSideBar.jsx'


const LayoutWrapper = () => {
    return (
        <App>
            <Layout />
        </App>
    )
}

function Layout() {
    return (
        <div className="min-h-screen flex">
            <div className="flex-1">
                <aside>
                    <DashSideBar />
                </aside>
                <Outlet />
            </div>
        </div>
    )
}


export default LayoutWrapper