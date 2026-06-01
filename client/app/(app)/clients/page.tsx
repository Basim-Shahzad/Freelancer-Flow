"use client";

import EmptyState from "@/components/EmptyState";
import DashboardHeader from "@/components/Header";
import ClientsTable from "./components/ClientsTable";
import { useQuery } from "@tanstack/react-query";
import { User } from "lucide-react";
import { Spinner } from "@heroui/react";
import { useClients } from "./useClients";
import FiltersHeader from "@/components/FiltersHeader";
import { useClientsStore } from "@/stores/useDisplayStore";

export default function ProjectsPage() {
   const clientStore = useClientsStore();
   const { display } = clientStore;
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

   if (res?.data.total === 0)
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
         <FiltersHeader
            chips={[]}
            count={`${res?.data.total} Clients`}
            displayStore={clientStore}
         />
         {display === "table" && <ClientsTable clients={res?.data?.clients || []} />}
         {display === "cards" && <div>TODO</div>}
      </div>
   );
}
