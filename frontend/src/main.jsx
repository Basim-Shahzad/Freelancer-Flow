import { StrictMode, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { createBrowserRouter } from "react-router-dom";
import { RouterProvider } from "react-router-dom";
import { ApiProvider } from "./Contexts/Api.jsx";
import { ThemeProvider } from './Contexts/Theme.jsx';
import { AuthProvider } from './Contexts/AuthContext.jsx';
import './index.css'
import Dashboard from './Components/Dashboard.jsx';
import Projects from './Components/Projects.jsx';
import Layout from './Pages/Layout.jsx';

const router = createBrowserRouter([
    {
        path: "/",
        element: <Layout />,
        errorElement: <>
            <div className="w-full min-h-screen bg-red-100 flex justify-center items-center flex-col text-3xl select-none">
                <div className='text-7xl'>⚠️</div>
                <div>Something went wrong </div>
                <div>Please try again later.</div>
            </div>
        </>,
        children: [
            { index: true, element: <App /> },
            { path: "dashboard", element: <Dashboard /> },
            { path: "projects", element: <Projects /> },
        ],
    },
]);

// const router = createBrowserRouter([
//     {
//         path: "/",
//         element: <App />,
//         errorElement: <>
//             <div className="w-full min-h-screen bg-red-100 flex justify-center items-center flex-col text-3xl select-none">
//                 <div className='text-7xl'>⚠️</div>
//                 <div>Something went wrong </div>
//                 <div>Please try again later.</div>
//             </div>
//         </>,
//     }
// ])

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