import "./index.css";
// import './Styles/0141b25862e58bec.css'
// import './Styles/d905fbbaa55da57f.css'
// import './Styles/c63e60b46454ebae.css'
// import './Styles/3448e2a90adc2c00.css'

import App from "./App.jsx";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import { ApiProvider } from "./hooks/useApi.jsx";
import { HeroUIProvider } from "@heroui/system";
import { AuthProvider } from "./Contexts/AuthContext.jsx";

import Dashboard from "./pages/dashboard/Dashboard.jsx";
import Projects from "./pages/projects/Projects.jsx";
import Layout from "./pages/Layout.jsx";
import Clients from "./pages/clients/Clients.jsx";
import Hero from "./pages/homepage/Hero.jsx";
import { Login } from "./pages/homepage/Login.jsx";
import ProtectedRoute from "./Contexts/ProtectedRoute.jsx";
import ProjectDetail from "./pages/projectDetail/ProjectDetail.jsx";
import NotFound from "./pages/miscPages/NotFound.jsx";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

const router = createBrowserRouter([
   {
      path: "/",
      element: <Hero />,
   },
   {
      path: "/",
      element: <Layout />,
      children: [
         {
            path: "projects",
            element: (
               <ProtectedRoute>
                  <Projects />
               </ProtectedRoute>
            ),
         },
         {
            path: "clients",
            element: (
               <ProtectedRoute>
                  <Clients />
               </ProtectedRoute>
            ),
         },
         {
            path: "dashboard",
            element: (
               <ProtectedRoute>
                  <Dashboard />
               </ProtectedRoute>
            ),
         },
         {
            path: "projects/:id",
            element: (
               <ProtectedRoute>
                  <ProjectDetail />
               </ProtectedRoute>
            ),
         },
      ],
   },
   { path: "/login", element: <Login /> },
   { path: "/signup", element: <Login /> },
   { path: "/not-found", element: <NotFound /> },
]);

const queryClient = new QueryClient();

function Main() {
   return (
      <StrictMode>
         <QueryClientProvider client={queryClient}>
            <HeroUIProvider>
               <App>
                  <ApiProvider>
                     <AuthProvider>
                        <RouterProvider router={router} />
                        <ReactQueryDevtools initialIsOpen={false} />
                     </AuthProvider>
                  </ApiProvider>
               </App>
            </HeroUIProvider>
         </QueryClientProvider>
      </StrictMode>
   );
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");
createRoot(root).render(<Main />);