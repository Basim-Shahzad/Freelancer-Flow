import React from 'react'
import { Outlet } from 'react-router-dom'
import App, { ThemeContext } from '../App'


const LayoutWrapper = () => {
    return (
        <App>
            <Layout />
        </App>
    )
}

function Layout() {
    return (
        <div className="min-h-screen flex bg-slate-50 dark:bg-yellow-400">
            <div className="flex-1">
                <Outlet />
            </div>
        </div>
    )
}


export default LayoutWrapper