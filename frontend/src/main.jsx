import './index.css'
// import './Styles/0141b25862e58bec.css'
// import './Styles/d905fbbaa55da57f.css'
// import './Styles/c63e60b46454ebae.css'
// import './Styles/3448e2a90adc2c00.css'

import App from './App.jsx'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import { ApiProvider } from "./Contexts/Api.jsx";
import { AuthProvider } from './Contexts/AuthContext.jsx';

import Dashboard from './Pages/Dashboard.jsx';
import Projects from './Pages/Projects.jsx';
import Layout from './Pages/Layout.jsx';
import Clients from './Pages/Clients.jsx';
import Hero from './Pages/Hero.jsx';
import { Login } from './Pages/Login.jsx';
import ProtectedRoute from './Contexts/ProtectedRoute.jsx';

const router = createBrowserRouter([
    {
        path: "/",
        element: <Hero />
    },
    {
        path: "/",
        element: <Layout />,
        children: [
            { path: "projects", element: <Projects /> },
            { path: "clients", element: <Clients /> },
        ],
    },
    {
        path: "dashboard",
        element: <ProtectedRoute>
            <Dashboard />
        </ProtectedRoute>
    },
    { path: "/login", element: <Login /> },
    { path: "/signup", element: <Login /> }
]);

function Main() {
    return (
        <StrictMode>
            <App>  {/* ← THEME CONTEXT PROVIDER */}
                <ApiProvider>
                    <AuthProvider>
                        <RouterProvider router={router} />
                    </AuthProvider>
                </ApiProvider>
            </App>
        </StrictMode>
    );
}

createRoot(document.getElementById('root')).render(<Main />);
