"use client";

import EmptyState from "@/components/EmptyState";
import DashboardHeader from "@/components/Header";
import ClientsTable from "./components/ClientsTable";
import { useQuery } from "@tanstack/react-query";
import { User } from "lucide-react";
import { Spinner } from "@heroui/react";
import { useClients } from "./useClients";

export default function ProjectsPage() {
   const {
      data: res,
      isLoading,
      isError,
   } = useQuery({
      queryKey: ["clients"],
      queryFn: () => useClients.getAll(),
   });

   if (isLoading)
      return (
         <div className="">
            <Spinner className="absolute right-2/5 top-3/7" />
         </div>
      );

   if (isError) return <div>Error</div>;

   if (res?.data.results.clients.length === 0)
      return (
         <EmptyState
            icon={<User />}
            title="Clients"
            description="You don't have any clients."
            primaryAction={{
               label: "Create new client",
               onClick() {
                  console.log("Create new client"); // TODO : Create new client modal
               },
            }}
         />
      );

   return (
      <div className="flex flex-col min-h-screen">
         <DashboardHeader title="Clients" />
         <DashboardHeader title="Clients" />

         <ClientsTable clients={res?.data?.results?.clients || []} />
      </div>
   );
}
