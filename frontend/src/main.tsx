import "./index.css";
import App from "./App.jsx";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import { ApiProvider } from "./hooks/useApi.js";
import { HeroUIProvider } from "@heroui/system";
import { InvoicesProvider } from "./Contexts/InvoicesContext.js";
// import { TimerProvider } from "./Contexts/TimerContext.js";
import { AuthProvider } from "@/Contexts/AuthContext.js";

import Dashboard from "./pages/dashboard/Dashboard.jsx";
import Projects from "./pages/ProjectsPage.jsx";
import Layout from "./pages/Layout.jsx";
import Clients from "./pages/ClientsPage.js";
import Hero from "./pages/homepage/Hero.jsx";
import { ProtectedRoute } from "./Contexts/ProtectedRoute.jsx";
import ProjectDetail from "./pages/projectDetail/ProjectDetailPage.js";
import NotFound from "./pages/miscPages/NotFound.jsx";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import Invoices from "./pages/invoices/Invoices.js";
import InvoiceCreate from "./pages/InvoiceCreate/InvoiceCreate.js";
import InvoiceDetail from "./pages/invoiceDetail/InvoiceDetail.js";
import { TimeTrackingPage } from "./pages/TimeTrackingPage.js";
import { LoginPage } from "./pages/LoginPage.js";
import { SignupPage } from "./pages/SignupPage.js";
import { AuthInitializer } from "./AuthInitializer.js";

const router = createBrowserRouter([
   {
      path: "/",
      element: <Hero />,
   },
   {
      path: "/",
      element: (
         <InvoicesProvider>
            <Layout />
         </InvoicesProvider>
      ),
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
         {
            path: "time-tracking",
            element: (
               <ProtectedRoute>
                  <TimeTrackingPage />
               </ProtectedRoute>
            ),
         },
         {
            path: "invoices",
            element: (
               <ProtectedRoute>
                  <Invoices />
               </ProtectedRoute>
            ),
         },
         {
            path: "invoices/create",
            element: (
               <ProtectedRoute>
                  <InvoiceCreate />
               </ProtectedRoute>
            ),
         },
         {
            path: "invoices/:id",
            element: (
               <ProtectedRoute>
                  <InvoiceDetail />
               </ProtectedRoute>
            ),
         },
      ],
   },
   { path: "/login", element: <LoginPage /> },
   { path: "/signup", element: <SignupPage /> },
   { path: "/not-found", element: <NotFound /> },
]);

const queryClient = new QueryClient({
   defaultOptions: {
      queries: {
         enabled: !!localStorage.getItem("token"),
         staleTime: 5 * 60 * 1000, // 5 minutes
         refetchOnWindowFocus: false,
         refetchOnMount: false,
      },
   },
});

function Main() {
   return (
      <StrictMode>
         <QueryClientProvider client={queryClient}>
            <HeroUIProvider>
               <App>
                  <ApiProvider>
                     <RouterProvider router={router} />
                     <AuthInitializer />
                     <ReactQueryDevtools initialIsOpen={false} />
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
