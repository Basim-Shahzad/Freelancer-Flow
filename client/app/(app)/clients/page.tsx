"use client";

import EmptyState from "@/components/EmptyState";
import DashboardHeader from "@/components/Header";
import ClientsTable from "./components/ClientsTable";
import { useQuery } from "@tanstack/react-query";
import { User } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
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
         <div className="flex flex-1 items-center justify-center py-24">
            <Spinner className="size-6 text-primary" />
         </div>
      );

   if (isError)
      return (
         <div className="flex flex-1 items-center justify-center py-24">
            <p className="text-sm text-error">Something went wrong loading clients.</p>
         </div>
      );

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
      <div className="flex flex-1 flex-col">
         <DashboardHeader title="Clients" />
         <FiltersHeader
            chips={[]}
            displayStore={clientStore}
         />
         {display === "table" && <ClientsTable clients={res?.data?.clients || []} />}
         {display === "cards" && <div>TODO</div>}
      </div>
   );
}
