import './index.css'
import App from './App.jsx'
import { StrictMode, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter } from "react-router-dom";
import { RouterProvider } from "react-router-dom";
import { ApiProvider } from "./Contexts/Api.jsx";
import { ThemeProvider } from './Contexts/Theme.jsx';
import { AuthProvider } from './Contexts/AuthContext.jsx';
import Dashboard from './Pages/Dashboard.jsx';
import Projects from './Pages/Projects.jsx';
import Layout from './Pages/Layout.jsx';
import Clients from './Pages/Clients.jsx';
import Hero from './Pages/Hero.jsx';

const router = createBrowserRouter([
    {
        path : "/",
        element: <Hero />
    },
    {
        path: "/",
        element: <Layout />,
        children: [
            { path: "dashboard", element: <Dashboard /> },
            { path: "projects", element: <Projects /> },
            { path: "clients", element: <Clients /> },
        ],
    },
]);

function Main() {
    return (
        <StrictMode>
            <ThemeProvider>
                <ApiProvider>
                    <AuthProvider>
                        <RouterProvider router={router} />
                    </AuthProvider>
                </ApiProvider>
            </ThemeProvider>
        </StrictMode>
    );
}

createRoot(document.getElementById('root')).render(<Main />);